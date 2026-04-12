import { useState, useEffect, useCallback, useMemo } from 'react'
import { ordersApi } from '../services/api'

export function useOrders(initialFilters = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(initialFilters)

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await ordersApi.getAll(filters)
      setOrders(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch orders')
      console.error('useOrders: fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const updateOrder = useCallback(async (id, data) => {
    const res = await ordersApi.update(id, data)
    const updated = res.data
    setOrders(prev => prev.map(order => order.id === id ? updated : order))
    return updated
  }, [])

  const updateOrderStatus = useCallback(async (id, statusData) => {
    const res = await ordersApi.updateStatus(id, statusData)
    const updated = res.data
    setOrders(prev => prev.map(order => order.id === id ? { ...order, status: { ...order.status, ...statusData } } : order))
    return updated
  }, [])

  const updateOrderPosition = useCallback(async (id, position) => {
    await ordersApi.updatePosition(id, position)
    setOrders(prev => prev.map(order => order.id === id ? { ...order, position } : order))
  }, [])

  const deleteOrder = useCallback(async (id) => {
    await ordersApi.delete(id)
    setOrders(prev => prev.filter(order => order.id !== id))
  }, [])

  const bulkDeleteOrders = useCallback(async (orderIds) => {
    await ordersApi.bulkDelete(orderIds)
    setOrders(prev => prev.filter(order => !orderIds.includes(order.id)))
  }, [])

  const refresh = useCallback(() => {
    fetchOrders()
  }, [fetchOrders])

  const memoizedOrders = useMemo(() => orders, [orders])

  return {
    orders: memoizedOrders,
    loading,
    error,
    filters,
    setFilters,
    updateOrder,
    updateOrderStatus,
    updateOrderPosition,
    deleteOrder,
    bulkDeleteOrders,
    refresh,
    fetchOrders,
  }
}

export function useOrder(orderId) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOrder = useCallback(async (includeItems = false) => {
    if (!orderId) return
    try {
      setLoading(true)
      setError(null)
      const res = await ordersApi.getById(orderId, { include_items: includeItems })
      setOrder(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch order')
      console.error('useOrder: fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const update = useCallback(async (data) => {
    const res = await ordersApi.update(orderId, data)
    const updated = res.data
    setOrder(updated)
    return updated
  }, [orderId])

  const updateStatus = useCallback(async (statusData) => {
    const res = await ordersApi.updateStatus(orderId, statusData)
    const updated = res.data
    setOrder(prev => ({ ...prev, status: { ...prev.status, ...statusData } }))
    return updated
  }, [orderId])

  const refreshWithItems = useCallback(async () => {
    await fetchOrder(true)
  }, [fetchOrder])

  return {
    order,
    loading,
    error,
    update,
    updateStatus,
    refresh,
    refreshWithItems,
    fetchOrder,
  }
}

export function useOrderItems(orderId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItems = useCallback(async () => {
    if (!orderId) return
    try {
      setLoading(true)
      setError(null)
      const res = await ordersApi.getItems(orderId)
      setItems(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch items')
      console.error('useOrderItems: fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const createItem = useCallback(async (itemData) => {
    const res = await ordersApi.createItem(orderId, itemData)
    const newItem = res.data
    setItems(prev => [...prev, newItem])
    return newItem
  }, [orderId])

  const updateItem = useCallback(async (itemId, updates) => {
    const res = await ordersApi.updateItem(orderId, itemId, updates)
    const updated = res.data
    setItems(prev => prev.map(item => item.id === itemId ? updated : item))
    return updated
  }, [orderId])

  const deleteItem = useCallback(async (itemId) => {
    await ordersApi.deleteItem(orderId, itemId)
    setItems(prev => prev.filter(item => item.id !== itemId))
  }, [orderId])

  return {
    items,
    loading,
    error,
    createItem,
    updateItem,
    deleteItem,
    refresh: fetchItems,
  }
}
