"""
Migration: Add note column to order_items table

Adds an optional note field to order items for storing additional text information.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from extensions import db
from sqlalchemy import text, MetaData


def upgrade():
    """Add note column to order_items table"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        # Check if column already exists
        inspector = db.inspect(db.engine)
        order_items_columns = [col['name'] for col in inspector.get_columns('order_items')]

        if 'note' not in order_items_columns:
            db.session.execute(text("""
                ALTER TABLE order_items
                ADD COLUMN note TEXT NULL AFTER position
            """))
            print("✓ Added note column to order_items table")
        else:
            print("⊘ note column already exists in order_items table")

        db.session.commit()
        print("\n✅ Migration completed successfully")


def downgrade():
    """Remove note column from order_items table"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        # Check if column exists
        inspector = db.inspect(db.engine)
        order_items_columns = [col['name'] for col in inspector.get_columns('order_items')]

        if 'note' in order_items_columns:
            db.session.execute(text("""
                ALTER TABLE order_items
                DROP COLUMN note
            """))
            print("✓ Dropped note column from order_items table")
        else:
            print("⊘ note column does not exist in order_items table")

        db.session.commit()
        print("\n✅ Downgrade completed")


if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv()
    upgrade()
