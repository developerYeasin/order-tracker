#!/usr/bin/env python3
from app import create_app, db

app = create_app()

with app.app_context():
    from models import Order
    count = Order.query.count()
    print(f"Order count: {count}")
