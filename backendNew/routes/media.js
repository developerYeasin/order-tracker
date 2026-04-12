const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Order, OrderItem, Media } = require('../models');
const config = require('../config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const allowedFile = (filename) => {
  return filename && filename.includes('.') && config.allowedExtensions.has(filename.split('.').pop().toLowerCase());
};

const ensureUploadDir = (folder) => fs.mkdirSync(folder, { recursive: true });

const deleteMediaFile = async (media) => {
  if (!media.file_path) return;
  if (config.cloudinary.enabled && media.file_path.startsWith('order_tracker')) {
    try {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret
      });
      await cloudinary.uploader.destroy(media.file_path);
    } catch (err) {
      console.warn('Cloudinary delete error:', err.message);
    }
  } else {
    const filePath = path.isAbsolute(media.file_path)
      ? media.file_path
      : path.resolve(config.app.uploadFolder, media.file_path);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      // ignore
    }
  }
};

router.get('/orders/:orderId/media', async (req, res) => {
  const order = await Order.findByPk(req.params.orderId, { include: [{ model: Media, as: 'media' }] });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const result = (order.media || [])
    .filter((m) => m.item_id === null)
    .map((m) => ({
      id: m.id,
      file_path: m.file_path,
      file_url: m.file_url || `/uploads/${m.file_path.replace(/\\/g, '/')}`,
      file_type: m.file_type,
      side: m.side,
      is_design: m.is_design
    }));

  res.json(result);
});

router.post('/orders/:orderId/media', upload.array('files'), async (req, res) => {
  const order = await Order.findByPk(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const files = req.files || [];
  const itemId = req.body.item_id ? parseInt(req.body.item_id, 10) : null;
  const side = req.body.side;
  const isDesign = String(req.body.is_design).toLowerCase() === 'true';

  if (itemId) {
    const item = await OrderItem.findOne({ where: { id: itemId, order_id: order.id } });
    if (!item) return res.status(404).json({ error: `Item ${itemId} not found for this order` });
  }
  if (side && !['front', 'back'].includes(side)) {
    return res.status(400).json({ error: "side must be 'front' or 'back'" });
  }

  const uploaded = [];
  if (config.cloudinary.enabled) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret
    });

    const uploadFile = (file, folder) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'auto' }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      stream.end(file.buffer);
    });

    for (const file of files) {
      if (!allowedFile(file.originalname)) continue;
      try {
        const folder = `order_tracker/order_${order.id}` + (itemId ? `/item_${itemId}` : '');
        const result = await uploadFile(file, folder);
        const fileType = result.resource_type === 'video' ? 'Video' : result.resource_type === 'image' ? 'Image' : 'File';
        const media = await Media.create({
          order_id: order.id,
          item_id: itemId,
          side: side || null,
          file_path: result.public_id,
          file_url: result.secure_url,
          file_type: fileType,
          is_design: isDesign
        });
        uploaded.push({
          id: media.id,
          filename: file.originalname,
          file_type: media.file_type,
          url: media.file_url,
          item_id: media.item_id,
          side: media.side,
          is_design: media.is_design
        });
      } catch (err) {
        console.warn('Cloudinary upload error:', err.message);
      }
    }
  } else {
    ensureUploadDir(config.app.uploadFolder);
    for (const file of files) {
      if (!allowedFile(file.originalname)) continue;
      const filename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const subfolder = itemId ? path.join(`order_${order.id}`, `item_${itemId}`) : `order_${order.id}`;
      const relativePath = path.join(subfolder, filename);
      const fullPath = path.resolve(config.app.uploadFolder, relativePath);
      ensureUploadDir(path.dirname(fullPath));
      fs.writeFileSync(fullPath, file.buffer);
      const ext = filename.split('.').pop().toLowerCase();
      const fileType = ['mp4', 'mov', 'avi', 'mkv', 'wmv'].includes(ext) ? 'Video' : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ? 'Image' : 'File';
      const fileUrl = `/uploads/${relativePath.split(path.sep).join('/')}`;
      const media = await Media.create({
        order_id: order.id,
        item_id: itemId,
        side: side || null,
        file_path: relativePath,
        file_url: fileUrl,
        file_type: fileType,
        is_design: isDesign
      });
      uploaded.push({
        id: media.id,
        filename: filename,
        file_type: media.file_type,
        url: media.file_url,
        item_id: media.item_id,
        side: media.side,
        is_design: media.is_design
      });
    }
  }

  res.json({ uploaded });
});

router.delete('/media/:mediaId', async (req, res) => {
  const media = await Media.findByPk(req.params.mediaId);
  if (!media) return res.status(404).json({ error: 'Media not found' });
  const order = await Order.findByPk(media.order_id);
  if (media.is_design && order) {
    let designFiles = [];
    try {
      designFiles = order.design_file_url ? JSON.parse(order.design_file_url) : [];
    } catch (err) {
      designFiles = [];
    }
    const remaining = designFiles.filter((entry) => entry.media_id !== media.id);
    order.design_file_url = JSON.stringify(remaining);
    await order.save();
  }
  await deleteMediaFile(media);
  await media.destroy();
  res.json({ message: 'Media deleted' });
});

router.get('/media/:mediaId/download', async (req, res) => {
  const media = await Media.findByPk(req.params.mediaId);
  if (!media) return res.status(404).json({ error: 'Media not found' });

  if (media.file_url && (config.cloudinary.enabled || media.file_url.startsWith('http'))) {
    return res.redirect(media.file_url);
  }

  if (!media.file_path) return res.status(404).json({ error: 'Media file path missing' });
  const filePath = path.isAbsolute(media.file_path)
    ? media.file_path
    : path.resolve(config.app.uploadFolder, media.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, path.basename(media.file_path));
});

module.exports = router;
