const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    customer_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    division: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    district: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    upazila_zone: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    payment_type: {
      type: DataTypes.ENUM('COD', 'Prepaid'),
      allowNull: false,
      defaultValue: 'COD'
    },
    courier_parcel_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    design_file_url: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    underscored: true
  });

  Order.prototype.toJson = function(options = {}) {
    const { with_status = false, with_media = false, with_items = false } = options;
    let designFiles = [];
    try {
      designFiles = this.design_file_url ? JSON.parse(this.design_file_url) : [];
    } catch (err) {
      designFiles = [];
    }

    const data = {
      id: this.id,
      customer_name: this.customer_name,
      phone_number: this.phone_number,
      division: this.division,
      district: this.district,
      upazila_zone: this.upazila_zone,
      address: this.address,
      description: this.description,
      price: this.price,
      payment_type: this.payment_type,
      courier_parcel_id: this.courier_parcel_id,
      position: this.position,
      design_file_url: designFiles,
      created_at: this.created_at ? this.created_at.toISOString() : null,
      updated_at: this.updated_at ? this.updated_at.toISOString() : null
    };

    if (with_status && this.status) {
      data.status = this.status.toJson();
    }

    if (with_media) {
      data.media = (this.media || []).filter((m) => m.item_id === null).map((m) => ({
        id: m.id,
        file_path: m.file_path,
        file_url: m.file_url,
        file_type: m.file_type,
        side: m.side,
        is_design: m.is_design
      }));
    }

    if (with_items) {
      data.items = (this.items || []).map((item) => item.toJson({ with_media: true }));
    }

    return data;
  };

  return Order;
};
