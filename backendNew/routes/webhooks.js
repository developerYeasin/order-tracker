const express = require('express');
const { Setting, Order, OrderStatus, ActivityLog } = require('../models');

const router = express.Router();

const mapStatus = (status) => {
  if (!status) return 'Submitted';
  switch (status.toLowerCase()) {
    case 'pending': return 'Submitted';
    case 'delivered':
    case 'partial_delivered': return 'Delivered';
    case 'cancelled':
    case 'cancelled_approval_pending': return 'Returned';
    case 'hold':
    case 'in_review':
    case 'delivered_approval_pending':
    case 'partial_delivered_approval_pending':
    case 'unknown_approval_pending':
    case 'unknown':
    default: return 'Submitted';
  }
};

router.post('/webhooks/steadfast', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  const token = authHeader.slice(7).trim();
  const storedToken = await Setting.getValue('steadfast_webhook_token');
  if (!storedToken || token !== storedToken) {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }

  const payload = req.body;
  if (!payload) return res.status(400).json({ status: 'error', message: 'Invalid JSON' });

  const notificationType = payload.notification_type;
  if (notificationType === 'delivery_status') {
    return handleDeliveryStatusUpdate(payload, res);
  }
  if (notificationType === 'tracking_update') {
    return handleTrackingUpdate(payload, res);
  }

  return res.status(400).json({ status: 'error', message: 'Unknown notification type' });
});

const handleDeliveryStatusUpdate = async (payload, res) => {
  const consignmentId = payload.consignment_id;
  const invoice = payload.invoice;
  const status = payload.status;
  const trackingMessage = payload.tracking_message || '';

  let order = null;
  if (consignmentId) {
    order = await Order.findOne({ where: { courier_parcel_id: String(consignmentId) } });
  }
  if (!order && invoice) {
    order = await Order.findOne({ where: { courier_parcel_id: String(invoice) } });
    if (!order && Number.isInteger(Number(invoice))) {
      order = await Order.findByPk(Number(invoice));
    }
  }

  if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

  let statusRecord = await OrderStatus.findOne({ where: { order_id: order.id } });
  if (!statusRecord) {
    statusRecord = await OrderStatus.create({ order_id: order.id });
  }

  statusRecord.delivery_status = mapStatus(status);
  await statusRecord.save();

  await ActivityLog.create({
    order_id: order.id,
    action: 'delivery_status_updated',
    details: `Steadfast webhook: ${status} - ${trackingMessage}`
  });

  return res.json({ status: 'success', message: 'Delivery status updated', order_id: order.id, new_status: statusRecord.delivery_status });
};

const handleTrackingUpdate = async (payload, res) => {
  const consignmentId = payload.consignment_id;
  const invoice = payload.invoice;
  const trackingMessage = payload.tracking_message || '';

  let order = null;
  if (consignmentId) {
    order = await Order.findOne({ where: { courier_parcel_id: String(consignmentId) } });
  }
  if (!order && invoice) {
    order = await Order.findOne({ where: { courier_parcel_id: String(invoice) } });
    if (!order && Number.isInteger(Number(Number(invoice)))) {
      order = await Order.findByPk(Number(invoice));
    }
  }

  if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

  await ActivityLog.create({
    order_id: order.id,
    action: 'tracking_updated',
    details: `Steadfast tracking: ${trackingMessage}`
  });

  return res.json({ status: 'success', message: 'Tracking update received', order_id: order.id });
};

module.exports = router;
