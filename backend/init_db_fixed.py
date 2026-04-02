#!/usr/bin/env python3
"""
Initialize database tables for order-tracker.
"""

from app import create_app, db

app = create_app()

with app.app_context():
    db.create_all()
    print("✓ Database tables created successfully")
