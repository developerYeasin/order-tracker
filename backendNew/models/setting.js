const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const config = require('../config');

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

module.exports = (sequelize) => {
  const Setting = sequelize.define('Setting', {
    settings_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    settings_value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'string'
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'general'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_encrypted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'settings',
    timestamps: false,
    underscored: true
  });

  Setting.getValue = async function(key, defaultValue = null) {
    const setting = await Setting.findOne({ where: { settings_key: key } });
    if (!setting) return defaultValue;
    if (setting.is_encrypted && setting.settings_value) {
      try {
        const iv = Buffer.from(setting.settings_value.slice(0, 32), 'hex');
        const encrypted = Buffer.from(setting.settings_value.slice(32), 'hex');
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, deriveKey(config.app.secretKey), iv);
        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (err) {
        return setting.settings_value;
      }
    }
    return setting.settings_value;
  };

  Setting.setValue = async function({ key, value, type = 'string', category = 'general', description = null, is_encrypted = false }) {
    const [setting] = await Setting.findOrCreate({
      where: { settings_key: key },
      defaults: {
        settings_value: value,
        type,
        category,
        description,
        is_encrypted
      }
    });

    let storedValue = value;
    if (is_encrypted && value) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, deriveKey(config.app.secretKey), iv);
      let encrypted = cipher.update(String(value), 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      storedValue = iv.toString('hex') + encrypted.toString('hex');
    }

    setting.settings_value = storedValue;
    setting.type = type;
    setting.category = category;
    setting.description = description;
    setting.is_encrypted = is_encrypted;
    await setting.save();
    return setting;
  };

  Setting.deleteByKey = async function(key) {
    const count = await Setting.destroy({ where: { settings_key: key } });
    return count > 0;
  };

  Setting.getAllByCategory = async function(category) {
    const settings = await Setting.findAll({ where: { category } });
    return Promise.all(settings.map(async (s) => ({
      key: s.settings_key,
      value: s.is_encrypted ? await Setting.getValue(s.settings_key) : s.settings_value,
      type: s.type,
      category: s.category,
      description: s.description,
      is_encrypted: s.is_encrypted
    })));
  };

  return Setting;
};
