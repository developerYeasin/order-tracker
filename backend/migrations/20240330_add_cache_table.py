"""
Migration: Add cache_entries table for caching AI responses and computed data

This table stores cached values with automatic TTL expiration.
- cache_key: Unique identifier for cached item (indexed)
- cache_value: Serialized JSON value
- expires_at: timestamp when this cache entry expires (indexed for cleanup)
- created_at: when the entry was created
"""

import sys
import os

# Add parent directory to path so we can import extensions and models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from flask import Flask
from extensions import db
from sqlalchemy import text


def upgrade():
    """Create cache_entries table"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        # Create cache_entries table
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS cache_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cache_key VARCHAR(255) NOT NULL UNIQUE,
                cache_value LONGTEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cache_key (cache_key),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))
        db.session.commit()
        print("✓ cache_entries table created successfully")


def downgrade():
    """Drop cache_entries table"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        db.session.execute(text("DROP TABLE IF EXISTS cache_entries"))
        db.session.commit()
        print("✓ cache_entries table dropped")


if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv()
    upgrade()
