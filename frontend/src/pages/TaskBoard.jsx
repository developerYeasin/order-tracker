import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { ordersApi, mediaApi } from '../services/api'
import OrderModal from '../components/OrderModal'

const getStatusColor = (status) => {
  if (status === 'Delivered') return 'bg-green-500'
  if (status === 'Returned') return 'bg-red-500'
  if (status === 'Submitted') return 'bg-yellow-500'
  return 'bg-blue-500'
}

const COLUMNS = [
  { id: 'design_pending', name: 'Design Pending' },
  { id: 'design_ready', name: 'Design Ready' },
  { id: 'ready_to_submit', name: 'Ready to Submit' },
  { id: 'Submitted', name: 'Submitted' },
  { id: 'Delivered', name: 'Delivered' },
  { id: 'Returned', name: 'Returned' },
]

export default function TaskBoard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  const [draggingOrderId, setDraggingOrderId] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const fetchOrders = async () => {
    try {
      const res = await ordersApi.getAll()
      setOrders(res.data)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      showNotification('Failed to load orders', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openOrderModal = async (order) => {
    try {
      const res = await ordersApi.getById(order.id, { include_items: true })
      setSelectedOrder(res.data)
    } catch (error) {
      console.error('Failed to fetch order details:', error)
      showNotification('Failed to load order details', 'error')
    }
  }

  const closeModal = () => {
    setSelectedOrder(null)
  }

  const handleSaveOrder = async (orderData) => {
    setSaving(true)
    try {
      // Separate media files if present
      const mediaFiles = orderData.media_files
      const updateData = { ...orderData }
      delete updateData.media_files

      // Update order
      await ordersApi.update(updateData.id, updateData)

      // Upload media if any
      if (mediaFiles && mediaFiles.length > 0) {
        try {
          await mediaApi.upload(updateData.id, mediaFiles)
        } catch (mediaErr) {
          console.warn('Media upload failed:', mediaErr)
        }
      }

      showNotification('Order updated successfully!')
      fetchOrders()
      if (selectedOrder && selectedOrder.id === orderData.id) {
        // Refresh selected order data
        const res = await ordersApi.getById(selectedOrder.id, { include_items: true })
        setSelectedOrder(res.data)
      }
    } catch (error) {
      console.error('Failed to update order:', error)
      showNotification('Failed to update order', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const orderId = parseInt(draggableId)
    const sourceCol = source.droppableId
    const destCol = destination.droppableId
    const destIndex = destination.index

    setDraggingOrderId(orderId)

    // Get current sorted orders for both columns (based on current state)
    const sourceOrders = getColumnOrders(sourceCol)
    const destOrders = getColumnOrders(destCol)

    // Find the dragged order in source column
    const draggedIndexInSource = sourceOrders.findIndex(o => o.id === orderId)
    if (draggedIndexInSource === -1) {
      setDraggingOrderId(null)
      return
    }
    const draggedOrder = sourceOrders[draggedIndexInSource]

    // Determine if status change (different column)
    const statusChanged = sourceCol !== destCol

    // Compute new order arrays for source and destination columns after drag
    let newSourceOrders, newDestOrders

    if (statusChanged) {
      newSourceOrders = sourceOrders.filter((_, idx) => idx !== draggedIndexInSource)
      newDestOrders = [
        ...destOrders.slice(0, destIndex),
        draggedOrder,
        ...destOrders.slice(destIndex)
      ]
    } else {
      const withoutDragged = sourceOrders.filter((_, idx) => idx !== draggedIndexInSource)
      newSourceOrders = [
        ...withoutDragged.slice(0, destIndex),
        draggedOrder,
        ...withoutDragged.slice(destIndex)
      ]
      newDestOrders = destOrders
    }

    // Assign positions (0-based index within column)
    const positionUpdates = []
    const allAffectedOrders = [...newSourceOrders, ...newDestOrders]
    const seen = new Set()

    allAffectedOrders.forEach((order, idx) => {
      // Find which column this order belongs to for correct position
      const targetCol = newSourceOrders.find(o => o.id === order.id) ? newSourceOrders : newDestOrders
      const targetIdx = targetCol.findIndex(o => o.id === order.id)
      if (order.position !== targetIdx && !seen.has(order.id)) {
        positionUpdates.push({ id: order.id, position: targetIdx })
        seen.add(order.id)
      }
    })

    // Step 1: If status changed, update status
    if (statusChanged) {
      const updateData = {}
      if (destCol === 'design_pending') {
        updateData.design_ready = false
        updateData.is_printed = false
        updateData.picking_done = false
        updateData.delivery_status = null
      } else if (destCol === 'design_ready') {
        updateData.design_ready = true
        updateData.is_printed = false
        updateData.picking_done = false
        updateData.delivery_status = null
      } else if (destCol === 'ready_to_submit') {
        updateData.design_ready = true
        updateData.is_printed = true
        updateData.delivery_status = null
      } else {
        updateData.design_ready = true
        updateData.is_printed = true
        updateData.picking_done = true
        updateData.delivery_status = destCol
      }

      try {
        await ordersApi.updateStatus(orderId, updateData)
        setOrders(prev => prev.map(order =>
          order.id === orderId
            ? { ...order, status: { ...order.status, ...updateData } }
            : order
        ))
        showNotification(`Order #${orderId} moved to ${COLUMNS.find(c => c.id === destCol)?.name}`)
      } catch (error) {
        console.error('Failed to update order status:', error)
        showNotification('Failed to move order. Please try again.', 'error')
        fetchOrders()
        setDraggingOrderId(null)
        return
      }
    }

    // Step 2: Update positions (for dragged and any affected orders)
    if (positionUpdates.length > 0) {
      setOrders(prev => prev.map(order => {
        const upd = positionUpdates.find(u => u.id === order.id)
        if (upd) {
          return { ...order, position: upd.position }
        }
        return order
      }))

      try {
        await Promise.all(
          positionUpdates.map(u => ordersApi.updatePosition(u.id, u.position))
        )
      } catch (error) {
        console.error('Failed to update positions:', error)
        // Silently retry in background - don't block UI
        setTimeout(fetchOrders, 2000)
      }
    }

    setDraggingOrderId(null)
  }

  const getColumnOrders = (columnId) => {
    const filtered = orders.filter((order) => {
      const status = order.status || {}
      if (columnId === 'design_pending') {
        return !status.design_ready && !status.is_printed && !status.picking_done && !status.delivery_status
      }
      if (columnId === 'design_ready') {
        return status.design_ready === true && !status.is_printed && !status.picking_done && !status.delivery_status
      }
      if (columnId === 'ready_to_submit') {
        // Orders that are printed or picked but not yet delivered/submitted
        return (status.is_printed === true || status.picking_done === true) && !status.delivery_status
      }
      return status.delivery_status === columnId
    })
    // Sort by position if available, otherwise by ID
    return filtered.sort((a, b) => {
      if (a.position !== null && b.position !== null) {
        return a.position - b.position
      }
      return a.id - b.id
    })
  }

  const getOrderProgress = (order) => {
    const steps = [
      { label: 'Design', done: order.status?.design_ready },
      { label: 'Print', done: order.status?.is_printed },
      { label: 'Parcel', done: !!order.courier_parcel_id },
      { label: 'Deliver', done: order.status?.delivery_status },
    ]
    return steps
  }

  const getTotalItems = (order) => {
    if (!order.items) return 0
    return order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Board</h1>
          <p className="text-dark-400 mt-1">Drag orders between columns to update status</p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto pb-4" style={{ flex: '1 0 auto' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4" style={{ width: 'max-content' }}>
            {COLUMNS.map((column) => (
              <div
                key={column.id}
                className="flex-shrink-0 w-80 bg-dark-800 rounded-lg border border-dark-700 flex flex-col"
              >
                <div className="p-4 border-b border-dark-700">
                  <h2 className="font-semibold text-white">{column.name}</h2>
                  <p className="text-sm text-dark-400">
                    {getColumnOrders(column.id).length} orders
                  </p>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3 overflow-y-auto min-h-[250px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-dark-700' : ''
                      }`}
                    >
                      {getColumnOrders(column.id).length === 0 ? (
                        <div className="flex items-center justify-center h-full text-dark-500 text-sm text-center p-4">
                          {snapshot.isDraggingOver ? 'Drop order here' : 'No orders in this column'}
                        </div>
                      ) : (
                        <>
                          {getColumnOrders(column.id).map((order, index) => {
                            const progress = getOrderProgress(order)
                            const totalItems = getTotalItems(order)
                            const isDragging = snapshot.draggingFromThisWith === order.id

                            return (
                              <Draggable
                                key={order.id}
                                draggableId={String(order.id)}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => openOrderModal(order)}
                                    className={`p-4 mb-3 bg-dark-900 rounded-lg border transition-all ${
                                      isDragging || snapshot.isDragging
                                        ? 'shadow-xl ring-2 ring-primary-500 border-primary-500 scale-102 z-50'
                                        : 'border-dark-700 hover:border-dark-600 hover:bg-dark-800'
                                    }`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      opacity: draggingOrderId === order.id ? 0.5 : 1,
                                    }}
                                  >
                                    {/* Header: Order ID and Date */}
                                    <div className="flex justify-between items-start mb-3">
                                      <span className="text-xs font-mono text-primary-400 bg-dark-800 px-2 py-1 rounded">
                                        #{order.id}
                                      </span>
                                      <span className="text-xs text-dark-500">
                                        {new Date(order.created_at).toLocaleDateString()}
                                      </span>
                                    </div>

                                    {/* Customer Info */}
                                    <h3 className="font-semibold text-white mb-1 text-sm">
                                      {order.customer_name}
                                    </h3>
                                    <p className="text-xs text-dark-400 mb-2">
                                      {order.phone_number}
                                    </p>
                                    <p className="text-xs text-dark-500 mb-3">
                                      {order.district}, {order.division}
                                    </p>

                                    {/* Order Stats */}
                                    <div className="flex gap-3 mb-3 text-xs">
                                      {totalItems > 0 && (
                                        <span className="bg-dark-800 text-dark-300 px-2 py-1 rounded">
                                          {totalItems} item{totalItems > 1 ? 's' : ''}
                                        </span>
                                      )}
                                      {order.courier_parcel_id && (
                                        <span className="bg-primary-900/30 text-primary-400 px-2 py-1 rounded text-[10px] truncate max-w-[120px]" title={order.courier_parcel_id}>
                                          📦 {order.courier_parcel_id}
                                        </span>
                                      )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1">
                                      {progress.map((step, idx) => (
                                        <div key={step.label} className="flex items-center gap-2">
                                          <div className="w-12 text-[10px] text-dark-500">{step.label}</div>
                                          <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full transition-all ${
                                                step.done ? 'bg-primary-500' : 'bg-dark-600'
                                              }`}
                                              style={{ width: step.done ? '100%' : '0%' }}
                                            />
                                          </div>
                                          {step.done && (
                                            <svg className="w-3 h-3 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={closeModal}
          onSave={handleSaveOrder}
          loading={saving}
        />
      )}
    </div>
  )
}
