"""
Webhook endpoints for external services (Steadfast Courier)
"""

from flask import Blueprint, request, jsonify, current_app
from models import db, Setting, Order, OrderStatus, ActivityLog
from datetime import datetime

webhooks_bp = Blueprint('webhooks', __name__)


@webhooks_bp.route('/webhooks/steadfast', methods=['POST'])
def steadfast_webhook():
    """
    Receive webhook notifications from Steadfast Courier

    Expected headers:
    - Authorization: Bearer {auth_token}

    Payloads:
    1. Delivery Status Update
    2. Tracking Update
    """
    # Verify auth token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        current_app.logger.warning('Webhook received without valid Authorization header')
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    stored_token = Setting.get('steadfast_webhook_token')

    if not stored_token or token != stored_token:
        current_app.logger.warning('Webhook received with invalid token')
        return jsonify({'status': 'error', 'message': 'Invalid token'}), 401

    # Parse payload
    payload = request.get_json()
    if not payload:
        return jsonify({'status': 'error', 'message': 'Invalid JSON'}), 400

    notification_type = payload.get('notification_type')
    current_app.logger.info(f'Received Steadfast webhook: {notification_type}')

    try:
        if notification_type == 'delivery_status':
            return handle_delivery_status_update(payload)
        elif notification_type == 'tracking_update':
            return handle_tracking_update(payload)
        else:
            current_app.logger.warning(f'Unknown notification type: {notification_type}')
            return jsonify({'status': 'error', 'message': 'Unknown notification type'}), 400
    except Exception as e:
        current_app.logger.error(f'Webhook processing failed: {str(e)}', exc_info=True)
        return jsonify({'status': 'error', 'message': 'Processing failed'}), 500


def handle_delivery_status_update(payload):
    """Handle delivery status update webhook"""
    consignment_id = payload.get('consignment_id')
    invoice = payload.get('invoice')
    status = payload.get('status')
    tracking_message = payload.get('tracking_message', '')
    cod_amount = payload.get('cod_amount')
    delivery_charge = payload.get('delivery_charge')
    updated_at = payload.get('updated_at')

    # Find the order by consignment_id (courier_parcel_id) or invoice
    order = None
    if consignment_id:
        order = Order.query.filter_by(courier_parcel_id=str(consignment_id)).first()
    if not order and invoice:
        # Try to find by invoice number in courier_parcel_id or generate expected format
        # The system stores consignment_id as string, so look for exact match
        order = Order.query.filter_by(courier_parcel_id=str(invoice)).first()
        # Alternative: if invoice is the order ID, try that
        if not order:
            try:
                order_id_int = int(invoice) if str(invoice).isdigit() else None
                if order_id_int:
                    order = Order.query.get(order_id_int)
            except:
                pass

    if not order:
        current_app.logger.warning(f'Order not found for consignment_id={consignment_id}, invoice={invoice}')
        return jsonify({'status': 'error', 'message': 'Order not found'}), 404

    # Map Steadfast status to our system status
    status_mapping = {
        'pending': 'Submitted',
        'delivered': 'Delivered',
        'partial_delivered': 'Delivered',  # Treat partial as delivered
        'cancelled': 'Returned',
        'hold': 'Submitted',
        'in_review': 'Submitted',
        'delivered_approval_pending': 'Submitted',
        'partial_delivered_approval_pending': 'Submitted',
        'cancelled_approval_pending': 'Returned',
        'unknown_approval_pending': 'Submitted',
        'unknown': 'Submitted'
    }

    mapped_status = status_mapping.get(status.lower() if status else 'pending')

    # Update order status
    if order.status:
        order.status.delivery_status = mapped_status
        order.status.updated_at = datetime.utcnow()
    else:
        order.status = OrderStatus(delivery_status=mapped_status)

    # Log activity
    activity = ActivityLog(
        order_id=order.id,
        action='delivery_status_updated',
        details=f'Steadfast webhook: {status} - {tracking_message}',
        timestamp=datetime.utcnow()
    )
    db.session.add(activity)

    db.session.commit()

    current_app.logger.info(f'Order #{order.id} delivery status updated to {mapped_status} from Steadfast webhook')

    return jsonify({
        'status': 'success',
        'message': 'Delivery status updated',
        'order_id': order.id,
        'new_status': mapped_status
    }), 200


def handle_tracking_update(payload):
    """Handle tracking update webhook"""
    consignment_id = payload.get('consignment_id')
    invoice = payload.get('invoice')
    tracking_message = payload.get('tracking_message', '')
    updated_at = payload.get('updated_at')

    # Find the order (same logic as above)
    order = None
    if consignment_id:
        order = Order.query.filter_by(courier_parcel_id=str(consignment_id)).first()
    if not order and invoice:
        order = Order.query.filter_by(courier_parcel_id=str(invoice)).first()
        if not order:
            try:
                order_id_int = int(invoice) if str(invoice).isdigit() else None
                if order_id_int:
                    order = Order.query.get(order_id_int)
            except:
                pass

    if not order:
        current_app.logger.warning(f'Order not found for consignment_id={consignment_id}, invoice={invoice}')
        return jsonify({'status': 'error', 'message': 'Order not found'}), 404

    # Log tracking update as activity
    activity = ActivityLog(
        order_id=order.id,
        action='tracking_updated',
        details=f'Steadfast tracking: {tracking_message}',
        timestamp=datetime.utcnow()
    )
    db.session.add(activity)
    db.session.commit()

    current_app.logger.info(f'Order #{order.id} tracking updated: {tracking_message}')

    return jsonify({
        'status': 'success',
        'message': 'Tracking update received',
        'order_id': order.id
    }), 200
