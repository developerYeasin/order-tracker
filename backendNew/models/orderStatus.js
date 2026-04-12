const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderStatus = sequelize.define('OrderStatus', {
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    design_ready: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_printed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    picking_done: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    delivery_status: {
      type: DataTypes.ENUM('Submitted', 'Delivered', 'Returned'),
      allowNull: true
    }
  }, {
    tableName: 'order_status',
    timestamps: true,
    underscored: true
  });

  OrderStatus.prototype.toJson = function() {
    return {
      id: this.id,
      order_id: this.order_id,
      design_ready: this.design_ready,
      is_printed: this.is_printed,
      picking_done: this.picking_done,
      delivery_status: this.delivery_status,
      updated_at: this.updated_at ? this.updated_at.toISOString() : null
    };
  };

  return OrderStatus;
};
