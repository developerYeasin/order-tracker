import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_USER = os.getenv('DB_USER', 'order_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'order_pass')
DB_NAME = os.getenv('DB_NAME', 'order_tracker')

# App Configuration
SECRET_KEY = os.getenv('SECRET_KEY', 'order-tracker-secret-change-in-production')
PORT = int(os.getenv('PORT', 8090))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET')
USE_CLOUDINARY = all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET])

# File Upload Configuration (fallback if not using Cloudinary)
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
ALLOWED_EXTENSIONS = {
    # Images
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
    # Videos
    'mp4', 'mov', 'avi', 'mkv', 'wmv',
    # Files/Documents
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar', '7z'
}
