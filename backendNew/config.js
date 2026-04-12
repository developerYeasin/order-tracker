const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const env = process.env;

module.exports = {
  app: {
    port: parseInt(env.PORT, 10) || 8090,
    secretKey: env.SECRET_KEY || 'order-tracker-secret-change-in-production',
    debug: env.DEBUG === 'true' || false,
    uploadFolder: env.UPLOAD_FOLDER || path.resolve(__dirname, 'uploads'),
    cacheEnabled: env.CACHE_ENABLED !== 'false',
    cacheTtlFile: parseInt(env.CACHE_TTL_FILE, 10) || 300,
    frontendDistPath: path.resolve(__dirname, '..', 'dist')
  },
  db: {
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT, 10) || 3306,
    username: env.DB_USER || 'order_user',
    password: env.DB_PASSWORD || 'order_pass',
    database: env.DB_NAME || 'order_tracker',
    dialect: 'mysql',
    logging: false
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    enabled: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
  },
  allowedExtensions: new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
    'mp4', 'mov', 'avi', 'mkv', 'wmv',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar', '7z'
  ])
};
