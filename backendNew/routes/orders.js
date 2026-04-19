const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { Op } = require("sequelize");
const {
  Order,
  OrderStatus,
  ActivityLog,
  OrderItem,
  Media,
  Setting,
} = require("../models");
const SteadfastService = require("../services/steadfastService");
const config = require("../config");
const { adminRequired, tokenRequired } = require("../middleware/auth");


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Generic upload endpoint for multiple images/files
router.post("/uploads", upload.array("files"), async (req, res) => {
  try {
    console.log('--- /uploads called ---');
    console.log('req.files:', req.files);
    console.log('req.body:', req.body);
    const files = req.files || [];
    const context = req.body.context || null; // e.g., 'order', 'item', etc.
    let contextId = req.body.context_id || null;
    const side = req.body.side || null;

    // If context_id is a temporary ID from frontend (e.g. "temp-0"), treat as URL-only mode
    // to avoid database errors when trying to associate with non-existent IDs.
    if (contextId && String(contextId).startsWith('temp-')) {
      contextId = null;
    }

    if (!files.length) {
      console.warn('No files uploaded');
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Optionally associate with order/item/media if context is provided
    let uploaded = [];
    const getFileType = (filename) => {
      const ext = filename.split(".").pop().toLowerCase();
      if (["mp4", "mov", "avi", "mkv", "wmv"].includes(ext)) return "Video";
      if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "Image";
      return "File";
    };
    // If uploading for an item, look up the order_id for the item (for direct-save mode)
    let itemOrderId = null;
    if (context === "item" && contextId) {
      const item = await OrderItem.findByPk(contextId);
      if (item) itemOrderId = item.order_id;
    }

    if (config.cloudinary.enabled) {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
      });
      const uploadFile = (file, folder) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "auto" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            },
          );
          const bufferStream = require("stream").PassThrough();
          bufferStream.end(file.buffer);
          bufferStream.pipe(stream);
        });
      for (const file of files) {
        console.log('Processing file:', file.originalname);
        const isAllowed = allowedFile(file.originalname);
        console.log('allowedFile:', isAllowed, 'for', file.originalname);
        if (!isAllowed) continue;
        let folder = "order_tracker/uploads";
        if (context && contextId) {
          folder += `/${context}_${contextId}`;
        }
        try {
          const result = await uploadFile(file, folder);
          // If context/context_id provided, save to Media table (direct-save mode)
          if (context && contextId) {
            let mediaData = {
              file_path: result.public_id,
              file_url: result.secure_url,
              file_type: getFileType(file.originalname),
              side: side || null,
              is_design: (context === "item") || (context === "order" && !side),
              uploaded_at: new Date(),
            };
            if (context === "order" && contextId) mediaData.order_id = contextId;
            if (context === "item" && contextId) {
              mediaData.item_id = contextId;
              if (itemOrderId) mediaData.order_id = itemOrderId;
            }
            const media = await Media.create(mediaData);
            uploaded.push({
              id: media.id,
              filename: file.originalname,
              url: result.secure_url,
              public_id: result.public_id,
              resource_type: result.resource_type,
              context,
              context_id: contextId,
              side,
            });
          } else {
            // URL-only mode
            uploaded.push({
              filename: file.originalname,
              url: result.secure_url,
              public_id: result.public_id,
              resource_type: result.resource_type,
            });
          }
        } catch (err) {
          console.warn("Cloudinary upload error:", err.message);
        }
      }
    } else {
      ensureUploadDir(config.app.uploadFolder);
      for (const file of files) {
        console.log('Processing file:', file.originalname);
        const isAllowed = allowedFile(file.originalname);
        console.log('allowedFile:', isAllowed, 'for', file.originalname);
        if (!isAllowed) continue;
        const filename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        let subfolder = "";
        if (context && contextId) {
          subfolder = `${context}_${contextId}`;
        }
        const relativePath = path.join(subfolder, filename);
        const fullPath = path.resolve(config.app.uploadFolder, relativePath);
        ensureUploadDir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, file.buffer);
        const fileType = getFileType(filename);
        const fileUrl = `/uploads/${subfolder ? subfolder + '/' : ''}${filename}`;
        if (context && contextId) {
          // Direct-save mode
          let mediaData = {
            file_path: relativePath,
            file_url: fileUrl,
            file_type: fileType,
            side: side || null,
            is_design: (context === "item") || (context === "order" && !side),
            uploaded_at: new Date(),
          };
          if (context === "order" && contextId) mediaData.order_id = contextId;
          if (context === "item" && contextId) {
            mediaData.item_id = contextId;
            if (itemOrderId) mediaData.order_id = itemOrderId;
          }
          const media = await Media.create(mediaData);
          uploaded.push({
            id: media.id,
            filename,
            url: fileUrl,
            file_type: fileType,
            context,
            context_id: contextId,
            side,
          });
        } else {
          // URL-only mode
          uploaded.push({
            filename,
            url: fileUrl,
            file_type: fileType,
          });
        }
      }
    }
    res.json({ uploaded });
  } catch (err) {
    console.error("Generic upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

const ensureUploadDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const allowedFile = (filename) => {
  return (
    filename &&
    filename.includes(".") &&
    config.allowedExtensions.has(filename.split(".").pop().toLowerCase())
  );
};

const logActivity = async (orderId, action, details = null) => {
  await ActivityLog.create({ order_id: orderId, action, details });
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (!value) return false;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
};

router.get("/orders", async (req, res) => {
  const { search = "", division = "", district = "", status = "" } = req.query;
  const where = {};
  const include = [];

  if (search) {
    where[Op.or] = [
      { customer_name: { [Op.like]: `%${search}%` } },
      { phone_number: { [Op.like]: `%${search}%` } },
      { courier_parcel_id: { [Op.like]: `%${search}%` } },
    ];
  }
  if (division) where.division = { [Op.like]: `%${division}%` };
  if (district) where.district = { [Op.like]: `%${district}%` };

  if (status) {
    include.push({ model: OrderStatus, as: "status", required: true });
  }

  const orders = await Order.findAll({
    where,
    include,
    order: [["id", "ASC"]],
  });

  const filtered = status
    ? orders.filter((order) => {
        const s = order.status;
        if (!s) return false;
        switch (status) {
          case "design_pending":
            return s.design_ready === false;
          case "design_ready":
            return s.design_ready === true;
          case "printed":
            return s.is_printed === true;
          case "picked":
            return s.picking_done === true;
          case "submitted":
            return s.delivery_status === "Submitted";
          case "delivered":
            return s.delivery_status === "Delivered";
          case "returned":
            return s.delivery_status === "Returned";
          default:
            return true;
        }
      })
    : orders;

  res.json(
    await Promise.all(
      filtered.map(async (order) => {
        await order.reload({ include: [{ model: OrderStatus, as: "status" }] });
        return order.toJson({ with_items: true, with_status: true });
      }),
    ),
  );
});

router.post("/orders", async (req, res) => {
  const data = req.body;
  const required = ["customer_name", "phone_number", "address"];
  for (const field of required) {
    if (!data[field]) {
      return res.status(400).json({ error: `${field} is required` });
    }
  }


  const order = await Order.create({
    customer_name: data.customer_name,
    phone_number: data.phone_number,
    division: data.division,
    district: data.district,
    upazila_zone: data.upazila_zone,
    address: data.address || null,
    description: data.description,
    price: data.price || null,
    payment_type: data.payment_type,
    courier_parcel_id: data.courier_parcel_id || null,
  });

  const status = await OrderStatus.create({ order_id: order.id });
  const itemsData = Array.isArray(data.items) ? data.items : [];
  // For response mapping
  order.items = [];
  // Save order-level media_urls if present
  if (Array.isArray(data.media_urls)) {
    for (const url of data.media_urls) {
      if (typeof url === "string" && url.trim()) {
        await Media.create({
          order_id: order.id,
          file_url: url,
          file_path: url,
          file_type: "Image",
          uploaded_at: new Date(),
        });
      }
    }
  }
  for (const itemData of itemsData) {
    if (!itemData.size || itemData.quantity == null) continue;
    const created = await OrderItem.create({
      order_id: order.id,
      size: itemData.size,
      quantity: parseInt(itemData.quantity, 10),
      position:
        itemData.position != null ? parseInt(itemData.position, 10) : null,
      note: itemData.note || null,
      color: itemData.color || "white",
      design: itemData.design || "both",
      temp_id: itemData.temp_id || null,
    });

    // Debug log for incoming media_urls
    console.log(`Saving media for item id=${created.id}, temp_id=${itemData.temp_id || ''}`);
    console.log('Received media_urls:', JSON.stringify(itemData.media_urls));

    // Validate and save item-level media_urls if present (object with front/back arrays)
    if (itemData.media_urls && typeof itemData.media_urls === 'object' && (itemData.media_urls.front || itemData.media_urls.back)) {
      let hasValidImage = false;
      for (const side of ['front', 'back']) {
        if (Array.isArray(itemData.media_urls[side])) {
          for (const url of itemData.media_urls[side]) {
            if (typeof url === "string" && url.trim()) {
              hasValidImage = true;
              await Media.create({
                order_id: order.id,
                item_id: created.id,
                file_url: url,
                file_path: url,
                file_type: "Image",
                side,
                is_design: true, // Mark as design image for item
                uploaded_at: new Date(),
              });
              console.log(`Saved media for item ${created.id} side=${side} url=${url}`);
            }
          }
        } else if (itemData.media_urls[side]) {
          // Log if side is missing or not an array
          console.warn(`media_urls[${side}] is not an array:`, itemData.media_urls[side]);
        }
      }
      // If both front and back are empty, warn or error (optional: enforce at least one image)
      if (!hasValidImage) {
        console.warn(`No valid images provided for item ${created.id}`);
        // Optionally, return error:
        // return res.status(400).json({ error: `No valid images provided for item at position ${itemData.position}` });
      }
    } else if (Array.isArray(itemData.media_urls)) {
      // fallback: flat array, save without side
      let hasValidImage = false;
      for (const url of itemData.media_urls) {
        if (typeof url === "string" && url.trim()) {
          hasValidImage = true;
          await Media.create({
            order_id: order.id,
            item_id: created.id,
            file_url: url,
            file_path: url,
            file_type: "Image",
            is_design: true,
            uploaded_at: new Date(),
          });
          console.log(`Saved media for item ${created.id} (no side) url=${url}`);
        }
      }
      if (!hasValidImage) {
        console.warn(`No valid images provided for item ${created.id}`);
        // Optionally, return error:
        // return res.status(400).json({ error: `No valid images provided for item at position ${itemData.position}` });
      }
    } else if (itemData.media_urls) {
      // Log if media_urls is present but not in expected format
      console.warn('media_urls for item is not an object/array:', itemData.media_urls);
    }
    order.items.push(created);
  }

  await logActivity(
    order.id,
    "Order Created",
    `Customer: ${order.customer_name}`,
  );

  const steadfastResult = {
    attempted: false,
    success: false,
    error: null,
    consignment_id: null,
  };
  const raw = await Setting.getValue("auto_create_courier", "true");
  const autoCreate = parseBoolean(raw);

  if (autoCreate && !order.courier_parcel_id) {
    steadfastResult.attempted = true;
    const service = new SteadfastService();
    if (await service.isConfigured()) {
      const orderItems = await OrderItem.findAll({
        where: { order_id: order.id },
      });
      const totalQuantity = orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const itemDescription =
        orderItems.length > 0
          ? `Items: ${orderItems.map((item) => `${item.size} (${item.quantity})`).join(", ")}`
          : null;
      const noteParts = [];
      if (order.description) noteParts.push(order.description.slice(0, 300));
      if (itemDescription) noteParts.push(itemDescription);
      const combinedNote = noteParts.length ? noteParts.join(" | ") : null;
      const recipientAddress = order.address
        ? `${order.address}${order.upazila_zone ? `, ${order.upazila_zone}` : ""}${order.district ? `, ${order.district}` : ""}`
        : `${order.upazila_zone}, ${order.district}`;

      try {
        const result = await service.createOrder({
          invoice: `ORD-${order.id}`,
          recipient_name: order.customer_name,
          recipient_phone: order.phone_number,
          recipient_address: recipientAddress,
          cod_amount: order.price || 0,
          note: combinedNote ? combinedNote.slice(0, 500) : undefined,
          item_description: itemDescription
            ? itemDescription.slice(0, 500)
            : undefined,
          total_lot: totalQuantity > 0 ? totalQuantity : undefined,
        });
        if (result.status === 200 && result.consignment) {
          order.courier_parcel_id = String(result.consignment.consignment_id);
          await order.save();
          steadfastResult.success = true;
          steadfastResult.consignment_id = result.consignment.consignment_id;
          await logActivity(
            order.id,
            "Steadfast Consignment Created",
            `Consignment ID: ${result.consignment.consignment_id}, Tracking: ${result.consignment.tracking_code || "N/A"}`,
          );
        } else {
          steadfastResult.error = result.message || "Unknown error";
          await logActivity(
            order.id,
            "Steadfast Creation Failed",
            `Failed: ${steadfastResult.error}`,
          );
        }
      } catch (err) {
        steadfastResult.error = err.message;
        await logActivity(
          order.id,
          "Steadfast Creation Error",
          `Exception: ${err.message}`,
        );
      }
    } else {
      steadfastResult.error = "Steadfast API credentials not configured";
      await logActivity(
        order.id,
        "Steadfast Skipped",
        "Steadfast not configured (missing API credentials)",
      );
    }
  } else if (!autoCreate) {
    steadfastResult.error = "Auto-create is disabled";
  } else {
    steadfastResult.error = "Order already has courier tracking ID";
  }

  const resultOrder = await Order.findByPk(order.id, {
    include: [
      { model: OrderStatus, as: "status" },
      { model: Media, as: "media" },
      {
        model: OrderItem,
        as: "items",
        include: [{ model: Media, as: "media" }],
      },
    ],
  });

  const response = resultOrder.toJson({ with_status: true, with_items: true });
  response.steadfast = steadfastResult;
  res.status(201).json(response);
});

router.get("/orders/print", async (req, res) => {
  const orderIds = (req.query.order_ids || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !Number.isNaN(id));
  if (!orderIds.length)
    return res.status(400).json({ error: "order_ids parameter is required" });
  let columns = null;
  if (req.query.columns) {
    try {
      columns = JSON.parse(req.query.columns);
    } catch (err) {
      columns = null;
    }
  }

  const orders = await Order.findAll({
    where: { id: orderIds },
    include: [
      { model: OrderStatus, as: "status" },
      { model: Media, as: "media" },
      {
        model: OrderItem,
        as: "items",
        include: [{ model: Media, as: "media" }],
      },
    ],
  });

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const html = generatePrintHtml(orders, baseUrl, columns);
  res.type("html").send(html);
});

router.get("/orders/:orderId", async (req, res) => {
  const includeItems = String(req.query.include_items).toLowerCase() === "true";
  const include = [
    { model: Media, as: "media" },
    { model: OrderStatus, as: "status" },
  ];
  if (includeItems) {
    include.push({
      model: OrderItem,
      as: "items",
      include: [{ model: Media, as: "media" }],
    });
  }

  const order = await Order.findByPk(req.params.orderId, { include });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(
    order.toJson({
      with_status: true,
      with_media: true,
      with_items: includeItems,
    }),
  );
});

// router.put('/orders/:orderId', async (req, res) => {
//   const order = await Order.findByPk(req.params.orderId);
//   if (!order) return res.status(404).json({ error: 'Order not found' });

//   const fields = ['customer_name', 'phone_number', 'division', 'district', 'upazila_zone', 'address', 'description', 'price', 'payment_type', 'courier_parcel_id'];
//   fields.forEach((field) => {
//     if (req.body[field] !== undefined) order[field] = req.body[field];
//   });
//   await order.save();
//   await logActivity(order.id, 'Order Updated', 'Order details modified');
//   const updated = await Order.findByPk(order.id, { include: [{ model: OrderStatus, as: 'status' }] });
//   res.json(updated.toJson({ with_status: true }));
// });

router.put("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: "items" }] });
    if (Array.isArray(req.body.items)) {
      const incomingItems = req.body.items;
      const existingItems = order.items || [];
      const existingById = {};
      existingItems.forEach((item) => {
        existingById[item.id] = item;
      });

      // Track which items to keep
      const incomingIds = new Set();
      // For response mapping
      const newItemsWithTempId = [];

      // Update or create items
      for (const itemData of incomingItems) {
        if (itemData.id && existingById[itemData.id]) {
          // Update existing item
          const item = existingById[itemData.id];
          if (itemData.size !== undefined) item.size = itemData.size;
          if (itemData.quantity !== undefined) item.quantity = itemData.quantity;
          if (itemData.position !== undefined) item.position = itemData.position;
          if (itemData.note !== undefined) item.note = itemData.note;
          if (itemData.color !== undefined) item.color = itemData.color;
          if (itemData.design !== undefined) item.design = itemData.design;
          // If temp_id is present and not set, update it (for legacy items)
          if (itemData.temp_id && !item.temp_id) item.temp_id = itemData.temp_id;
          await item.save();
          // Synchronize item-level media_urls for front/back: remove missing, add new
          if (itemData.media_urls && typeof itemData.media_urls === 'object' && (itemData.media_urls.front || itemData.media_urls.back)) {
            for (const side of ['front', 'back']) {
              const newUrls = Array.isArray(itemData.media_urls[side]) ? itemData.media_urls[side].filter(url => typeof url === 'string' && url.trim()) : [];
              // Remove Media records for this item/side not in newUrls
              await Media.destroy({ where: { order_id: order.id, item_id: item.id, side, ...(newUrls.length ? { file_url: { [Op.notIn]: newUrls } } : {}) } });
              // Add new Media records for newUrls not already present
              for (const url of newUrls) {
                const exists = await Media.findOne({ where: { order_id: order.id, item_id: item.id, file_url: url, side } });
                if (!exists) {
                  await Media.create({
                    order_id: order.id,
                    item_id: item.id,
                    file_url: url,
                    file_path: url,
                    file_type: "Image",
                    side,
                    is_design: true,
                    uploaded_at: new Date(),
                  });
                }
              }
            }
          } else if (Array.isArray(itemData.media_urls)) {
            const newUrls = itemData.media_urls.filter(url => typeof url === 'string' && url.trim());
            await Media.destroy({ where: { order_id: order.id, item_id: item.id, ...(newUrls.length ? { file_url: { [Op.notIn]: newUrls } } : {}) } });
            for (const url of newUrls) {
              const exists = await Media.findOne({ where: { order_id: order.id, item_id: item.id, file_url: url } });
              if (!exists) {
                await Media.create({
                  order_id: order.id,
                  item_id: item.id,
                  file_url: url,
                  file_path: url,
                  file_type: "Image",
                  is_design: true,
                  uploaded_at: new Date(),
                });
              }
            }
          }
          incomingIds.add(item.id);
        } else {
          // Create new item, persist temp_id if present
          const newItem = await OrderItem.create({
            order_id: order.id,
            size: itemData.size,
            quantity: itemData.quantity,
            position: itemData.position,
            note: itemData.note || null,
            color: itemData.color || "white",
            design: itemData.design || "both",
            temp_id: itemData.temp_id || null,
          });
          // Save item-level media_urls if present
          if (itemData.media_urls && typeof itemData.media_urls === 'object' && (itemData.media_urls.front || itemData.media_urls.back)) {
            for (const side of ['front', 'back']) {
              if (Array.isArray(itemData.media_urls[side])) {
                for (const url of itemData.media_urls[side]) {
                  if (typeof url === "string" && url.trim()) {
                    await Media.create({
                      order_id: order.id,
                      item_id: newItem.id,
                      file_url: url,
                      file_path: url,
                      file_type: "Image",
                      side,
                      is_design: true,
                      uploaded_at: new Date(),
                    });
                  }
                }
              }
            }
          } else if (Array.isArray(itemData.media_urls)) {
            for (const url of itemData.media_urls) {
              if (typeof url === "string" && url.trim()) {
                await Media.create({
                  order_id: order.id,
                  item_id: newItem.id,
                  file_url: url,
                  file_path: url,
                  file_type: "Image",
                  is_design: true,
                  uploaded_at: new Date(),
                });
              }
            }
          }
          newItemsWithTempId.push(newItem);
          incomingIds.add(newItem.id);
        }
      }
      // Delete items that are not in the incoming list
      for (const item of existingItems) {
        if (!incomingIds.has(item.id)) {
          await item.destroy();
        }
      }

      // Attach new items with temp_id to order.items for response
      order.items = existingItems.filter((item) => incomingIds.has(item.id)).concat(newItemsWithTempId);
    }

    await logActivity(order.id, "Order Updated", "Order details and items modified");

    // Synchronize order-level media (attachments) if provided as media_urls array
    if (Array.isArray(req.body.media_urls)) {
      const newUrls = req.body.media_urls.filter(u => typeof u === 'string' && u.trim());
      // Remove order-level Media rows (item_id IS NULL) whose file_url is not in newUrls
      await Media.destroy({ where: { order_id: order.id, item_id: null, ...(newUrls.length ? { file_url: { [Op.notIn]: newUrls } } : {}) } });
      // Add any new urls not already present
      for (const url of newUrls) {
        const exists = await Media.findOne({ where: { order_id: order.id, item_id: null, file_url: url } });
        if (!exists) {
          await Media.create({
            order_id: order.id,
            file_url: url,
            file_path: url,
            file_type: 'Image',
            is_design: true,
            uploaded_at: new Date(),
          });
        }
      }
    }

    // Return updated order with status and items
    const resultOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderStatus, as: "status" },
        { model: OrderItem, as: "items" },
      ],
    });
    return res.json(resultOrder.toJson({ with_status: true, with_items: true }));
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({
      error: "Failed to update order",
      details: error.message,
    });
  }
});

router.put("/orders/:orderId/status", async (req, res) => {
  const order = await Order.findByPk(req.params.orderId, {
    include: [{ model: OrderStatus, as: "status" }],
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  let status = order.status;
  if (!status) {
    status = await OrderStatus.create({ order_id: order.id });
  }

  const updates = [];
  ["design_ready", "is_printed", "picking_done"].forEach((field) => {
    if (req.body[field] !== undefined) {
      status[field] = Boolean(req.body[field]);
      updates.push(`${field.replace("_", " ")}: ${status[field]}`);
    }
  });

  if (req.body.delivery_status !== undefined) {
    status.delivery_status = req.body.delivery_status || null;
    updates.push(`Delivery Status: ${status.delivery_status || "Cleared"}`);
  }

  if (req.body.courier_parcel_id !== undefined) {
    order.courier_parcel_id = req.body.courier_parcel_id;
    updates.push(`Courier Parcel ID: ${order.courier_parcel_id}`);
  }

  if (
    Array.isArray(req.body.design_files) &&
    req.body.design_files.length > 0
  ) {
    let existing = [];
    try {
      existing = order.design_file_url ? JSON.parse(order.design_file_url) : [];
    } catch (err) {
      existing = [];
    }
    const combined = existing.concat(req.body.design_files);
    order.design_file_url = JSON.stringify(combined);
    updates.push(
      `Design files added: ${req.body.design_files.length} (total: ${combined.length})`,
    );
  }

  await status.save();
  await order.save();
  await logActivity(order.id, "Status Updated", updates.join(", "));

  const finalOrder = await Order.findByPk(order.id, {
    include: [{ model: OrderStatus, as: "status" }],
  });
  res.json(finalOrder.toJson({ with_status: true }));
});

router.put("/orders/:orderId/position", async (req, res) => {
  const order = await Order.findByPk(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const position = req.body.position;
  if (position === undefined) {
    return res.status(400).json({ error: "Position is required" });
  }
  const parsed = parseInt(position, 10);
  if (Number.isNaN(parsed)) {
    return res.status(400).json({ error: "Position must be an integer" });
  }
  order.position = parsed;
  await order.save();
  res.json({ id: order.id, position: order.position });
});

const deleteMediaFile = async (media) => {
  if (!media.file_path) return;
  if (
    config.cloudinary.enabled &&
    media.file_path.startsWith("order_tracker")
  ) {
    try {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
      });
      await cloudinary.uploader.destroy(media.file_path);
    } catch (error) {
      console.warn("Cloudinary delete failed", error.message);
    }
  } else {
    const candidate = path.isAbsolute(media.file_path)
      ? media.file_path
      : path.resolve(config.app.uploadFolder, media.file_path);
    try {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    } catch (err) {
      // ignore
    }
  }
};

router.delete("/orders/:orderId", async (req, res) => {
  const order = await Order.findByPk(req.params.orderId, {
    include: [
      { model: Media, as: "media" },
      {
        model: OrderItem,
        as: "items",
        include: [{ model: Media, as: "media" }],
      },
      { model: OrderStatus, as: "status" },
      { model: ActivityLog, as: "activity_logs" },
    ],
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  for (const item of order.items || []) {
    for (const media of item.media || []) {
      await deleteMediaFile(media);
      await media.destroy();
    }
    await item.destroy();
  }
  for (const media of order.media || []) {
    await deleteMediaFile(media);
    await media.destroy();
  }
  if (order.status) await order.status.destroy();
  for (const activity of order.activity_logs || []) await activity.destroy();
  await order.destroy();

  res.json({ message: "Order deleted" });
});

router.post(
  "/orders/:orderId/design-upload",
  tokenRequired,
  upload.array("files"),
  async (req, res) => {
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const files = req.files || [];
    const itemId = req.body.item_id ? parseInt(req.body.item_id, 10) : null;
    const side = req.body.side;
    if (side && !["front", "back"].includes(side)) {
      return res.status(400).json({ error: "side must be 'front' or 'back'" });
    }

    let item = null;
    if (itemId) {
      item = await OrderItem.findOne({
        where: { id: itemId, order_id: order.id },
      });
      if (!item)
        return res
          .status(404)
          .json({ error: `Item ${itemId} not found for this order` });
    }

    const createMedia = async (file, fileType, fileUrl, filePath) => {
      return Media.create({
        order_id: order.id,
        item_id: itemId,
        side: side || null,
        file_path: filePath,
        file_url: fileUrl,
        file_type: fileType,
        is_design: true,
      });
    };

    const createdMedia = [];
    if (config.cloudinary.enabled) {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
      });

      const uploadFile = (file, folder) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "auto" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            },
          );
          const bufferStream = require("stream").PassThrough();
          bufferStream.end(file.buffer);
          bufferStream.pipe(stream);
        });

      for (const file of files) {
        if (!allowedFile(file.originalname)) continue;
        const folder =
          `order_tracker/order_${order.id}` + (itemId ? `/item_${itemId}` : "");
        try {
          const result = await uploadFile(file, folder);
          const fileType =
            result.resource_type === "video"
              ? "Video"
              : result.resource_type === "image"
                ? "Image"
                : "File";
          const media = await createMedia(
            file,
            fileType,
            result.secure_url,
            result.public_id,
          );
          createdMedia.push(media);
        } catch (err) {
          console.warn("Cloudinary upload error:", err.message);
        }
      }
    } else {
      ensureUploadDir(config.app.uploadFolder);
      for (const file of files) {
        if (!allowedFile(file.originalname)) continue;
        const filename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const subfolder = itemId
          ? path.join(`order_${order.id}`, `item_${itemId}`)
          : `order_${order.id}`;
        const relativePath = path.join(subfolder, filename);
        const fullPath = path.resolve(config.app.uploadFolder, relativePath);
        ensureUploadDir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, file.buffer);
        const ext = filename.split(".").pop().toLowerCase();
        const fileType = ["mp4", "mov", "avi", "mkv", "wmv"].includes(ext)
          ? "Video"
          : ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)
            ? "Image"
            : "File";
        const fileUrl = `/uploads/${relativePath.split(path.sep).join("/")}`;
        const media = await createMedia(file, fileType, fileUrl, relativePath);
        createdMedia.push(media);
      }
    }

    const uploaded = [];
    for (const m of createdMedia) {
      uploaded.push({
        id: m.id,
        filename: m.file_path.split("/").pop(),
        file_type: m.file_type,
        url: m.file_url,
        item_id: m.item_id,
        side: m.side,
        is_design: m.is_design,
      });
    }

    if (uploaded.length) {
      let existing = [];
      try {
        existing = order.design_file_url
          ? JSON.parse(order.design_file_url)
          : [];
      } catch (err) {
        existing = [];
      }
      const newEntries = uploaded.map((entry) => ({
        url: entry.url,
        file_type: entry.file_type,
        filename: entry.filename,
        media_id: entry.id,
      }));
      order.design_file_url = JSON.stringify(existing.concat(newEntries));
      await order.save();
    }

    res.json({ uploaded });
  },
);

router.post("/orders/bulk-delete", async (req, res) => {
  const orderIds = Array.isArray(req.body.order_ids)
    ? req.body.order_ids
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id))
    : [];
  if (orderIds.length === 0) {
    return res.status(400).json({ error: "No order IDs provided" });
  }

  const orders = await Order.findAll({
    where: { id: orderIds },
    include: [
      {
        model: OrderItem,
        as: "items",
        include: [{ model: Media, as: "media" }],
      },
      { model: Media, as: "media" },
      { model: OrderStatus, as: "status" },
      { model: ActivityLog, as: "activity_logs" },
    ],
  });

  if (!orders.length) return res.status(404).json({ error: "No orders found" });
  let deletedCount = 0;

  for (const order of orders) {
    for (const item of order.items || []) {
      for (const media of item.media || []) {
        await deleteMediaFile(media);
        await media.destroy();
      }
      await item.destroy();
    }
    for (const media of order.media || []) {
      await deleteMediaFile(media);
      await media.destroy();
    }
    if (order.status) await order.status.destroy();
    for (const log of order.activity_logs || []) await log.destroy();
    await order.destroy();
    deletedCount += 1;
  }

  res.json({ message: `${deletedCount} order(s) deleted successfully` });
});

router.get("/orders/:orderId/items", async (req, res) => {
  const items = await OrderItem.findAll({
    where: { order_id: req.params.orderId },
    include: [{ model: Media, as: "media" }],
    order: [
      ["position", "ASC"],
      ["id", "ASC"],
    ],
  });
  res.json(items.map((item) => item.toJson({ with_media: true })));
});

router.post("/orders/:orderId/items", async (req, res) => {
  const order = await Order.findByPk(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!req.body.size)
    return res.status(400).json({ error: "size is required" });
  if (req.body.quantity == null)
    return res.status(400).json({ error: "quantity is required" });
  const quantity = parseInt(req.body.quantity, 10);
  if (Number.isNaN(quantity) || quantity < 1)
    return res
      .status(400)
      .json({ error: "quantity must be a positive integer" });

  const position =
    req.body.position != null ? parseInt(req.body.position, 10) : null;
  const item = await OrderItem.create({
    order_id: order.id,
    size: req.body.size,
    quantity,
    position: Number.isNaN(position) ? null : position,
    note: req.body.note || null,
    color: req.body.color || "white",
    design: req.body.design || "both",
  });

  await logActivity(
    order.id,
    "Item Created",
    `Size: ${item.size}, Qty: ${item.quantity}`,
  );
  res.status(201).json(item.toJson());
});

router.get("/orders/:orderId/items/:itemId", async (req, res) => {
  const item = await OrderItem.findOne({
    where: { id: req.params.itemId, order_id: req.params.orderId },
    include: [{ model: Media, as: "media" }],
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item.toJson({ with_media: true }));
});

router.put("/orders/:orderId/items/:itemId", async (req, res) => {
  const item = await OrderItem.findOne({
    where: { id: req.params.itemId, order_id: req.params.orderId },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });

  if (req.body.size) item.size = req.body.size;
  if (req.body.quantity !== undefined) {
    const quantity = parseInt(req.body.quantity, 10);
    if (Number.isNaN(quantity) || quantity < 1)
      return res
        .status(400)
        .json({ error: "quantity must be a positive integer" });
    item.quantity = quantity;
  }
  if (req.body.position !== undefined) {
    item.position =
      req.body.position !== null ? parseInt(req.body.position, 10) : null;
  }
  if (req.body.note !== undefined) item.note = req.body.note;
  if (req.body.color !== undefined) item.color = req.body.color;
  if (req.body.design !== undefined) item.design = req.body.design;

  await item.save();
  await logActivity(
    req.params.orderId,
    "Item Updated",
    `Item ${item.id} updated`,
  );
  res.json(item.toJson());
});

router.delete("/orders/:orderId/items/:itemId", async (req, res) => {
  const item = await OrderItem.findOne({
    where: { id: req.params.itemId, order_id: req.params.orderId },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  await item.destroy();
  await logActivity(
    req.params.orderId,
    "Item Deleted",
    `Item ${item.id} removed`,
  );
  res.json({ message: "Item deleted" });
});

router.get("/orders/print", async (req, res) => {
  const orderIds = (req.query.order_ids || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !Number.isNaN(id));
  if (!orderIds.length)
    return res.status(400).json({ error: "order_ids parameter is required" });
  let columns = null;
  if (req.query.columns) {
    try {
      columns = JSON.parse(req.query.columns);
    } catch (err) {
      columns = null;
    }
  }

  const orders = await Order.findAll({
    where: { id: orderIds },
    include: [
      { model: OrderStatus, as: "status" },
      { model: Media, as: "media" },
      {
        model: OrderItem,
        as: "items",
        include: [{ model: Media, as: "media" }],
      },
    ],
  });

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const html = generatePrintHtml(orders, baseUrl, columns);
  res.type("html").send(html);
});

const generatePrintHtml = (orders, baseUrl, columns) => {
  const cols =
    columns && typeof columns === "object"
      ? columns
      : {
          order_id: true,
          customer_name: true,
          phone_number: true,
          address: true,
          description: true,
          price: true,
          payment_type: true,
          courier_parcel_id: true,
          created_at: true,
          items: true,
          attachments: false,
        };
  const printDate = new Date().toISOString().replace("T", " ").slice(0, 16);

  const serializeMediaUrl = (m) => {
    if (!m) return "";
    if (m.file_url && /^https?:\/\//.test(m.file_url)) return m.file_url;
    if (m.file_url && m.file_url.startsWith("//")) return `https:${m.file_url}`;
    return `${baseUrl}${m.file_url}`;
  };

  const escapeHtml = (value) =>
    String(value || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Print Orders</title><style>@media print {@page { size: A4; margin: 0.5cm; }}body{font-family:Arial,sans-serif;margin:0;padding:20px;background:white;color:#000;} .header{text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:15px;} .header h1{margin:0 0 10px 0;font-size:24pt;} .header p{margin:5px 0;font-size:10pt;color:#555;} .order{page-break-inside:avoid;margin-bottom:40px;border:1px solid #ddd;padding:20px;background:#fafafa;} .order-header{margin-bottom:15px;border-bottom:1px solid #ccc;padding-bottom:10px;} .order-title{font-size:18pt;font-weight:bold;color:#000;margin-bottom:10px;} .order-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:11pt;} .order-detail-item{margin:0;} .order-detail-label{font-weight:bold;color:#333;} .items-section{margin-top:15px;} .section-title{font-size:12pt;font-weight:bold;margin-bottom:8px;color:#333;} .items-table{width:100%;border-collapse:collapse;font-size:10pt;margin-top:5px;} .items-table th{background:#e0e0e0;padding:8px;text-align:left;border:1px solid #ccc;} .items-table td{padding:8px;border:1px solid #ccc;vertical-align:top;} .images-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;margin-top:4px;} .image-item{text-align:center;} .image-item img{max-width:80px;max-height:80px;object-fit:contain;border:1px solid #ccc;background:white;} .image-item p{font-size:8pt;margin:3px 0 0 0;word-break:break-all;} .footer{margin-top:20px;text-align:center;font-size:9pt;color:#777;border-top:1px solid #ddd;padding-top:10px;} .no-data{color:#999;font-style:italic;font-size:10pt;}</style></head><body>`;
  html += `<div class="header"><h1>Order Printout</h1><p>Generated on: ${escapeHtml(printDate)}</p><p>Total Orders: ${orders.length}</p></div>`;

  const summaryBySize = {};
  for (const order of orders) {
    for (const item of order.items || []) {
      const size = item.size || "Unknown";
      const color = item.color || "white";
      const quantity = Number(item.quantity) || 0;
      if (!summaryBySize[size]) {
        summaryBySize[size] = { total: 0, colors: {} };
      }
      summaryBySize[size].total += quantity;
      summaryBySize[size].colors[color] =
        (summaryBySize[size].colors[color] || 0) + quantity;
    }
  }

  if (Object.keys(summaryBySize).length) {
    html += `<div class="summary-section"><div class="section-title">Summary by Size and Color</div><table class="summary-table"><thead><tr><th>Size</th><th>Total Qty</th><th>Color Breakdown</th></tr></thead><tbody>`;
    for (const [size, itemData] of Object.entries(summaryBySize)) {
      const colorBreakdown = Object.entries(itemData.colors)
        .map(([color, qty]) => `${escapeHtml(color)}: ${qty}`)
        .join(", ");
      html += `<tr><td>${escapeHtml(size)}</td><td>${itemData.total}</td><td>${escapeHtml(colorBreakdown)}</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  for (const order of orders) {
    html += `<div class="order"><div class="order-header"><div class="order-title">Order #${order.id}</div><div class="order-details">`;
    if (cols.customer_name)
      html += `<div class="order-detail-item"><span class="order-detail-label">Customer:</span> ${escapeHtml(order.customer_name)}</div>`;
    if (cols.phone_number)
      html += `<div class="order-detail-item"><span class="order-detail-label">Phone:</span> ${escapeHtml(order.phone_number)}</div>`;
    if (cols.address) {
      const addressParts = [
        order.address,
        order.upazila_zone,
        order.district,
        order.division,
      ].filter(Boolean);
      html += `<div class="order-detail-item"><span class="order-detail-label">Address:</span> ${escapeHtml(addressParts.join(", "))}</div>`;
    }
    if (cols.description)
      html += `<div class="order-detail-item"><span class="order-detail-label">Description:</span> ${escapeHtml(order.description)}</div>`;
    if (cols.price)
      html += `<div class="order-detail-item"><span class="order-detail-label">Price:</span> ৳${escapeHtml(order.price)}</div>`;
    if (cols.payment_type)
      html += `<div class="order-detail-item"><span class="order-detail-label">Payment:</span> ${escapeHtml(order.payment_type)}</div>`;
    if (cols.courier_parcel_id)
      html += `<div class="order-detail-item"><span class="order-detail-label">Courier Parcel ID:</span> ${escapeHtml(order.courier_parcel_id)}</div>`;
    if (cols.created_at)
      html += `<div class="order-detail-item"><span class="order-detail-label">Created:</span> ${escapeHtml(order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : "N/A")}</div>`;
    html += `</div></div>`;
    if (cols.attachments) {
      const attachments = (order.media || []).filter((m) => m.item_id === null);
      if (attachments.length) {
        html += `<div class="images-grid">`;
        for (const m of attachments) {
          const mediaUrl = serializeMediaUrl(m);
          const filename = path.basename(m.file_path || "attachment");
          if (m.file_type === "Image") {
            html += `<div class="image-item"><img src="${escapeHtml(mediaUrl)}" alt="Attachment" loading="lazy"><p>${escapeHtml(filename)}</p></div>`;
          } else {
            html += `<div class="image-item" style="display:flex;align-items:center;justify-content:center;flex-direction:column;"><svg class="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg><p style="font-size:8pt;margin:3px 0 0 0;">${escapeHtml(filename)}</p></div>`;
          }
        }
        html += `</div>`;
      } else {
        html += `<p class="no-data">No attachments</p>`;
      }
    }
    if (cols.items) {
      html += `<div class="items-section"><div class="section-title">Order Items</div><table class="items-table"><thead><tr><th>Size</th><th>Quantity</th><th>Front Design Images</th><th>Back Design Images</th></tr></thead><tbody>`;
      for (const item of order.items || []) {
        const frontImages = (item.media || []).filter(
          (m) => m.side === "front",
        );
        const backImages = (item.media || []).filter((m) => m.side === "back");
        const buildImagesHtml = (images) => {
          if (!images.length) return '<span class="no-data">No images</span>';
          return `<div class="images-grid">${images.map((img) => `<div class="image-item"><img src="${escapeHtml(serializeMediaUrl(img))}" alt="Image" loading="lazy"><p>${escapeHtml(path.basename(img.file_path || "image"))}</p></div>`).join("")}</div>`;
        };
        html += `<tr><td>${escapeHtml(item.size)}</td><td>${escapeHtml(item.quantity)}</td><td>${buildImagesHtml(frontImages)}</td><td>${buildImagesHtml(backImages)}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    }
    html += `<div class="footer">— End of Order —</div></div>`;
  }
  html += `<script>window.onload = function(){setTimeout(function(){window.print();},500);};</script></body></html>`;
  return html;
};

module.exports = router;
