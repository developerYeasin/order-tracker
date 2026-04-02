#!/usr/bin/env python3
"""
Database initialization script.
Creates all tables and creates a default admin user if none exists.
"""

import os
from datetime import datetime
from bcrypt import hashpw, gensalt
from flask import Flask
from dotenv import load_dotenv
from models import db, User

# Load environment variables from .env
load_dotenv()


def init_database():
    app = Flask(__name__)

    # Load environment variables
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER', 'order_user')}:{os.getenv('DB_PASSWORD', 'order_pass')}@{os.getenv('DB_HOST', 'localhost')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME', 'order_tracker')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    with app.app_context():
        # Create all tables
        db.create_all()
        print("✓ All tables created successfully")

        # Create default admin user if no users exist
        if User.query.count() == 0:
            default_email = 'admin@example.com'
            default_password = 'admin123'
            password_hash = hashpw(default_password.encode('utf-8'), gensalt()).decode('utf-8')

            admin = User(
                email=default_email,
                password_hash=password_hash,
                name='Administrator',
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()

            print(f"\n✓ Default admin user created:")
            print(f"   Email: {default_email}")
            print(f"   Password: {default_password}")
            print("\n   ⚠️  Change the default password immediately after first login!")
        else:
            print("\nℹ️  Users already exist in the database. Skipping default admin creation.")

        print("\n✓ Database initialization complete!")

if __name__ == '__main__':
    init_database()
