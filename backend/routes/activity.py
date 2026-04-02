from flask import Blueprint, request, jsonify
from models import db, Order, ActivityLog

activity_bp = Blueprint('activity', __name__)

@activity_bp.route('/activity/logs', methods=['GET'])
def get_activity_logs():
    order_id = request.args.get('order_id', type=int)
    limit = request.args.get('limit', 50, type=int)

    query = ActivityLog.query

    if order_id:
        query = query.filter(ActivityLog.order_id == order_id)

    logs = query.order_by(ActivityLog.timestamp.desc()).limit(limit).all()

    result = []
    for log in logs:
        result.append({
            'id': log.id,
            'order_id': log.order_id,
            'action': log.action,
            'details': log.details,
            'timestamp': log.timestamp.isoformat() if log.timestamp else None
        })

    return jsonify(result), 200

@activity_bp.route('/activity/recent', methods=['GET'])
def get_recent_activity():
    limit = request.args.get('limit', 10, type=int)
    logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(limit).all()

    result = []
    for log in logs:
        order = Order.query.get(log.order_id)
        result.append({
            'id': log.id,
            'order_id': log.order_id,
            'customer_name': order.customer_name if order else 'Unknown',
            'action': log.action,
            'details': log.details,
            'timestamp': log.timestamp.isoformat() if log.timestamp else None
        })

    return jsonify(result), 200
