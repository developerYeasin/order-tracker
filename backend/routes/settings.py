"""
Settings API endpoints
"""

import os
from flask import Blueprint, request, jsonify, current_app
from extensions import db
from models import Setting
from decorators import token_required, admin_required
from steadfast_service import SteadfastService

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/settings', methods=['GET'])
@admin_required
def get_settings(current_user):
    """Get all settings grouped by category"""
    try:
        categories = db.session.query(Setting.category).distinct().all()
        result = {}
        for (cat,) in categories:
            settings = Setting.query.filter_by(category=cat).order_by(Setting.settings_key).all()
            result[cat] = []
            for s in settings:
                # Get decrypted value for encrypted settings
                value = Setting.get(s.settings_key) if s.is_encrypted else s.settings_value
                result[cat].append({
                    'id': s.id,
                    'key': s.settings_key,
                    'value': value,
                    'type': s.type,
                    'category': s.category,
                    'description': s.description,
                    'is_encrypted': s.is_encrypted,
                    'updated_at': s.updated_at.isoformat() if s.updated_at else None
                })
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f'Failed to get settings: {str(e)}')
        return jsonify({'error': 'Failed to fetch settings'}), 500


@settings_bp.route('/settings', methods=['POST'])
@admin_required
def update_setting(current_user):
    """Update or create a setting"""
    data = request.get_json()

    if 'key' not in data:
        return jsonify({'error': 'Setting key is required'}), 400

    key = data['key']
    value = data.get('value')
    type_val = data.get('type', 'string')
    category = data.get('category', 'general')
    description = data.get('description')
    is_encrypted = data.get('is_encrypted', False)

    try:
        setting = Setting.set(
            key=key,
            value=value,
            type=type_val,
            category=category,
            description=description,
            is_encrypted=is_encrypted
        )
        return jsonify({
            'message': 'Setting saved',
            'setting': {
                'key': setting.settings_key,
                'value': Setting.get(key) if is_encrypted else value,
                'type': setting.type,
                'category': setting.category,
                'description': setting.description,
                'is_encrypted': setting.is_encrypted
            }
        }), 200
    except Exception as e:
        current_app.logger.error(f'Failed to save setting {key}: {str(e)}')
        return jsonify({'error': 'Failed to save setting'}), 500


@settings_bp.route('/settings/<string:key>', methods=['DELETE'])
@admin_required
def delete_setting(current_user, key):
    """Delete a setting"""
    try:
        success = Setting.delete(key)
        if success:
            return jsonify({'message': 'Setting deleted'}), 200
        else:
            return jsonify({'error': 'Setting not found'}), 404
    except Exception as e:
        current_app.logger.error(f'Failed to delete setting {key}: {str(e)}')
        return jsonify({'error': 'Failed to delete setting'}), 500


@settings_bp.route('/settings/steadfast/test', methods=['POST'])
@admin_required
def test_steadfast_connection(current_user):
    """Test Steadfast API credentials"""
    try:
        service = SteadfastService()
        if not service.is_configured():
            return jsonify({'error': 'Steadfast credentials not configured. Please save API key and secret first.'}), 400

        # Try to get balance as a simple test
        result = service.get_current_balance()
        return jsonify({
            'success': True,
            'message': 'Successfully connected to Steadfast API',
            'balance': result
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to connect to Steadfast: {str(e)}'
        }), 400


@settings_bp.route('/settings/steadfast/order/<int:order_id>', methods=['POST'])
@admin_required
def create_steadfast_order(current_user, order_id):
    """Create Steadfast consignment for an order"""
    from models import Order, OrderItem, Media

    try:
        order = Order.query.get_or_404(order_id)

        # Check if already has consignment ID
        if order.courier_parcel_id:
            return jsonify({'error': 'Order already has a courier tracking ID'}), 400

        # Get Steadfast service
        service = SteadfastService()
        if not service.is_configured():
            return jsonify({'error': 'Steadfast not configured'}), 400

        # Calculate total quantity from items (query directly to avoid relationship issues)
        order_items = OrderItem.query.filter_by(order_id=order.id).all()
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

        # Build order data
        order_data = {
            'invoice': f"ORD-{order.id}",
            'recipient_name': order.customer_name,
            'recipient_phone': order.phone_number,
            'recipient_address': order.address or f"{order.division}, {order.district}, {order.upazila_zone}",
            'cod_amount': float(order.price) if order.price else 0,
            'note': combined_note[:500] if combined_note else None,
            # Include item_description as well for api compatibility
            'item_description': item_description[:500] if item_description else None,
            'total_lot': total_quantity if total_quantity > 0 else None
        }

        result = service.create_order(order_data)

        # If successful, store consignment_id in order
        if result.get('status') == 200 and result.get('consignment'):
            consignment = result['consignment']
            order.courier_parcel_id = str(consignment.get('consignment_id'))
            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Courier consignment created',
                'consignment': consignment
            }), 200
        else:
            return jsonify({'error': 'Failed to create consignment', 'details': result}), 400

    except Exception as e:
        current_app.logger.error(f'Steadfast order creation failed: {str(e)}')
        return jsonify({'error': f'Failed to create courier consignment: {str(e)}'}), 400
