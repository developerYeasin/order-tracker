const axios = require("axios");
const { Setting } = require("../models");

class SteadfastService {
  constructor() {
    this.baseUrl = "https://portal.packzy.com/api/v1";
  }

  async isConfigured() {
    const apiKey = await Setting.getValue("steadfast_api_key");
    const secretKey = await Setting.getValue("steadfast_secret_key");
    return Boolean(apiKey && secretKey);
  }

  async _getHeaders() {
    const apiKey = await Setting.getValue("steadfast_api_key");
    const secretKey = await Setting.getValue("steadfast_secret_key");
    if (!apiKey || !secretKey) {
      throw new Error("Steadfast API credentials not configured.");
    }
    return {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
    };
  }

  async _makeRequest(method, endpoint, data = null, params = null) {
    const headers = await this._getHeaders();
    const url = `${this.baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
    const response = await axios({
      method,
      url,
      data,
      params,
      headers,
      timeout: 30000,
    });
    return response.data;
  }

  normalizePhone(phoneRaw) {
    const digits = String(phoneRaw).replace(/[^0-9]/g, "");
    let phoneDigits = digits;
    if (phoneDigits.startsWith("880")) {
      phoneDigits = phoneDigits.slice(3);
    }
    if (phoneDigits.length === 10 && phoneDigits.startsWith("1")) {
      phoneDigits = `0${phoneDigits}`;
    }
    if (!/^01\d{9}$/.test(phoneDigits)) {
      throw new Error(
        "recipient_phone must be a valid Bangladeshi mobile number (11 digits starting with 01)",
      );
    }
    return phoneDigits;
  }

  async createOrder(orderData) {
    try {
      console.log("orderData:", orderData);
      const required = [
        "invoice",
        "recipient_name",
        "recipient_phone",
        "recipient_address",
        "cod_amount",
      ];
      for (const field of required) {
        if (orderData[field] == null) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const payload = {
        invoice: String(orderData.invoice),
        recipient_name: String(orderData.recipient_name).slice(0, 100),
        recipient_phone: this.normalizePhone(orderData.recipient_phone),
        recipient_address: String(orderData.recipient_address).slice(0, 250),
        cod_amount: Number(orderData.cod_amount),
      };

      if (orderData.recipient_email)
        payload.recipient_email = String(orderData.recipient_email);
      if (orderData.alternative_phone)
        payload.alternative_phone = String(orderData.alternative_phone);
      if (orderData.note) payload.note = String(orderData.note).slice(0, 500);
      if (orderData.item_description)
        payload.item_description = String(orderData.item_description).slice(
          0,
          500,
        );
      if (orderData.total_lot != null)
        payload.total_lot = Number(orderData.total_lot);
      if (orderData.delivery_type != null)
        payload.delivery_type = Number(orderData.delivery_type);
      console.log(" new payload:", payload);
      return await this._makeRequest("POST", "/create_order", payload);
    } catch (error) {
      console.error("Error creating Steadfast order:", error);
      throw error;
    }
  }

  async bulkCreateOrders(ordersData) {
    if (!Array.isArray(ordersData)) {
      throw new Error("orders_data must be an array");
    }
    if (ordersData.length > 500) {
      throw new Error("Maximum 500 orders per bulk request");
    }
    return this._makeRequest("POST", "/create_order/bulk-order", {
      data: ordersData,
    });
  }

  async getStatusByConsignmentId(consignmentId) {
    return this._makeRequest("GET", `/status_by_cid/${consignmentId}`);
  }

  async getStatusByInvoice(invoice) {
    return this._makeRequest("GET", `/status_by_invoice/${invoice}`);
  }

  async getStatusByTrackingCode(trackingCode) {
    return this._makeRequest("GET", `/status_by_trackingcode/${trackingCode}`);
  }

  async getCurrentBalance() {
    return this._makeRequest("GET", "/get_balance");
  }

  async createReturnRequest({
    consignment_id,
    invoice,
    tracking_code,
    reason,
  }) {
    if (!consignment_id && !invoice && !tracking_code) {
      throw new Error("Must provide consignment_id, invoice, or tracking_code");
    }
    const payload = {};
    if (consignment_id) payload.consignment_id = consignment_id;
    if (invoice) payload.invoice = invoice;
    if (tracking_code) payload.tracking_code = tracking_code;
    if (reason) payload.reason = reason;
    return this._makeRequest("POST", "/create_return_request", payload);
  }

  async getReturnRequest(returnId) {
    return this._makeRequest("GET", `/get_return_request/${returnId}`);
  }

  async getReturnRequests() {
    return this._makeRequest("GET", "/get_return_requests");
  }

  async getPayments() {
    return this._makeRequest("GET", "/payments");
  }

  async getPaymentWithConsignments(paymentId) {
    return this._makeRequest("GET", `/payments/${paymentId}`);
  }

  async getPoliceStations() {
    return this._makeRequest("GET", "/police_stations");
  }
}

module.exports = SteadfastService;
