import os
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from extensions import db


# ========== ORIGINAL MODELS ==========

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    current_token = db.Column(db.String(64), nullable=True, unique=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def check_password(self, password):
        from bcrypt import checkpw
        return checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))


class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    division = db.Column(db.String(100), nullable=False)
    district = db.Column(db.String(100), nullable=False)
    upazila_zone = db.Column(db.String(100), nullable=False)
    address = db.Column(db.Text, nullable=True)  # Full address
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=True)  # Price for COD/Prepaid
    payment_type = db.Column(db.Enum('COD', 'Prepaid', name='payment_type_enum'), nullable=False, default='COD')
    courier_parcel_id = db.Column(db.String(100), nullable=True)
    position = db.Column(db.Integer, nullable=True)
    design_file_url = db.Column(db.Text, nullable=True)  # JSON array of design file objects: [{"url": "...", "file_type": "...", "filename": "...", "media_id": ...}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    status = db.relationship('OrderStatus', backref='order', lazy=True, uselist=False, cascade='all, delete-orphan')
    media = db.relationship('Media', backref='order', lazy=True, cascade='all, delete-orphan')
    activity_logs = db.relationship('ActivityLog', backref='order', lazy=True, cascade='all, delete-orphan')


class OrderStatus(db.Model):
    __tablename__ = 'order_status'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, unique=True)

    # Design & Production
    design_ready = db.Column(db.Boolean, default=False, nullable=False)
    is_printed = db.Column(db.Boolean, default=False, nullable=False)
    picking_done = db.Column(db.Boolean, default=False, nullable=False)

    # Delivery
    delivery_status = db.Column(db.Enum('Submitted', 'Delivered', 'Returned', name='delivery_status_enum'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Media(db.Model):
    __tablename__ = 'media'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey('order_items.id'), nullable=True)  # Nullable: media can belong to order or item
    side = db.Column(db.String(20), nullable=True)  # 'front', 'back', or NULL for order-level or non-apparel
    file_path = db.Column(db.String(500), nullable=False)  # For local path or Cloudinary public_id
    file_url = db.Column(db.String(500), nullable=True)  # For Cloudinary URL (or populated on demand)
    file_type = db.Column(db.Enum('Image', 'Video', 'File', name='file_type_enum'), nullable=False)
    is_design = db.Column(db.Boolean, default=False, nullable=False)  # Flag to mark design files specifically
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to OrderItem (optional)
    item = db.relationship('OrderItem', backref=db.backref('media', cascade='all, delete-orphan'), lazy=True)


class ActivityLog(db.Model):
    __tablename__ = 'activity_log'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class OrderItem(db.Model):
    """Items within an order (e.g., t-shirt designs)"""
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    size = db.Column(db.String(20), nullable=False)  # e.g., S, M, L, XL, XXL
    quantity = db.Column(db.Integer, nullable=False, default=1)
    position = db.Column(db.Integer, nullable=True)  # For ordering items within an order
    note = db.Column(db.Text, nullable=True)  # Optional note/description for the item
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to order - cascade delete from order to items
    order = db.relationship('Order', backref=db.backref('items', cascade='all, delete-orphan'))

    # Media relationship - items can have multiple images (front/back/etc)
    # Media deletes will cascade from item via db.backref with cascade on Media.item relationship

    def to_dict(self, with_media=False):
        """Serialize item to dictionary"""
        data = {
            'id': self.id,
            'order_id': self.order_id,
            'size': self.size,
            'quantity': self.quantity,
            'position': self.position,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if with_media:
            # Separate front and back images
            front = []
            back = []
            other = []
            for m in self.media:
                # Build display URL: use file_url if available, otherwise construct from file_path for local files
                if m.file_url:
                    display_url = m.file_url
                else:
                    # For local files stored without full URL, construct it (relative URL)
                    display_url = f"/uploads/{m.file_path.replace(os.sep, '/')}" if m.file_path else None
                media_dict = {
                    'id': m.id,
                    'file_path': m.file_path,
                    'file_url': display_url,
                    'file_type': m.file_type,
                    'side': m.side,
                    'uploaded_at': m.uploaded_at.isoformat() if m.uploaded_at else None
                }
                if m.side == 'front':
                    front.append(media_dict)
                elif m.side == 'back':
                    back.append(media_dict)
                else:
                    other.append(media_dict)
            data['front_images'] = front
            data['back_images'] = back
            data['other_images'] = other  # For any images without side specified
        return data


class Setting(db.Model):
    """Application settings stored in database"""
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    settings_key = db.Column(db.String(100), unique=True, nullable=False)
    settings_value = db.Column(db.Text, nullable=True)
    type = db.Column(db.String(50), nullable=False, default='string')  # string, integer, boolean, json, encrypted
    category = db.Column(db.String(50), nullable=False, default='general')
    description = db.Column(db.Text, nullable=True)
    is_encrypted = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get(cls, key, default=None):
        """Get setting value, decrypting if necessary"""
        setting = cls.query.filter_by(settings_key=key).first()
        if not setting:
            return default

        val = setting.settings_value
        if setting.is_encrypted and val:
            try:
                from cryptography.fernet import Fernet
                from base64 import b64encode
                import hashlib
                from flask import current_app
                secret = current_app.config.get('SECRET_KEY', 'order-tracker-secret-change-in-production')
                key_bytes = hashlib.sha256(secret.encode()).digest()
                fernet_key = b64encode(key_bytes)
                cipher = Fernet(fernet_key)
                decrypted = cipher.decrypt(val.encode()).decode()
                return decrypted
            except Exception:
                return val
        return val

    @classmethod
    def set(cls, key, value, type='string', category='general', description=None, is_encrypted=False):
        """Set setting value, encrypting if necessary"""
        setting = cls.query.filter_by(settings_key=key).first()
        if not setting:
            setting = cls(settings_key=key)

        stored_value = value
        if is_encrypted and value:
            try:
                from cryptography.fernet import Fernet
                from base64 import b64encode
                import hashlib
                from flask import current_app
                secret = current_app.config.get('SECRET_KEY', 'order-tracker-secret-change-in-production')
                key_bytes = hashlib.sha256(secret.encode()).digest()
                fernet_key = b64encode(key_bytes)
                cipher = Fernet(fernet_key)
                encrypted = cipher.encrypt(str(value).encode()).decode()
                stored_value = encrypted
            except Exception as e:
                current_app.logger.error(f'Encryption failed for setting {key}: {str(e)}')
                stored_value = value

        setting.settings_value = stored_value
        setting.type = type
        setting.category = category
        setting.description = description
        setting.is_encrypted = is_encrypted

        db.session.add(setting)
        db.session.commit()
        return setting

    @classmethod
    def delete(cls, key):
        """Delete a setting"""
        setting = cls.query.filter_by(settings_key=key).first()
        if setting:
            db.session.delete(setting)
            db.session.commit()
            return True
        return False

    @classmethod
    def get_all_by_category(cls, category):
        """Get all settings for a category"""
        settings = cls.query.filter_by(category=category).all()
        result = []
        for s in settings:
            result.append({
                'key': s.settings_key,
                'value': cls.get(s.settings_key),
                'type': s.type,
                'category': s.category,
                'description': s.description,
                'is_encrypted': s.is_encrypted
            })
        return result

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'key': self.settings_key,
            'value': Setting.get(self.settings_key) if self.is_encrypted else self.settings_value,
            'type': self.type,
            'category': self.category,
            'description': self.description,
            'is_encrypted': self.is_encrypted,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
