from flask import Blueprint, request, jsonify
from models import db, Order, OrderStatus, ActivityLog
from datetime import datetime, timedelta

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/analytics/dashboard', methods=['GET'])
def get_dashboard_stats():
    total_orders = Order.query.count()

    # Status counts
    design_pending = Order.query.join(OrderStatus).filter(OrderStatus.design_ready == False).count()
    design_ready = Order.query.join(OrderStatus).filter(OrderStatus.design_ready == True).count()
    printed = Order.query.join(OrderStatus).filter(OrderStatus.is_printed == True).count()
    picked = Order.query.join(OrderStatus).filter(OrderStatus.picking_done == True).count()
    submitted = Order.query.join(OrderStatus).filter(OrderStatus.delivery_status == 'Submitted').count()
    delivered = Order.query.join(OrderStatus).filter(OrderStatus.delivery_status == 'Delivered').count()
    returned = Order.query.join(OrderStatus).filter(OrderStatus.delivery_status == 'Returned').count()

    total_delivered = delivered + returned
    delivery_success_rate = round((delivered / total_delivered) * 100, 1) if total_delivered > 0 else 0

    # Recent orders (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_orders = Order.query.filter(Order.created_at >= week_ago).count()

    stats = {
        'total_orders': total_orders,
        'pending_designs': design_pending,
        'ready_to_print': design_ready - printed,  # Ready but not yet printed
        'printed_not_picked': printed - picked,   # Printed but not picked
        'out_for_delivery': submitted,
        'delivered': delivered,
        'returned': returned,
        'delivery_success_rate': delivery_success_rate,
        'recent_orders': recent_orders
    }

    return jsonify(stats), 200

@analytics_bp.route('/analytics/regions', methods=['GET'])
def get_regional_breakdown():
    division = request.args.get('division', '')

    query = db.session.query(
        Order.division,
        Order.district,
        db.func.count(Order.id).label('count')
    ).group_by(Order.division, Order.district)

    if division:
        query = query.filter(Order.division.ilike(f'%{division}%'))

    results = query.order_by(db.desc('count')).all()

    breakdown = {}
    for div, dist, count in results:
        if div not in breakdown:
            breakdown[div] = {}
        breakdown[div][dist] = count

    return jsonify(breakdown), 200

@analytics_bp.route('/analytics/trends', methods=['GET'])
def get_order_trends():
    # Last 30 days trends
    days = 30
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    orders_by_date = db.session.query(
        db.func.date(Order.created_at).label('date'),
        db.func.count(Order.id).label('count')
    ).filter(Order.created_at >= start_date).group_by(db.func.date(Order.created_at)).all()

    trends = [{'date': str(date), 'count': count} for date, count in orders_by_date]

    return jsonify(trends), 200
