"""
Migration: Add settings table for storing application configuration

- settings table with key/value pairs
- Encrypted storage for sensitive data (API keys, secrets)
- Support for different categories (courier, api, webhook, etc.)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from extensions import db
from sqlalchemy import text


def upgrade():
    """Create settings table"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        # Create table with backtick-quoted column names to avoid reserved word conflicts
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                settings_key VARCHAR(100) NOT NULL UNIQUE,
                settings_value LONGTEXT NULL,
                `type` VARCHAR(50) NOT NULL DEFAULT 'string',
                `category` VARCHAR(50) NOT NULL DEFAULT 'general',
                `description` TEXT NULL,
                is_encrypted BOOLEAN DEFAULT FALSE,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_category (category),
                INDEX idx_key (settings_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))
        db.session.commit()
        print("✓ settings table created successfully")

        # Insert default Steadfast Courier settings
        default_settings = [
            ('steadfast_api_key', None, 'encrypted', 'courier', 'Steadfast API Key'),
            ('steadfast_secret_key', None, 'encrypted', 'courier', 'Steadfast Secret Key'),
            ('steadfast_base_url', 'https://portal.packzy.com/api/v1', 'string', 'courier', 'Steadfast API Base URL'),
            ('steadfast_webhook_url', None, 'string', 'webhook', 'Webhook URL for Steadfast notifications'),
            ('steadfast_webhook_token', None, 'encrypted', 'webhook', 'Webhook authentication token'),
            ('webhook_enabled', 'false', 'boolean', 'webhook', 'Enable webhook integration'),
            ('auto_create_courier', 'false', 'boolean', 'courier', 'Automatically create courier consignment when order is created'),
        ]

        for key, val, type_val, category, description in default_settings:
            db.session.execute(text("""
                INSERT IGNORE INTO settings (settings_key, settings_value, `type`, `category`, `description`, is_encrypted)
                VALUES (:key, :val, :type, :category, :desc, :enc)
            """), {
                'key': key,
                'val': val,
                'type': type_val,
                'category': category,
                'desc': description,
                'enc': 1 if type_val == 'encrypted' else 0
            })
        db.session.commit()
        print("✓ Default settings inserted")


def downgrade():
    """Drop settings table"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        db.session.execute(text("DROP TABLE IF EXISTS settings"))
        db.session.commit()
        print("✓ settings table dropped")


if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv()
    upgrade()
