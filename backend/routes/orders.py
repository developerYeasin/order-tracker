import os
from flask import Blueprint, request, jsonify, Response, current_app
from models import db, Order, OrderStatus, ActivityLog, OrderItem, Setting
from datetime import datetime
from steadfast_service import SteadfastService
from sqlalchemy.orm import selectinload
import io
from config import USE_CLOUDINARY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

orders_bp = Blueprint('orders', __name__)

def log_activity(order_id, action, details=None):
    log = ActivityLog(order_id=order_id, action=action, details=details)
    db.session.add(log)
    db.session.commit()

@orders_bp.route('/orders', methods=['GET'])
def get_orders():
    search = request.args.get('search', '')
    division = request.args.get('division', '')
    district = request.args.get('district', '')
    status = request.args.get('status', '')

    query = Order.query

    if search:
        query = query.filter(
            db.or_(
                Order.customer_name.ilike(f'%{search}%'),
                Order.phone_number.ilike(f'%{search}%'),
                Order.courier_parcel_id.ilike(f'%{search}%')
            )
        )

    if division:
        query = query.filter(Order.division.ilike(f'%{division}%'))

    if district:
        query = query.filter(Order.district.ilike(f'%{district}%'))

    if status:
        if status == 'design_pending':
            query = query.join(OrderStatus).filter(OrderStatus.design_ready == False)
        elif status == 'design_ready':
            query = query.join(OrderStatus).filter(OrderStatus.design_ready == True)
        elif status == 'printed':
            query = query.join(OrderStatus).filter(OrderStatus.is_printed == True)
        elif status == 'picked':
            query = query.join(OrderStatus).filter(OrderStatus.picking_done == True)
        elif status == 'submitted':
            query = query.join(OrderStatus).filter(OrderStatus.delivery_status == 'Submitted')
        elif status == 'delivered':
            query = query.join(OrderStatus).filter(OrderStatus.delivery_status == 'Delivered')
        elif status == 'returned':
            query = query.join(OrderStatus).filter(OrderStatus.delivery_status == 'Returned')

    orders = query.order_by(Order.id.asc()).all()
    result = []

    for order in orders:
        order_data = order.to_dict()
        if order.status:
            order_data['status'] = order.status.to_dict()
        else:
            order_data['status'] = {}
        result.append(order_data)

    return jsonify(result), 200

@orders_bp.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json()

    required_fields = ['customer_name', 'phone_number', 'division', 'district', 'upazila_zone', 'description', 'payment_type']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'error': f'{field} is required'}), 400

    order = Order(
        customer_name=data['customer_name'],
        phone_number=data['phone_number'],
        division=data['division'],
        district=data['district'],
        upazila_zone=data['upazila_zone'],
        address=data.get('address'),
        description=data['description'],
        price=data.get('price'),
        payment_type=data['payment_type'],
        courier_parcel_id=data.get('courier_parcel_id')
    )

    db.session.add(order)
    db.session.flush()

    # Create initial status
    status = OrderStatus(order_id=order.id)
    db.session.add(status)

    # Create order items if provided
    items_data = data.get('items', [])
    for item_data in items_data:
        # Validate required fields
        if not item_data.get('size') or item_data.get('quantity') is None:
            # Skip invalid items, but continue order creation
            continue

        item = OrderItem(
            order_id=order.id,
            size=item_data['size'],
            quantity=int(item_data['quantity']),
            position=item_data.get('position')
        )
        db.session.add(item)
        # Optionally also append to order.items to keep collection in memory
        order.items.append(item)

    # Log activity
    log = ActivityLog(order_id=order.id, action='Order Created', details=f"Customer: {order.customer_name}")
    db.session.add(log)

    db.session.commit()

    # Refresh order to load the items relationship
    db.session.refresh(order)

    # Steadfast auto-create tracking
    steadfast_result = {
        'attempted': False,
        'success': False,
        'error': None,
        'consignment_id': None
    }

    # Try to automatically create Steadfast consignment if enabled and not already set
    auto_create_raw = Setting.get('auto_create_courier', 'true')
    # Convert to boolean - handles 'true', 'false', '1', '0', 1, 0, True, False
    if isinstance(auto_create_raw, bool):
        auto_create = auto_create_raw
    elif isinstance(auto_create_raw, (int, float)):
        auto_create = auto_create_raw == 1
    else:
        auto_create = str(auto_create_raw).lower() in ('true', '1', 'yes', 'on')

    if auto_create and not order.courier_parcel_id:
        steadfast_result['attempted'] = True
        try:
            steadfast_service = SteadfastService()
            if steadfast_service.is_configured():
                # Explicitly query items from database to ensure we have the latest data
                order_items = OrderItem.query.filter_by(order_id=order.id).all()

                print(f"[Steadfast Debug] order_items query returned {len(order_items)} items")
                for idx, item in enumerate(order_items):
                    print(f"  Item {idx+1}: size={item.size}, quantity={item.quantity}")

                # Calculate total quantity from items
                total_quantity = sum(item.quantity for item in order_items) if order_items else 0

                # Build item description from order items
                item_description = ""
                if order_items and len(order_items) > 0:
                    item_list = [f"{item.size} ({item.quantity})" for item in order_items]
                    item_description = f"Items: {', '.join(item_list)}"
                else:
                    item_description = None

                # Combine order description with item details in the note field
                # since Steadfast's note field is guaranteed to be accepted and stored
                note_parts = []
                if order.description:
                    note_parts.append(order.description[:300])  # leave room for items
                if item_description:
                    note_parts.append(item_description)
                combined_note = " | ".join(note_parts) if note_parts else None

                # Build address: use address field if provided, otherwise upazila + district
                # Format: "address, upazila_zone, district"
                if order.address:
                    address_parts = [order.address.strip()]
                    if order.upazila_zone:
                        address_parts.append(order.upazila_zone.strip())
                    if order.district:
                        address_parts.append(order.district.strip())
                    recipient_address = ", ".join(address_parts)
                else:
                    # Fallback: upazila + district
                    recipient_address = f"{order.upazila_zone}, {order.district}"

                # Build order data for Steadfast
                order_data = {
                    'invoice': f"ORD-{order.id}",
                    'recipient_name': order.customer_name,
                    'recipient_phone': order.phone_number,
                    'recipient_address': recipient_address,
                    'cod_amount': float(order.price) if order.price else 0,
                    'note': combined_note[:500] if combined_note else None,
                    # Include item_description as well for api compatibility (may be accepted)
                    'item_description': item_description[:500] if item_description else None,
                    'total_lot': total_quantity if total_quantity > 0 else None
                }

                print(f"[Steadfast] Creating consignment for order {order.id}")
                print(f"  Items: {item_description if item_description else 'None'}")
                print(f"  Combined note: {combined_note if combined_note else 'None'}")
                print(f"  Recipient address: {recipient_address}")
                print(f"  Order items count: {len(order_items) if order_items else 0}")

                # Create consignment in Steadfast
                result = steadfast_service.create_order(order_data)

                if result.get('status') == 200 and result.get('consignment'):
                    consignment = result['consignment']
                    consignment_id = consignment.get('consignment_id')
                    tracking_code = consignment.get('tracking_code')

                    # Update order with Steadfast consignment info
                    order.courier_parcel_id = str(consignment_id)
                    db.session.commit()

                    steadfast_result['success'] = True
                    steadfast_result['consignment_id'] = consignment_id

                    # Log activity
                    log = ActivityLog(
                        order_id=order.id,
                        action='Steadfast Consignment Created',
                        details=f"Consignment ID: {consignment_id}, Tracking: {tracking_code}"
                    )
                    db.session.add(log)
                    db.session.commit()
                else:
                    # Log failure but don't fail the order creation
                    error_msg = result.get('message', 'Unknown error')
                    steadfast_result['error'] = error_msg

                    log = ActivityLog(
                        order_id=order.id,
                        action='Steadfast Creation Failed',
                        details=f"Failed: {error_msg}"
                    )
                    db.session.add(log)
                    db.session.commit()
            else:
                # Steadfast not configured
                steadfast_result['error'] = 'Steadfast API credentials not configured'
                log = ActivityLog(
                    order_id=order.id,
                    action='Steadfast Skipped',
                    details='Steadfast not configured (missing API credentials)'
                )
                db.session.add(log)
                db.session.commit()
        except Exception as e:
            # Log error but don't fail order creation
            from flask import current_app
            current_app.logger.error(f'Steadfast auto-create failed for order {order.id}: {str(e)}')
            steadfast_result['error'] = str(e)

            log = ActivityLog(
                order_id=order.id,
                action='Steadfast Creation Error',
                details=f"Exception: {str(e)}"
            )
            db.session.add(log)
            db.session.commit()
    else:
        # Auto-create disabled or already has courier_parcel_id
        if not auto_create:
            steadfast_result['error'] = 'Auto-create is disabled'
        elif order.courier_parcel_id:
            steadfast_result['error'] = 'Order already has courier tracking ID'

    response = order.to_dict(with_status=True, with_items=True)
    response['steadfast'] = steadfast_result

    return jsonify(response), 201

@orders_bp.route('/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    from sqlalchemy.orm import selectinload
    include_items = request.args.get('include_items', '').lower() == 'true'
    load_options = [selectinload(Order.media)]
    if include_items:
        # Use selectinload for collections to avoid lazy loading issues
        load_options.append(selectinload(Order.items).selectinload(OrderItem.media))
    order = Order.query.options(*load_options).get_or_404(order_id)

    # Debug: log items and their media count
    if include_items:
        print(f"[get_order] Order {order_id} has {len(order.items)} items")
        for item in order.items:
            media_count = len(item.media) if hasattr(item, 'media') else 0
            print(f"  Item {item.id} (size={item.size}) has {media_count} media files")
            for m in item.media:
                print(f"    Media {m.id}: side={m.side}, file_url={m.file_url}")

    return jsonify(order.to_dict(with_status=True, with_media=True, with_items=include_items)), 200

@orders_bp.route('/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()

    # Update order fields (except status fields)
    order.customer_name = data.get('customer_name', order.customer_name)
    order.phone_number = data.get('phone_number', order.phone_number)
    order.division = data.get('division', order.division)
    order.district = data.get('district', order.district)
    order.upazila_zone = data.get('upazila_zone', order.upazila_zone)
    order.address = data.get('address', order.address)
    order.description = data.get('description', order.description)
    order.price = data.get('price', order.price)
    order.payment_type = data.get('payment_type', order.payment_type)
    order.courier_parcel_id = data.get('courier_parcel_id', order.courier_parcel_id)

    db.session.commit()

    log_activity(order_id, 'Order Updated', 'Order details modified')

    return jsonify(order.to_dict(with_status=True)), 200

@orders_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
def update_status(order_id):
    order = Order.query.get_or_404(order_id)

    if not order.status:
        order.status = OrderStatus(order_id=order.id)
        db.session.add(order.status)

    data = request.get_json()
    updates = []

    if 'design_ready' in data:
        order.status.design_ready = bool(data['design_ready'])
        updates.append(f"Design Ready: {order.status.design_ready}")

    if 'is_printed' in data:
        order.status.is_printed = bool(data['is_printed'])
        updates.append(f"Printed: {order.status.is_printed}")

    if 'picking_done' in data:
        order.status.picking_done = bool(data['picking_done'])
        updates.append(f"Picking Done: {order.status.picking_done}")

    if 'delivery_status' in data:
        # Only update if non-empty value provided (ignore empty strings)
        delivery_value = data.get('delivery_status')
        if delivery_value and delivery_value.strip():
            order.status.delivery_status = delivery_value
            updates.append(f"Delivery Status: {order.status.delivery_status}")
        elif delivery_value is None or delivery_value == '':
            # If explicitly sent as null/empty, set to NULL in database
            order.status.delivery_status = None
            updates.append("Delivery Status: Cleared")

    if 'courier_parcel_id' in data:
        order.courier_parcel_id = data['courier_parcel_id']
        updates.append(f"Courier Parcel ID: {order.courier_parcel_id}")

    # Handle design files array: append to order.design_file_url
    if 'design_files' in data and isinstance(data['design_files'], list) and data['design_files']:
        import json
        try:
            existing = json.loads(order.design_file_url) if order.design_file_url else []
        except (json.JSONDecodeError, TypeError):
            existing = []
        # Append new design file entries (with url, file_type, filename, media_id)
        combined = existing + data['design_files']
        order.design_file_url = json.dumps(combined)
        updates.append(f"Design files added: {len(data['design_files'])} (total: {len(combined)})")
        db.session.commit()  # Commit order change
        log_activity(order_id, 'Design Files Added', f"{len(data['design_files'])} files appended")
    else:
        db.session.commit()

    log_activity(order_id, 'Status Updated', ', '.join(updates))

    return jsonify(order.to_dict(with_status=True)), 200

@orders_bp.route('/orders/<int:order_id>/position', methods=['PUT'])
def update_position(order_id):
    order = Order.query.get_or_404(order_id)

    data = request.get_json()
    if 'position' not in data:
        return jsonify({'error': 'Position is required'}), 400

    try:
        position = int(data['position'])
    except ValueError:
        return jsonify({'error': 'Position must be an integer'}), 400

    order.position = position
    db.session.commit()

    return jsonify({'id': order.id, 'position': order.position}), 200

@orders_bp.route('/orders/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    order = Order.query.get_or_404(order_id)

    # Manually delete related records to avoid FK constraint issues
    if order.status:
        db.session.delete(order.status)
    for media in order.media:
        db.session.delete(media)
    for log in order.activity_logs:
        db.session.delete(log)

    db.session.delete(order)
    db.session.commit()

    return jsonify({'message': 'Order deleted'}), 200


@orders_bp.route('/orders/<int:order_id>/design-upload', methods=['POST'])
def upload_design_files(order_id):
    """
    Upload design files for an order.
    Files are uploaded to storage and marked as design files (is_design=true).
    Returns list of uploaded file info but does NOT update order.design_file_url.
    Frontend should include returned URLs in the status update request.
    """
    from flask import current_app
    from werkzeug.utils import secure_filename
    from models import Media
    from config import USE_CLOUDINARY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, ALLOWED_EXTENSIONS

    order = Order.query.get_or_404(order_id)

    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    files = request.files.getlist('files')
    # Optional parameters
    item_id = request.form.get('item_id', type=int)
    side = request.form.get('side')  # 'front', 'back', or None

    # Validate item_id if provided
    if item_id is not None:
        item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first()
        if not item:
            return jsonify({'error': f'Item {item_id} not found for this order'}), 404

    # Validate side if provided
    if side is not None and side not in ('front', 'back'):
        return jsonify({'error': "side must be 'front' or 'back'"}), 400

    current_app.logger.info(f'Design upload request for order {order_id}, {len(files)} files')
    uploaded = []
    created_media = []

    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    if USE_CLOUDINARY:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )

        for file in files:
            if file and allowed_file(file.filename):
                try:
                    folder = f"order_tracker/order_{order_id}"
                    if item_id is not None:
                        folder = f"{folder}/item_{item_id}"

                    result = cloudinary.uploader.upload(
                        file,
                        folder=folder,
                        resource_type="auto"
                    )

                    file_type = 'Video' if result.get('resource_type') == 'video' else 'Image' if result.get('resource_type') == 'image' else 'File'

                    media = Media(
                        order_id=order.id,
                        item_id=item_id,
                        side=side,
                        file_path=result['public_id'],
                        file_url=result['secure_url'],
                        file_type=file_type,
                        is_design=True  # Always mark as design
                    )
                    db.session.add(media)
                    created_media.append(media)
                except Exception as e:
                    current_app.logger.error(f'Cloudinary upload error: {str(e)}')
                    continue
    else:
        upload_folder = current_app.config['UPLOAD_FOLDER']

        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                subfolder = f"order_{order_id}"
                if item_id is not None:
                    subfolder = os.path.join(subfolder, f"item_{item_id}")
                relative_path = os.path.join(subfolder, filename)
                filepath = os.path.join(upload_folder, relative_path)
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                file.save(filepath)

                ext = filename.rsplit('.', 1)[1].lower()
                if ext in {'mp4', 'mov', 'avi', 'mkv', 'wmv'}:
                    file_type = 'Video'
                elif ext in {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'}:
                    file_type = 'Image'
                else:
                    file_type = 'File'

                file_url = f"/uploads/{relative_path.replace(os.sep, '/')}"

                media = Media(
                    order_id=order.id,
                    item_id=item_id,
                    side=side,
                    file_path=relative_path,
                    file_url=file_url,
                    file_type=file_type,
                    is_design=True  # Always mark as design
                )
                db.session.add(media)
                created_media.append(media)

    db.session.commit()

    # Build response from created Media objects
    for m in created_media:
        uploaded.append({
            'id': m.id,
            'filename': m.file_path.split('/')[-1] if m.file_path else 'unknown',
            'file_type': m.file_type,
            'url': m.file_url,
            'item_id': m.item_id,
            'side': m.side,
            'is_design': m.is_design
        })

    current_app.logger.info(f'Design upload complete. {len(uploaded)} files saved.')
    return jsonify({'uploaded': uploaded}), 200


@orders_bp.route('/orders/bulk-delete', methods=['POST'])
def bulk_delete_orders():
    """
    Bulk delete orders
    Expects JSON: { order_ids: [1,2,3] }
    """
    order_ids = request.json.get('order_ids', [])
    if not order_ids:
        return jsonify({'error': 'No order IDs provided'}), 400

    try:
        order_ids = [int(id) for id in order_ids]
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid order IDs'}), 400

    # Fetch orders to verify they exist
    orders = Order.query.filter(Order.id.in_(order_ids)).all()
    if not orders:
        return jsonify({'error': 'No orders found'}), 404

    # Fetch orders with items and their media to properly delete everything
    orders = Order.query.options(
        selectinload(Order.items).selectinload(OrderItem.media),
        selectinload(Order.media),
        selectinload(Order.status),
        selectinload(Order.activity_logs)
    ).filter(Order.id.in_(order_ids)).all()

    # Delete each order with its related records
    deleted_count = 0
    for order in orders:
        # Delete order items first (and their media)
        for item in order.items:
            for media in item.media:
                # Delete media file from Cloudinary or filesystem
                if USE_CLOUDINARY and media.file_path and media.file_path.startswith('order_tracker'):
                    try:
                        import cloudinary.uploader
                        cloudinary.uploader.destroy(media.file_path)
                    except Exception as e:
                        current_app.logger.error(f'Cloudinary delete error for media {media.id}: {str(e)}')
                elif media.file_path:
                    # Delete from filesystem
                    import os
                    try:
                        full_path = os.path.join(current_app.config['UPLOAD_FOLDER'], media.file_path) if not media.file_path.startswith('/') else media.file_path
                        if os.path.exists(full_path):
                            os.remove(full_path)
                    except Exception:
                        pass
                db.session.delete(media)
            db.session.delete(item)

        # Delete order-level media
        for media in order.media:
            if USE_CLOUDINARY and media.file_path and media.file_path.startswith('order_tracker'):
                try:
                    import cloudinary.uploader
                    cloudinary.uploader.destroy(media.file_path)
                except Exception as e:
                    current_app.logger.error(f'Cloudinary delete error for media {media.id}: {str(e)}')
            elif media.file_path:
                import os
                try:
                    full_path = os.path.join(current_app.config['UPLOAD_FOLDER'], media.file_path) if not media.file_path.startswith('/') else media.file_path
                    if os.path.exists(full_path):
                        os.remove(full_path)
                except Exception:
                    pass
            db.session.delete(media)

        # Delete related records
        if order.status:
            db.session.delete(order.status)
        for log in order.activity_logs:
            db.session.delete(log)

        db.session.delete(order)
        deleted_count += 1

    db.session.commit()

    return jsonify({'message': f'{deleted_count} order(s) deleted successfully'}), 200


# ========== Order Items API ==========

@orders_bp.route('/orders/<int:order_id>/items', methods=['GET'])
def get_order_items(order_id):
    """Get all items for an order"""
    from sqlalchemy.orm import selectinload
    items = OrderItem.query.options(selectinload(OrderItem.media)).filter_by(order_id=order_id).order_by(OrderItem.position.asc().nullslast(), OrderItem.id.asc()).all()
    return jsonify([item.to_dict(with_media=True) for item in items]), 200


@orders_bp.route('/orders/<int:order_id>/items', methods=['POST'])
def create_order_item(order_id):
    """Create a new item for an order"""
    order = Order.query.get_or_404(order_id)
    data = request.get_json()

    # Validate required fields
    if 'size' not in data or not data['size']:
        return jsonify({'error': 'size is required'}), 400
    if 'quantity' not in data:
        return jsonify({'error': 'quantity is required'}), 400

    try:
        quantity = int(data['quantity'])
        if quantity < 1:
            return jsonify({'error': 'quantity must be positive'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'quantity must be an integer'}), 400

    # Optional position
    position = data.get('position')
    if position is not None:
        try:
            position = int(position)
        except (ValueError, TypeError):
            return jsonify({'error': 'position must be an integer'}), 400

    item = OrderItem(
        order_id=order.id,
        size=data['size'],
        quantity=quantity,
        position=position
    )
    db.session.add(item)
    log_activity(order_id, 'Item Created', f"Size: {item.size}, Qty: {item.quantity}")
    db.session.commit()

    return jsonify(item.to_dict()), 201


@orders_bp.route('/orders/<int:order_id>/items/<int:item_id>', methods=['GET'])
def get_order_item(order_id, item_id):
    """Get a specific order item"""
    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first_or_404()
    return jsonify(item.to_dict(with_media=True)), 200


@orders_bp.route('/orders/<int:order_id>/items/<int:item_id>', methods=['PUT'])
def update_order_item(order_id, item_id):
    """Update an order item"""
    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first_or_404()
    data = request.get_json()

    if 'size' in data and data['size']:
        old_size = item.size
        item.size = data['size']
    if 'quantity' in data:
        try:
            quantity = int(data['quantity'])
            if quantity < 1:
                return jsonify({'error': 'quantity must be positive'}), 400
            item.quantity = quantity
        except (ValueError, TypeError):
            return jsonify({'error': 'quantity must be an integer'}), 400
    if 'position' in data:
        if data['position'] is not None:
            try:
                item.position = int(data['position'])
            except (ValueError, TypeError):
                return jsonify({'error': 'position must be an integer'}), 400
        else:
            item.position = None

    log_activity(order_id, 'Item Updated', f"Item {item_id} updated")
    db.session.commit()

    return jsonify(item.to_dict()), 200


@orders_bp.route('/orders/<int:order_id>/items/<int:item_id>', methods=['DELETE'])
def delete_order_item(order_id, item_id):
    """Delete an order item (cascades to its media)"""
    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first_or_404()
    db.session.delete(item)
    log_activity(order_id, 'Item Deleted', f"Item {item_id} removed")
    db.session.commit()

    return jsonify({'message': 'Item deleted'}), 200


@orders_bp.route('/orders/print', methods=['GET'])
def print_orders():
    """
    Generate a print-friendly HTML page for selected orders.
    Expects order_ids as comma-separated query param: ?order_ids=1,2,3
    Optional: columns param as JSON string: ?columns={"order_id":true,...}
    This page is styled for printing and auto-opens the print dialog.
    """
    order_ids_param = request.args.get('order_ids', '')
    if not order_ids_param:
        return jsonify({'error': 'order_ids parameter is required'}), 400

    try:
        order_ids = [int(id.strip()) for id in order_ids_param.split(',') if id.strip()]
    except ValueError:
        return jsonify({'error': 'Invalid order IDs'}), 400

    if not order_ids:
        return jsonify({'error': 'No valid order IDs provided'}), 400

    # Parse optional columns parameter
    columns = None
    columns_param = request.args.get('columns', None)
    if columns_param:
        try:
            import json
            columns = json.loads(columns_param)
            # Validate it's a dict with boolean values
            if not isinstance(columns, dict):
                columns = None
        except (json.JSONDecodeError, TypeError):
            columns = None

    # Fetch orders with items and their media, and status, and order-level media
    orders = Order.query.options(
        selectinload(Order.items).selectinload(OrderItem.media),
        selectinload(Order.status),
        selectinload(Order.media)
    ).filter(Order.id.in_(order_ids)).all()

    # Build base URL for media files
    base_url = request.host_url.rstrip('/')

    # Generate HTML with columns filter
    html_content = generate_print_html(orders, base_url, columns)

    return Response(html_content, mimetype='text/html')


def generate_print_html(orders, base_url, columns=None):
    """Generate HTML for print view with selected columns"""

    # Default columns (all)
    if columns is None:
        columns = {
            'order_id': True,
            'customer_name': True,
            'phone_number': True,
            'address': True,
            'description': True,
            'price': True,
            'payment_type': True,
            'courier_parcel_id': True,
            'created_at': True,
            'items': True,
            'attachments': False
        }

    # Get current date for header
    print_date = datetime.utcnow().strftime('%Y-%m-%d %H:%M')

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Print Orders</title>
    <style>
        @media print {{
            @page {{
                size: A4;
                margin: 0.5cm;
            }}
            body {{
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }}
        }}

        * {{
            box-sizing: border-box;
        }}

        body {{
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: #000;
        }}

        .header {{
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }}

        .header h1 {{
            margin: 0 0 10px 0;
            font-size: 24pt;
        }}

        .header p {{
            margin: 5px 0;
            font-size: 10pt;
            color: #555;
        }}

        .order {{
            page-break-inside: avoid;
            margin-bottom: 40px;
            border: 1px solid #ddd;
            padding: 20px;
            background: #fafafa;
        }}

        .order-header {{
            margin-bottom: 15px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 10px;
        }}

        .order-title {{
            font-size: 18pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }}

        .order-details {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
            font-size: 11pt;
        }}

        .order-detail-item {{
            margin: 0;
        }}

        .order-detail-label {{
            font-weight: bold;
            color: #333;
        }}

        .items-section {{
            margin-top: 15px;
        }}

        .section-title {{
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }}

        .items-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin-top: 5px;
        }}

        .items-table th {{
            background: #e0e0e0;
            padding: 8px;
            text-align: left;
            border: 1px solid #ccc;
        }}

        .items-table td {{
            padding: 8px;
            border: 1px solid #ccc;
            vertical-align: top;
        }}

        .images-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 8px;
            margin-top: 4px;
        }}

        .image-item {{
            text-align: center;
        }}

        .image-item img {{
            max-width: 80px;
            max-height: 80px;
            object-fit: contain;
            border: 1px solid #ccc;
            background: white;
        }}

        .image-item p {{
            font-size: 8pt;
            margin: 3px 0 0 0;
            word-break: break-all;
        }}

        .footer {{
            margin-top: 20px;
            text-align: center;
            font-size: 9pt;
            color: #777;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }}

        .no-data {{
            color: #999;
            font-style: italic;
            font-size: 10pt;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Order Printout</h1>
        <p>Generated on: {print_date}</p>
        <p>Total Orders: {len(orders)}</p>
    </div>
"""

    for order in orders:
        html += f"""
        <div class="order">
            <div class="order-header">
                <div class="order-title">Order #{order.id}</div>
                <div class="order-details">
"""

        # Dynamically add selected field rows
        if columns.get('customer_name'):
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Customer:</span> {order.customer_name or ''}</div>
"""
        if columns.get('phone_number'):
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Phone:</span> {order.phone_number or ''}</div>
"""
        if columns.get('address'):
            address_parts = [order.address or '', order.upazila_zone or '', order.district or '', order.division or '']
            full_address = ', '.join([p for p in address_parts if p])
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Address:</span> {full_address}</div>
"""
        if columns.get('description'):
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Description:</span> {order.description or ''}</div>
"""
        if columns.get('price'):
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Price:</span> ৳{order.price or 0}</div>
"""
        if columns.get('payment_type'):
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Payment:</span> {order.payment_type or ''}</div>
"""
        if columns.get('courier_parcel_id'):
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Courier Parcel ID:</span> {order.courier_parcel_id or 'N/A'}</div>
"""
        if columns.get('created_at'):
            created_date = order.created_at.strftime('%Y-%m-%d') if order.created_at else 'N/A'
            html += f"""                    <div class="order-detail-item"><span class="order-detail-label">Created:</span> {created_date}</div>
"""
        # Attachments / Design Files
        if columns.get('attachments'):
            attachments = [m for m in order.media if m.item_id is None]
            if attachments:
                html_parts = ['<div class="images-grid" style="margin-top:4px;">']
                for m in attachments:
                    # Determine display URL
                    if m.file_url and (m.file_url.startswith('http') or m.file_url.startswith('//')):
                        media_url = m.file_url if m.file_url.startswith('http') else f"https:{m.file_url}"
                    else:
                        media_url = f"{base_url}/{m.file_url.lstrip('/')}" if m.file_url else ''
                    filename = m.file_path.split('/')[-1] if m.file_path else 'attachment'
                    if media_url:
                        if m.file_type == 'Image':
                            html_parts.append(f'''
                                <div class="image-item">
                                    <img src="{media_url}" alt="Attachment" loading="lazy">
                                    <p>{filename}</p>
                                </div>
                            ''')
                        else:
                            # For non-image files, show a document icon
                            html_parts.append(f'''
                                <div class="image-item" style="display:flex;align-items:center;justify-content:center;flex-direction:column;">
                                    <svg class="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <p style="font-size:8pt;margin:3px 0 0 0;">{filename}</p>
                                </div>
                            ''')
                html_parts.append('</div>')
                attachments_html = ''.join(html_parts)
            else:
                attachments_html = '<span class="no-data">No attachments</span>'
            html += f'''                <div class="order-detail-item"><span class="order-detail-label">Attachments:</span> {attachments_html}</div>
'''

        html += """                </div>
            </div>
"""

        # Items section
        if columns.get('items') and order.items:
            html += """
            <div class="items-section">
                <div class="section-title">Order Items</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Size</th>
                            <th>Quantity</th>
                            <th>Front Design Images</th>
                            <th>Back Design Images</th>
                        </tr>
                    </thead>
                    <tbody>
"""
            for item in order.items:
                # Get front and back images
                front_images = [m for m in item.media if m.side == 'front'] if hasattr(item, 'media') else []
                back_images = [m for m in item.media if m.side == 'back'] if hasattr(item, 'media') else []

                def build_images_html(images):
                    if not images:
                        return '<span class="no-data">No images</span>'
                    html_parts = ['<div class="images-grid">']
                    for img in images:
                        if img.file_url and (img.file_url.startswith('http') or img.file_url.startswith('//')):
                            img_url = img.file_url if img.file_url.startswith('http') else f"https:{img.file_url}"
                        else:
                            img_url = f"{base_url}/{img.file_url.lstrip('/')}" if img.file_url else ''
                        if img_url:
                            html_parts.append(f'''
                                <div class="image-item">
                                    <img src="{img_url}" alt="Image" loading="lazy">
                                    <p>{img.file_path.split('/')[-1] if img.file_path else 'image'}</p>
                                </div>
                            ''')
                    html_parts.append('</div>')
                    return ''.join(html_parts)

                front_html = build_images_html(front_images)
                back_html = build_images_html(back_images)

                html += f"""
                        <tr>
                            <td>{item.size or ''}</td>
                            <td>{item.quantity or ''}</td>
                            <td>{front_html}</td>
                            <td>{back_html}</td>
                        </tr>
"""
            html += """
                    </tbody>
                </table>
            </div>
"""
        elif columns.get('items'):
            html += """            <p class="no-data">No items in this order.</p>
"""

        html += """
            <div class="footer">
                — End of Order —
            </div>
        </div>
"""

    html += """
    <script>
        // Auto-open print dialog when page loads
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</body>
</html>"""

    return html


# Model serialization helpers
def to_dict(self, with_status=False, with_media=False, with_items=False):
    import json
    # Parse design_file_url JSON string into array for API response
    design_files = []
    if self.design_file_url:
        try:
            design_files = json.loads(self.design_file_url)
        except (json.JSONDecodeError, TypeError):
            design_files = []

    data = {
        'id': self.id,
        'customer_name': self.customer_name,
        'phone_number': self.phone_number,
        'division': self.division,
        'district': self.district,
        'upazila_zone': self.upazila_zone,
        'address': self.address,
        'description': self.description,
        'price': self.price,
        'payment_type': self.payment_type,
        'courier_parcel_id': self.courier_parcel_id,
        'position': self.position,
        'design_file_url': design_files,  # Return as array
        'created_at': self.created_at.isoformat() if self.created_at else None,
        'updated_at': self.updated_at.isoformat() if self.updated_at else None
    }
    if with_status and self.status:
        data['status'] = {
            'design_ready': self.status.design_ready,
            'is_printed': self.status.is_printed,
            'picking_done': self.status.picking_done,
            'delivery_status': self.status.delivery_status
        }
    if with_media:
        data['media'] = []
        for m in self.media:
            # Only include order-level media (item_id is NULL) to avoid duplication with items
            if m.item_id is not None:
                continue
            # Use file_url if available (Cloudinary or local full URL), otherwise construct URL
            if m.file_url:
                display_url = m.file_url
            else:
                # For local files stored without full URL, construct it (relative URL)
                display_url = f"/uploads/{m.file_path.replace(os.sep, '/')}"
            data['media'].append({
                'id': m.id,
                'file_path': m.file_path,
                'file_url': display_url,
                'file_type': m.file_type,
                'side': m.side  # include side for order-level media (usually NULL)
            })
    if with_items:
        data['items'] = [item.to_dict(with_media=True) for item in self.items]
    return data

def status_to_dict(self):
    return {
        'id': self.id,
        'order_id': self.order_id,
        'design_ready': self.design_ready,
        'is_printed': self.is_printed,
        'picking_done': self.picking_done,
        'delivery_status': self.delivery_status,
        'updated_at': self.updated_at.isoformat() if self.updated_at else None
    }

Order.to_dict = to_dict
OrderStatus.to_dict = status_to_dict
