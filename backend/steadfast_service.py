"""
Steadfast Courier Limited API Service
Handles all integration with Steadfast Courier API
"""

import os
import json
import requests
from datetime import datetime
from flask import current_app
from models import Setting


class SteadfastService:
    """Service for interacting with Steadfast Courier API"""

    def __init__(self):
        self.base_url = Setting.get('steadfast_base_url', 'https://portal.packzy.com/api/v1')
        self.api_key = Setting.get('steadfast_api_key')
        self.secret_key = Setting.get('steadfast_secret_key')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Api-Key': self.api_key,
            'Secret-Key': self.secret_key
        }) if self.api_key and self.secret_key else None

    def is_configured(self):
        """Check if Steadfast API credentials are configured"""
        return bool(self.api_key and self.secret_key)

    def _make_request(self, method, endpoint, data=None, params=None):
        """Make authenticated request to Steadfast API"""
        if not self.is_configured():
            raise ValueError("Steadfast API credentials not configured. Please set API key and secret key in settings.")

        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        try:
            response = self.session.request(method, url, json=data, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f'Steadfast API error: {str(e)}')
            if hasattr(e.response, 'text'):
                current_app.logger.error(f'Response: {e.response.text}')
            raise

    # ========== Order Management ==========

    def create_order(self, order_data):
        """
        Create a single consignment/order with Steadfast

        Required fields in order_data:
        - invoice: unique invoice number (string)
        - recipient_name: string
        - recipient_phone: 11 digits
        - recipient_address: string
        - cod_amount: numeric (BDT)

        Optional:
        - recipient_email
        - alternative_phone
        - note
        - item_description
        - total_lot
        - delivery_type (0=home delivery, 1=point delivery)
        """
        # Validate required fields
        required = ['invoice', 'recipient_name', 'recipient_phone', 'recipient_address', 'cod_amount']
        for field in required:
            if field not in order_data or order_data[field] is None:
                raise ValueError(f"Missing required field: {field}")

        # Normalize and validate phone number for Bangladeshi mobile numbers
        # Expected final format: 11 digits starting with '01'
        phone_raw = str(order_data['recipient_phone'])
        # Extract all digits
        phone_digits = ''.join(filter(str.isdigit, phone_raw))

        # Remove Bangladesh country code if present (880)
        if phone_digits.startswith('880'):
            phone_digits = phone_digits[3:]

        # If after removing country code we have 10 digits starting with '1', prepend '0' to get local format
        if len(phone_digits) == 10 and phone_digits.startswith('1'):
            phone_digits = '0' + phone_digits

        # Validate final format: 11 digits, all digits, starts with '01'
        if len(phone_digits) != 11 or not phone_digits.isdigit() or not phone_digits.startswith('01'):
            raise ValueError("recipient_phone must be a valid Bangladeshi mobile number (11 digits starting with 01)")

        # Clean data - ensure numbers are strings for JSON compatibility
        payload = {
            'invoice': str(order_data['invoice']),
            'recipient_name': str(order_data['recipient_name'])[:100],
            'recipient_phone': phone_digits,  # Use normalized phone
            'recipient_address': str(order_data['recipient_address'])[:250],
            'cod_amount': float(order_data['cod_amount'])
        }

        # Optional fields
        if 'recipient_email' in order_data and order_data['recipient_email']:
            payload['recipient_email'] = str(order_data['recipient_email'])
        if 'alternative_phone' in order_data and order_data['alternative_phone']:
            payload['alternative_phone'] = str(order_data['alternative_phone'])
        if 'note' in order_data and order_data['note']:
            payload['note'] = str(order_data['note'])[:500]
        if 'item_description' in order_data and order_data['item_description']:
            payload['item_description'] = str(order_data['item_description'])[:500]
        if 'total_lot' in order_data:
            payload['total_lot'] = int(order_data['total_lot'])
        if 'delivery_type' in order_data:
            payload['delivery_type'] = int(order_data['delivery_type'])

        return self._make_request('POST', '/create_order', data=payload)

    def bulk_create_orders(self, orders_data):
        """
        Create multiple consignments in bulk

        orders_data: list of order objects (max 500)
        Each order must have: invoice, recipient_name, recipient_address, recipient_phone, cod_amount
        """
        if not isinstance(orders_data, list):
            raise ValueError("orders_data must be a list")

        if len(orders_data) > 500:
            raise ValueError("Maximum 500 orders per bulk request")

        # Validate each order
        for i, order in enumerate(orders_data):
            required = ['invoice', 'recipient_name', 'recipient_address', 'recipient_phone', 'cod_amount']
            for field in required:
                if field not in order or order[field] is None:
                    raise ValueError(f"Order {i+1}: Missing required field '{field}'")

        payload = {'data': orders_data}
        return self._make_request('POST', '/create_order/bulk-order', data=payload)

    # ========== Status Checking ==========

    def get_status_by_consignment_id(self, consignment_id):
        """Get delivery status by consignment ID"""
        return self._make_request('GET', f'/status_by_cid/{consignment_id}')

    def get_status_by_invoice(self, invoice):
        """Get delivery status by invoice number"""
        return self._make_request('GET', f'/status_by_invoice/{invoice}')

    def get_status_by_tracking_code(self, tracking_code):
        """Get delivery status by tracking code"""
        return self._make_request('GET', f'/status_by_trackingcode/{tracking_code}')

    # ========== Balance & Returns ==========

    def get_current_balance(self):
        """Get current cash balance"""
        return self._make_request('GET', '/get_balance')

    def create_return_request(self, consignment_id=None, invoice=None, tracking_code=None, reason=None):
        """
        Create a return request
        Provide either consignment_id, invoice, or tracking_code
        """
        if not any([consignment_id, invoice, tracking_code]):
            raise ValueError("Must provide consignment_id, invoice, or tracking_code")

        payload = {}
        if consignment_id:
            payload['consignment_id'] = consignment_id
        if invoice:
            payload['invoice'] = invoice
        if tracking_code:
            payload['tracking_code'] = tracking_code
        if reason:
            payload['reason'] = reason

        return self._make_request('POST', '/create_return_request', data=payload)

    def get_return_request(self, return_id):
        """Get single return request details"""
        return self._make_request('GET', f'/get_return_request/{return_id}')

    def get_return_requests(self):
        """Get all return requests"""
        return self._make_request('GET', '/get_return_requests')

    # ========== Payments ==========

    def get_payments(self):
        """Get recent payment records"""
        return self._make_request('GET', '/payments')

    def get_payment_with_consignments(self, payment_id):
        """Get single payment with consignment details"""
        return self._make_request('GET', f'/payments/{payment_id}')

    # ========== Reference Data ==========

    def get_police_stations(self):
        """Get list of police stations"""
        return self._make_request('GET', '/police_stations')

    # ========== Webhook Management ==========

    def send_webhook(self, webhook_url, payload):
        """
        Send webhook notification (used by webhook dispatcher)
        This is for internal use when Steadfast sends us notifications
        """
        try:
            response = requests.post(webhook_url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            current_app.logger.error(f'Webhook send failed: {str(e)}')
            return False


# Delivery status mapping
DELIVERY_STATUSES = {
    'pending': 'Consignment is not delivered or cancelled yet.',
    'delivered_approval_pending': 'Consignment is delivered but waiting for admin approval.',
    'partial_delivered_approval_pending': 'Consignment is delivered partially and waiting for admin approval.',
    'cancelled_approval_pending': 'Consignment is cancelled and waiting for admin approval.',
    'unknown_approval_pending': 'Unknown Pending status. Need contact with the support team.',
    'delivered': 'Consignment is delivered and balance added.',
    'partial_delivered': 'Consignment is partially delivered and balance added.',
    'cancelled': 'Consignment is cancelled and balance updated.',
    'hold': 'Consignment is held.',
    'in_review': 'Order is placed and waiting to be reviewed.',
    'unknown': 'Unknown status. Need contact with the support team.'
}
