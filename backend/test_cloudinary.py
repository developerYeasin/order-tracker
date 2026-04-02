#!/usr/bin/env python
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
import os

load_dotenv()

cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
api_key = os.getenv('CLOUDINARY_API_KEY')
api_secret = os.getenv('CLOUDINARY_API_SECRET')


try:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True
    )
    print("Cloudinary configured successfully")

    # Test with a sample image (1x1 pixel PNG)
    import base64
    # A tiny 1x1 transparent PNG
    test_image_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=')

    result = cloudinary.uploader.upload(
        test_image_data,
        folder="test_upload",
        resource_type="auto"
    )
    print(f"Upload successful! URL: {result.get('secure_url')}")
    print(f"Public ID: {result.get('public_id')}")

    # Clean up
    cloudinary.uploader.destroy(result['public_id'])
    print("Test file deleted")

except Exception as e:
    print(f"Error: {e}")
