const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Media = sequelize.define('Media', {
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    side: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    file_type: {
      type: DataTypes.ENUM('Image', 'Video', 'File'),
      allowNull: false
    },
    is_design: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    uploaded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'media',
    timestamps: false,
    underscored: true
  });

  return Media;
};
