const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { notEmpty: true, isEmail: true }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    current_token: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true
  });

  User.prototype.checkPassword = function(password) {
    return bcrypt.compareSync(password, this.password_hash);
  };

  return User;
};
