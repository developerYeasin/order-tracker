#!/usr/bin/env python3
"""
Simple test script for the caching system.
Run this after starting the Flask app to verify caching works.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from extensions import db
from cache import Cache, CacheEntry
from datetime import datetime, timedelta

# Create a test Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://order_user:order_pass_123!@localhost:3306/order_tracker'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['CACHE_ENABLED'] = True
db.init_app(app)

# Initialize cache
cache = Cache(app)

with app.app_context():
    print("Testing cache system...")

    # Test set and get
    test_key = "test:key:1"
    test_value = {"message": "Hello, cache!", "number": 42}

    print(f"\n1. Setting cache: {test_key}")
    cache.set(test_key, test_value, ttl_seconds=60)
    print("   ✓ Set complete")

    print(f"\n2. Getting cached value: {test_key}")
    retrieved = cache.get(test_key)
    if retrieved == test_value:
        print("   ✓ Cache hit! Value matches.")
    else:
        print(f"   ✗ Cache miss or mismatch. Got: {retrieved}")

    # Test expiration
    print(f"\n3. Testing expiration (set with 1 second TTL)")
    cache.set("test:expire", {"expires": "soon"}, ttl_seconds=1)
    import time
    time.sleep(2)
    expired = cache.get("test:expire")
    if expired is None:
        print("   ✓ Expired correctly (not found)")
    else:
        print(f"   ✗ Still found after expiry: {expired}")

    # Test stats
    stats = cache.get_stats()
    print(f"\n4. Cache statistics: {stats}")

    # Clean up test entries
    cache.delete(test_key)
    cache.delete("test:expire")
    print("\n✓ All tests completed!")
