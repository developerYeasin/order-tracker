import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to every request from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Auth API
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  verify: () => api.get('/auth/verify'),
  logout: () => api.post('/auth/logout'),
}

// User Management API (Admin only)
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (userData) => api.post('/users', userData),
  delete: (userId) => api.delete(`/users/${userId}`),
}


// Orders API
export const ordersApi = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.division) params.append('division', filters.division)
    if (filters.district) params.append('district', filters.district)
    if (filters.status) params.append('status', filters.status)
    return api.get(`/orders?${params.toString()}`)
  },
  getById: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/orders/${id}${query ? '?' + query : ''}`)
  },
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  updateStatus: (id, statusData) => api.put(`/orders/${id}/status`, statusData),
  // Order Items API
  getItems: (orderId) => api.get(`/orders/${orderId}/items`),
  createItem: (orderId, itemData) => api.post(`/orders/${orderId}/items`, itemData),
  updateItem: (orderId, itemId, updates) => api.put(`/orders/${orderId}/items/${itemId}`, updates),
  deleteItem: (orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}`),
}

// Media API
export const mediaApi = {
  getAll: (orderId) => api.get(`/orders/${orderId}/media`),
  uploadDesignFiles: (orderId, files) => {
    const formData = new FormData()
    const fileArray = files ? (Array.isArray(files) ? files : Array.from(files)) : []
    fileArray.forEach((file) => {
      formData.append('files', file)
    })
    // Mark as design files
    formData.append('is_design', 'true')
    return api.post(`/orders/${orderId}/media`, formData, {
      headers: { 'Content-Type': undefined }
    })
  },
  upload: (orderId, files, itemId = null, side = null) => {
    const formData = new FormData()
    const fileArray = files ? (Array.isArray(files) ? files : Array.from(files)) : []
    fileArray.forEach((file) => {
      formData.append('files', file)
    })
    if (itemId !== null) {
      formData.append('item_id', itemId)
    }
    if (side !== null) {
      formData.append('side', side)
    }
    // If this is an order-level upload (no itemId), mark as design files
    if (itemId === null) {
      formData.append('is_design', 'true')
    }
    return api.post(`/orders/${orderId}/media`, formData, {
      headers: { 'Content-Type': undefined }
    })
  },
  delete: (mediaId) => api.delete(`/media/${mediaId}`),
}

// Orders API extension for position
ordersApi.updatePosition = (orderId, position) => api.put(`/orders/${orderId}/position`, { position })
ordersApi.bulkDelete = (orderIds) => api.post('/orders/bulk-delete', { order_ids: orderIds })

// Analytics API
export const analyticsApi = {
  getDashboardStats: () => api.get('/analytics/dashboard'),
  getRegionalBreakdown: (division) => api.get(`/analytics/regions?division=${encodeURIComponent(division)}`),
  getTrends: () => api.get('/analytics/trends'),
}

// Activity API
export const activityApi = {
  getLogs: (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.order_id) params.append('order_id', filters.order_id)
    if (filters.limit) params.append('limit', filters.limit)
    return api.get(`/activity/logs?${params.toString()}`)
  },
  getRecent: (limit = 10) => api.get(`/activity/recent?limit=${limit}`),
}


// Settings API
export const settingsApi = {
  getAll: () => api.get('/settings'),
  update: (key, value, type = 'string', category = 'general', description = null, is_encrypted = false) =>
    api.post('/settings', { key, value, type, category, description, is_encrypted }),
  delete: (key) => api.delete(`/settings/${key}`),
  testSteadfast: () => api.post('/settings/steadfast/test'),
  createSteadfastOrder: (orderId) => api.post(`/settings/steadfast/order/${orderId}`),
}

