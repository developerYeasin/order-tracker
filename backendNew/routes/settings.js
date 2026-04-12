const express = require('express');
const { Setting, Order, OrderItem } = require('../models');
const { adminRequired } = require('../middleware/auth');
const SteadfastService = require('../services/steadfastService');

const router = express.Router();

router.get('/settings', adminRequired, async (req, res) => {
  const categories = await Setting.findAll({ attributes: ['category'], group: ['category'] });
  const result = {};
  for (const row of categories) {
    const settings = await Setting.findAll({ where: { category: row.category }, order: [['settings_key', 'ASC']] });
    result[row.category] = await Promise.all(settings.map(async (s) => ({
      id: s.id,
      key: s.settings_key,
      value: s.is_encrypted ? await Setting.getValue(s.settings_key) : s.settings_value,
      type: s.type,
      category: s.category,
      description: s.description,
      is_encrypted: s.is_encrypted,
      updated_at: s.updated_at ? s.updated_at.toISOString() : null
    })));
  }
  res.json(result);
});

router.post('/settings', adminRequired, async (req, res) => {
  const { key, value, type = 'string', category = 'general', description, is_encrypted = false } = req.body;
  if (!key) return res.status(400).json({ error: 'Setting key is required' });

  const setting = await Setting.setValue({
    key,
    value,
    type,
    category,
    description,
    is_encrypted: Boolean(is_encrypted)
  });

  res.json({
    message: 'Setting saved',
    setting: {
      key: setting.settings_key,
      value: setting.is_encrypted ? await Setting.getValue(setting.settings_key) : setting.settings_value,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      is_encrypted: setting.is_encrypted
    }
  });
});

router.delete('/settings/:key', adminRequired, async (req, res) => {
  const success = await Setting.deleteByKey(req.params.key);
  if (success) return res.json({ message: 'Setting deleted' });
  res.status(404).json({ error: 'Setting not found' });
});

router.post('/settings/steadfast/test', adminRequired, async (req, res) => {
  const service = new SteadfastService();
  if (!(await service.isConfigured())) {
    return res.status(400).json({ error: 'Steadfast credentials not configured. Please save API key and secret first.' });
  }
  try {
    const result = await service.getCurrentBalance();
    res.json({ success: true, message: 'Successfully connected to Steadfast API', balance: result });
  } catch (err) {
    res.status(400).json({ success: false, message: `Failed to connect to Steadfast: ${err.message}` });
  }
});

router.post('/settings/steadfast/order/:orderId', adminRequired, async (req, res) => {
  const order = await Order.findByPk(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.courier_parcel_id) return res.status(400).json({ error: 'Order already has a courier tracking ID' });

  const service = new SteadfastService();
  if (!(await service.isConfigured())) return res.status(400).json({ error: 'Steadfast not configured' });

  const orderItems = await OrderItem.findAll({ where: { order_id: order.id } });
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemDescription = orderItems.length > 0 ? `Items: ${orderItems.map((item) => `${item.size} (${item.quantity})`).join(', ')}` : null;
  const noteParts = [];
  if (order.description) noteParts.push(order.description.slice(0, 300));
  if (itemDescription) noteParts.push(itemDescription);
  const combinedNote = noteParts.length ? noteParts.join(' | ') : null;
  const recipientAddress = order.address ? order.address : `${order.division || ''}, ${order.district || ''}, ${order.upazila_zone || ''}`;

  try {
    const result = await service.createOrder({
      invoice: `ORD-${order.id}`,
      recipient_name: order.customer_name,
      recipient_phone: order.phone_number,
      recipient_address: recipientAddress,
      cod_amount: order.price || 0,
      note: combinedNote ? combinedNote.slice(0, 500) : undefined,
      item_description: itemDescription ? itemDescription.slice(0, 500) : undefined,
      total_lot: totalQuantity > 0 ? totalQuantity : undefined
    });

    if (result.status === 200 && result.consignment) {
      order.courier_parcel_id = String(result.consignment.consignment_id);
      await order.save();
      return res.json({ success: true, message: 'Courier consignment created', consignment: result.consignment });
    }

    return res.status(400).json({ error: 'Failed to create consignment', details: result });
  } catch (err) {
    return res.status(400).json({ error: `Failed to create courier consignment: ${err.message}` });
  }
});

module.exports = router;
