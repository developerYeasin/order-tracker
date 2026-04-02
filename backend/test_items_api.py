#!/usr/bin/env python3
"""Test the order items API endpoints"""

import os
import sys
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from extensions import db
from models import Order, OrderItem, Media
from datetime import datetime

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{int(os.getenv('DB_PORT', 3306))}/{os.getenv('DB_NAME')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app

def test_items_crud():
    app = create_app()
    with app.app_context():
        # Use an existing order (find one)
        order = Order.query.first()
        if not order:
            print("No orders found. Creating a test order...")
            order = Order(
                customer_name='Test Customer',
                phone_number='1234567890',
                division='Dhaka',
                district='Dhaka',
                upazila_zone='Mirpur',
                address='Test address',
                description='Test order',
                payment_type='COD'
            )
            db.session.add(order)
            db.session.flush()
            status = OrderStatus(order_id=order.id)
            db.session.add(status)
            db.session.commit()
            print(f"Created test order ID: {order.id}")

        print(f"\nTesting with order ID: {order.id}")

        # Create an item
        print("\n1. Creating item...")
        item = OrderItem(
            order_id=order.id,
            size='L',
            quantity=2,
            position=1
        )
        db.session.add(item)
        db.session.commit()
        print(f"Created item ID: {item.id}, size: {item.size}, qty: {item.quantity}")

        # Add media (simulate item image)
        print("\n2. Adding media for item...")
        media = Media(
            order_id=order.id,
            item_id=item.id,
            side='front',
            file_path=f'order_{order.id}/item_{item.id}/test.jpg',
            file_url=f'http://localhost:8090/uploads/order_{order.id}/item_{item.id}/test.jpg',
            file_type='Image'
        )
        db.session.add(media)
        db.session.commit()
        print(f"Added media ID: {media.id} for item {item.id}")

        # Update item
        print("\n3. Updating item quantity...")
        item.quantity = 3
        db.session.commit()
        print(f"Updated item quantity to {item.quantity}")

        # Query item with media
        print("\n4. Querying item with media...")
        fetched_item = OrderItem.query.get(item.id)
        print(f"Item: size={fetched_item.size}, qty={fetched_item.quantity}")
        print(f"Media count: {len(fetched_item.media)}")
        for m in fetched_item.media:
            print(f"  - Media ID {m.id}: side={m.side}, file_url={m.file_url}")

        # Delete item (cascade should delete its media)
        print("\n5. Deleting item...")
        item_id = item.id
        db.session.delete(item)
        db.session.commit()
        print(f"Deleted item {item_id}")

        # Verify media deleted
        media_exists = Media.query.filter_by(id=media.id).first()
        print(f"Media {media.id} exists after cascade delete: {media_exists is not None}")

        print("\n✅ All item tests passed!")

if __name__ == '__main__':
    test_items_crud()
