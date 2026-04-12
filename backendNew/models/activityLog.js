const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ActivityLog = sequelize.define('ActivityLog', {
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'activity_log',
    timestamps: false,
    underscored: true
  });

  return ActivityLog;
};
