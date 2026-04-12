const express = require('express');
const { ActivityLog, Order } = require('../models');

const router = express.Router();

router.get('/activity/logs', async (req, res) => {
  const orderId = req.query.order_id ? Number(req.query.order_id) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const where = {};
  if (orderId) where.order_id = orderId;

  const logs = await ActivityLog.findAll({
    where,
    order: [['timestamp', 'DESC']],
    limit: Number.isNaN(limit) ? 50 : limit
  });

  res.json(logs.map((log) => ({
    id: log.id,
    order_id: log.order_id,
    action: log.action,
    details: log.details,
    timestamp: log.timestamp ? log.timestamp.toISOString() : null
  })));
});

router.get('/activity/recent', async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const logs = await ActivityLog.findAll({
    order: [['timestamp', 'DESC']],
    limit: Number.isNaN(limit) ? 10 : limit
  });

  const result = await Promise.all(logs.map(async (log) => {
    const order = log.order_id ? await Order.findByPk(log.order_id) : null;
    return {
      id: log.id,
      order_id: log.order_id,
      customer_name: order ? order.customer_name : 'Unknown',
      action: log.action,
      details: log.details,
      timestamp: log.timestamp ? log.timestamp.toISOString() : null
    };
  }));

  res.json(result);
});

module.exports = router;
