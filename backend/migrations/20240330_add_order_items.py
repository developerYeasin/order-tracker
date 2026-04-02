"""
Migration: Add order items feature

- Creates order_items table
- Adds item_id and side columns to media table
- Sets up foreign keys with appropriate cascades
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from extensions import db
from sqlalchemy import text, MetaData


def upgrade():
    """Create order_items table and add columns to media"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        # 1. Create order_items table
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                size VARCHAR(20) NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                position INT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_order_items_order_id (order_id),
                CONSTRAINT fk_order_items_order
                    FOREIGN KEY (order_id)
                    REFERENCES orders(id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))
        print("✓ Created order_items table")

        # 2. Check if media table needs new columns
        inspector = db.inspect(db.engine)
        media_columns = [col['name'] for col in inspector.get_columns('media')]

        # Add item_id column if not exists
        if 'item_id' not in media_columns:
            db.session.execute(text("""
                ALTER TABLE media
                ADD COLUMN item_id INT NULL,
                ADD CONSTRAINT fk_media_item
                    FOREIGN KEY (item_id)
                    REFERENCES order_items(id)
                    ON DELETE CASCADE
            """))
            print("✓ Added item_id column to media with foreign key")

        # Add side column if not exists
        if 'side' not in media_columns:
            db.session.execute(text("""
                ALTER TABLE media
                ADD COLUMN side VARCHAR(20) NULL
            """))
            print("✓ Added side column to media")

        # 3. Add index on media.item_id for performance
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('media')]
        if 'idx_media_item_id' not in existing_indexes:
            db.session.execute(text("""
                CREATE INDEX idx_media_item_id
                ON media (item_id)
            """))
            print("✓ Created index idx_media_item_id on media")

        db.session.commit()
        print("\n✅ Migration completed successfully")


def downgrade():
    """Rollback changes"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        # Drop foreign keys and columns
        try:
            # Drop foreign key on media.item_id
            db.session.execute(text("ALTER TABLE media DROP FOREIGN KEY fk_media_item"))
            print("✓ Dropped foreign key fk_media_item")
        except Exception as e:
            print(f"⊘ Foreign key may not exist: {str(e)}")

        try:
            # Drop indexes
            db.session.execute(text("DROP INDEX idx_media_item_id ON media"))
            print("✓ Dropped index idx_media_item_id")
        except Exception as e:
            print(f"⊘ Index may not exist: {str(e)}")

        # Drop columns
        try:
            db.session.execute(text("ALTER TABLE media DROP COLUMN item_id"))
            print("✓ Dropped column item_id")
        except Exception as e:
            print(f"⊘ Column item_id may not exist: {str(e)}")

        try:
            db.session.execute(text("ALTER TABLE media DROP COLUMN side"))
            print("✓ Dropped column side")
        except Exception as e:
            print(f"⊘ Column side may not exist: {str(e)}")

        # Drop order_items table
        try:
            db.session.execute(text("DROP TABLE order_items"))
            print("✓ Dropped table order_items")
        except Exception as e:
            print(f"⊘ Table order_items may not exist: {str(e)}")

        db.session.commit()
        print("\n✅ Downgrade completed")


if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv()
    upgrade()
