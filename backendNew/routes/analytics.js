const express = require('express');
const { Op, fn, col } = require('sequelize');
const { Order, OrderStatus } = require('../models');

const router = express.Router();

router.get('/analytics/dashboard', async (req, res) => {
  const totalOrders = await Order.count();
  const designPending = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { design_ready: false } }] });
  const designReady = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { design_ready: true } }] });
  const printed = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { is_printed: true } }] });
  const picked = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { picking_done: true } }] });
  const submitted = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { delivery_status: 'Submitted' } }] });
  const delivered = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { delivery_status: 'Delivered' } }] });
  const returned = await Order.count({ include: [{ model: OrderStatus, as: 'status', where: { delivery_status: 'Returned' } }] });
  const totalDelivered = delivered + returned;
  const deliverySuccessRate = totalDelivered > 0 ? Math.round((delivered / totalDelivered) * 1000) / 10 : 0;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentOrders = await Order.count({ where: { created_at: { [Op.gte]: weekAgo } } });

  res.json({
    total_orders: totalOrders,
    pending_designs: designPending,
    ready_to_print: Math.max(designReady - printed, 0),
    printed_not_picked: Math.max(printed - picked, 0),
    out_for_delivery: submitted,
    delivered,
    returned,
    delivery_success_rate: deliverySuccessRate,
    recent_orders: recentOrders
  });
});

router.get('/analytics/regions', async (req, res) => {
  const divisionFilter = req.query.division || '';
  const where = {};
  if (divisionFilter) where.division = { [Op.like]: `%${divisionFilter}%` };

  const results = await Order.findAll({
    attributes: ['division', 'district', [fn('COUNT', col('Order.id')), 'count']],
    where,
    group: ['division', 'district'],
    order: [[fn('COUNT', col('Order.id')), 'DESC']]
  });

  const breakdown = {};
  results.forEach((row) => {
    const div = row.division || 'Unknown';
    const dist = row.district || 'Unknown';
    if (!breakdown[div]) breakdown[div] = {};
    breakdown[div][dist] = Number(row.get('count'));
  });

  res.json(breakdown);
});

router.get('/analytics/trends', async (req, res) => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 30);

  const results = await Order.findAll({
    attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
    where: { created_at: { [Op.gte]: startDate } },
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']]
  });

  res.json(results.map((row) => ({ date: row.get('date'), count: Number(row.get('count')) })));
});

module.exports = router;
