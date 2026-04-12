const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define('OrderItem', {
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'white'
    },
    design: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'both'
    }
  }, {
    tableName: 'order_items',
    timestamps: true,
    underscored: true
  });

  OrderItem.prototype.toJson = function(options = {}) {
    const { with_media = false } = options;
    const data = {
      id: this.id,
      order_id: this.order_id,
      size: this.size,
      quantity: this.quantity,
      position: this.position,
      note: this.note,
      color: this.color,
      design: this.design,
      created_at: this.created_at ? this.created_at.toISOString() : null,
      updated_at: this.updated_at ? this.updated_at.toISOString() : null
    };

    if (with_media) {
      data.front_images = (this.media || []).filter((m) => m.side === 'front').map((m) => ({
        id: m.id,
        file_path: m.file_path,
        file_url: m.file_url,
        file_type: m.file_type,
        side: m.side,
        uploaded_at: m.created_at ? m.created_at.toISOString() : null
      }));
      data.back_images = (this.media || []).filter((m) => m.side === 'back').map((m) => ({
        id: m.id,
        file_path: m.file_path,
        file_url: m.file_url,
        file_type: m.file_type,
        side: m.side,
        uploaded_at: m.created_at ? m.created_at.toISOString() : null
      }));
      data.other_images = (this.media || []).filter((m) => m.side !== 'front' && m.side !== 'back').map((m) => ({
        id: m.id,
        file_path: m.file_path,
        file_url: m.file_url,
        file_type: m.file_type,
        side: m.side,
        uploaded_at: m.created_at ? m.created_at.toISOString() : null
      }));
    }

    return data;
  };

  return OrderItem;
};
