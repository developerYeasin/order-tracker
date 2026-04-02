#!/usr/bin/env python
import requests
import os

# Get auth token first (you may need to adjust this based on your auth flow)
BASE_URL = "http://localhost:8090/api"

# First, create an order
order_data = {
    "customer_name": "Test Customer",
    "phone_number": "1234567890",
    "division": "Dhaka",
    "district": "Dhaka",
    "upazila_zone": "Gulshan",
    "description": "Test order with media",
    "payment_type": "COD"
}

resp = requests.post(f"{BASE_URL}/orders", json=order_data)
if resp.status_code == 201:
    order_id = resp.json()['id']
    print(f"Order created: {order_id}")

    # Now upload a test file
    print("Uploading test image...")
    # Create a simple 1x1 PNG
    import io
    png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

    files = {'files': ('test.png', io.BytesIO(png_data), 'image/png')}
    upload_resp = requests.post(f"{BASE_URL}/orders/{order_id}/media", files=files)

    print(f"Upload status: {upload_resp.status_code}")
    print(f"Response: {upload_resp.text}")

    # Get media list
    media_resp = requests.get(f"{BASE_URL}/orders/{order_id}/media")
    print(f"\nMedia list: {media_resp.json()}")
else:
    print(f"Failed to create order: {resp.status_code} - {resp.text}")
