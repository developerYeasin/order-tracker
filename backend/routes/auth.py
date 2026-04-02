from flask import Blueprint, request, jsonify
from models import db, User
from extensions import db
import secrets
from bcrypt import hashpw, gensalt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Email and password required'}), 400

    email = data['email'].strip().lower()
    password = data['password']

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Generate token and store it in user record
    token = secrets.token_hex(32)
    user.current_token = token
    db.session.commit()

    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'is_admin': user.is_admin
        },
        'message': 'Login successful'
    }), 200

@auth_bp.route('/verify', methods=['GET'])
def verify_token():
    from flask import current_app
    from flask import request as flask_request

    auth_header = flask_request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'valid': False, 'error': 'No token provided'}), 401

    token = auth_header.split(' ')[1]

    user = User.query.filter_by(current_token=token).first()

    if not user:
        return jsonify({'valid': False, 'error': 'Invalid token'}), 401

    # Optionally refresh token expiry here if implementing expiration

    return jsonify({
        'valid': True,
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'is_admin': user.is_admin
        }
    }), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    from flask import request as flask_request

    auth_header = flask_request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No token provided'}), 400

    token = auth_header.split(' ')[1]

    user = User.query.filter_by(current_token=token).first()
    if user:
        user.current_token = None
        db.session.commit()

    return jsonify({'message': 'Logged out'}), 200

@auth_bp.route('/users/me/change-password', methods=['POST'])
def change_password():
    from flask import request as flask_request

    auth_header = flask_request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authentication required'}), 401

    token = auth_header.split(' ')[1]
    user = User.query.filter_by(current_token=token).first()

    if not user:
        return jsonify({'error': 'Invalid token'}), 401

    data = flask_request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({'error': 'Current password and new password required'}), 400

    # Verify current password
    if not user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401

    # Update password
    user.password_hash = hashpw(new_password.encode('utf-8'), gensalt()).decode('utf-8')
    db.session.commit()

    return jsonify({'message': 'Password changed successfully'}), 200

# User Management endpoints (Admin only)
@auth_bp.route('/users', methods=['GET'])
def list_users():
    from flask import request as flask_request

    # Verify admin token
    auth_header = flask_request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authentication required'}), 401

    token = auth_header.split(' ')[1]
    admin_user = User.query.filter_by(current_token=token, is_admin=True).first()

    if not admin_user:
        return jsonify({'error': 'Admin access required'}), 403

    users = User.query.order_by(User.created_at.desc()).all()
    user_list = [{
        'id': u.id,
        'email': u.email,
        'name': u.name,
        'is_admin': u.is_admin,
        'created_at': u.created_at.isoformat() if u.created_at else None
    } for u in users]

    return jsonify({'users': user_list}), 200

@auth_bp.route('/users', methods=['POST'])
def create_user():
    from flask import request as flask_request

    # Verify admin token
    auth_header = flask_request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authentication required'}), 401

    token = auth_header.split(' ')[1]
    admin_user = User.query.filter_by(current_token=token, is_admin=True).first()

    if not admin_user:
        return jsonify({'error': 'Admin access required'}), 403

    data = flask_request.get_json()

    if not data or 'email' not in data or 'password' not in data or 'name' not in data:
        return jsonify({'error': 'Email, password, and name are required'}), 400

    email = data['email'].strip().lower()
    name = data['name'].strip()
    password = data['password']
    is_admin = data.get('is_admin', False)

    # Check if email already exists
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': 'Email already registered'}), 400

    # Hash password
    password_hash = hashpw(password.encode('utf-8'), gensalt()).decode('utf-8')

    user = User(
        email=email,
        password_hash=password_hash,
        name=name,
        is_admin=is_admin
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'id': user.id,
        'email': user.email,
        'name': user.name,
        'is_admin': user.is_admin,
        'message': 'User created successfully'
    }), 201

@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    from flask import request as flask_request

    # Verify admin token
    auth_header = flask_request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authentication required'}), 401

    token = auth_header.split(' ')[1]
    admin_user = User.query.filter_by(current_token=token, is_admin=True).first()

    if not admin_user:
        return jsonify({'error': 'Admin access required'}), 403

    # Prevent self-deletion
    if user_id == admin_user.id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()

    return jsonify({'message': 'User deleted successfully'}), 200
