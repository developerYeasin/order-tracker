const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.dialect,
  logging: config.db.logging
});

const User = require('./user')(sequelize);
const Order = require('./order')(sequelize);
const OrderStatus = require('./orderStatus')(sequelize);
const OrderItem = require('./orderItem')(sequelize);
const Media = require('./media')(sequelize);
const ActivityLog = require('./activityLog')(sequelize);
const Setting = require('./setting')(sequelize);

Order.hasOne(OrderStatus, { foreignKey: 'order_id', as: 'status', onDelete: 'CASCADE' });
OrderStatus.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(Media, { foreignKey: 'order_id', as: 'media', onDelete: 'CASCADE' });
Media.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(ActivityLog, { foreignKey: 'order_id', as: 'activity_logs', onDelete: 'CASCADE' });
ActivityLog.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

OrderItem.hasMany(Media, { foreignKey: 'item_id', as: 'media', onDelete: 'CASCADE' });
Media.belongsTo(OrderItem, { foreignKey: 'item_id', as: 'item' });

module.exports = {
  sequelize,
  User,
  Order,
  OrderStatus,
  OrderItem,
  Media,
  ActivityLog,
  Setting
};
