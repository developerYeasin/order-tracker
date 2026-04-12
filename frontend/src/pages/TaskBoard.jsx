import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { ordersApi, mediaApi } from '../services/api'
import { DashboardSkeleton } from '../components/ui'

const COLUMNS = [
  { id: 'design_pending', name: 'Design Pending', gradient: 'from-orange-500 via-amber-500 to-yellow-500', icon: '📋', description: 'Awaiting design', accent: 'orange' },
  { id: 'design_ready', name: 'Design Ready', gradient: 'from-green-400 via-emerald-500 to-teal-500', icon: '✨', description: 'Design approved', accent: 'green' },
  { id: 'ready_to_submit', name: 'Ready to Submit', gradient: 'from-blue-400 via-cyan-500 to-blue-600', icon: '🚀', description: 'Printed & ready for courier', accent: 'blue' },
  { id: 'Submitted', name: 'In Transit', gradient: 'from-violet-500 via-purple-500 to-fuchsia-500', icon: '🚛', description: 'With courier', accent: 'purple' },
  { id: 'Delivered', name: 'Delivered', gradient: 'from-emerald-400 via-teal-500 to-green-600', icon: '🎉', description: 'Successfully delivered', accent: 'teal' },
  { id: 'Returned', name: 'Returned', gradient: 'from-rose-500 via-red-500 to-orange-500', icon: '↩️', description: 'Returned orders', accent: 'red' },
]

const accentColors = {
  orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-300',
  green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300',
  blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300',
  purple: 'from-violet-500/20 to-purple-500/20 border-purple-500/30 text-purple-300',
  teal: 'from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-300',
  red: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300',
}

const StatCard = ({ label, value, trend, gradient }) => (
  <div className={`bg-gradient-to-br ${gradient} rounded-xl p-3 border border-dark-600/50 shadow-lg backdrop-blur-sm`}>
    <p className="text-xs text-dark-400 mb-1">{label}</p>
    <p className="text-xl font-bold text-white">{value}</p>
    {trend && <p className="text-[10px] text-dark-500 mt-1">{trend}</p>}
  </div>
)

const OrderCard = ({ order, onClick, isDragging }) => {
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
  const progress = [
    { label: 'Design', done: order.status?.design_ready },
    { label: 'Print', done: order.status?.is_printed },
    { label: 'Parcel', done: !!order.courier_parcel_id },
    { label: 'Deliver', done: order.status?.delivery_status },
  ]

  const completedSteps = progress.filter(p => p.done).length

  // Build classes: when dragging, disable hover effects and transitions to prevent offset issues
  const cardClasses = isDragging
    ? `group relative bg-gradient-to-br from-dark-800/95 via-dark-800 to-dark-900/95 border-2 border-primary-500/70 rounded-2xl p-5 cursor-pointer shadow-2xl shadow-primary-500/40 scale-105 rotate-1 z-50 bg-dark-800/98 backdrop-blur-sm`
    : `group relative bg-gradient-to-br from-dark-800/95 via-dark-800 to-dark-900/95 border border-dark-600/60 hover:border-primary-500/60 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:duration-200 shadow-lg hover:shadow-2xl hover:shadow-primary-500/20 hover:-translate-y-1 hover:scale-[1.02] backdrop-blur-sm`

  return (
    <div
      onClick={onClick}
      className={`
        ${cardClasses}
        before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-primary-500/0 before:to-transparent ${isDragging ? 'before:opacity-0' : 'before:opacity-0 hover:before:opacity-5'} before:transition-opacity
      `}
    >
      {/* Priority indicator */}
      <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-gradient-to-b ${
        order.priority === 'urgent' ? 'from-red-500 to-rose-500' :
        order.priority === 'high' ? 'from-orange-500 to-amber-500' :
        order.priority === 'normal' ? 'from-blue-500 to-cyan-500' : 'from-gray-500 to-slate-500'
      }`} />

      {/* Header */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-gradient-to-r from-primary-500/20 to-primary-500/5 border border-primary-500/30 text-primary-300 px-2.5 py-1 rounded-lg font-semibold tracking-wide backdrop-blur-sm">
            #{order.id}
          </span>
          {order.priority && order.priority !== 'normal' && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              order.priority === 'urgent' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
              order.priority === 'high' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
              'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
            }`}>
              {order.priority}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-dark-400 font-medium">
            {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          {completedSteps === 4 && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Complete
            </span>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="mb-4 relative z-10">
        <h3 className="font-bold text-white text-base mb-1.5 group-hover:text-primary-300 transition-colors leading-tight">
          {order.customer_name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-dark-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>{order.phone_number}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-dark-500 mt-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{order.district}, {order.division}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 mb-4 flex-wrap relative z-10">
        {totalItems > 0 && (
          <div className="bg-gradient-to-r from-primary-500/15 to-primary-500/5 border border-primary-500/25 text-primary-200 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {totalItems} item{totalItems > 1 ? 's' : ''}
          </div>
        )}
        {order.price && (
          <div className="bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/25 text-emerald-200 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ৳{Number(order.price).toLocaleString()}
          </div>
        )}
        {order.courier_parcel_id && (
          <div className="bg-gradient-to-r from-violet-500/15 to-violet-500/5 border border-violet-500/25 text-violet-200 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-1.5 truncate max-w-[140px]" title={order.courier_parcel_id}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="truncate">{order.courier_parcel_id}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2.5 relative z-10">
        {progress.map((step, idx) => (
          <div key={step.label} className="flex items-center gap-3 group/progress">
            <div className="w-12 text-[10px] font-semibold text-dark-400 uppercase tracking-wider">{step.label}</div>
            <div className="flex-1 relative h-2 bg-dark-700/70 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ease-out ${
                  step.done
                    ? 'bg-gradient-to-r from-primary-500 via-primary-400 to-accent-cyan shadow-lg shadow-primary-500/30'
                    : 'bg-gradient-to-r from-dark-600 to-dark-700'
                }`}
                style={{ width: step.done ? '100%' : '0%' }}
              />
              {/* Shimmer effect for completed steps */}
              {step.done && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              )}
            </div>
            {step.done ? (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/30">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-dark-600 bg-dark-800" />
            )}
          </div>
        ))}
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/0 to-accent-cyan/0 opacity-0 group-hover:from-primary-500/5 group-hover:to-accent-cyan/5 transition-opacity duration-300 pointer-events-none" />
    </div>
  )
}

const Column = ({ column, orders, onOrderClick, isDraggingOver }) => {
  const gradient = column.gradient || 'from-primary-500 to-primary-400'
  const accent = column.accent || 'blue'

  return (
    <div
      className={`
        flex-shrink-0 w-80 xl:w-96 flex flex-col
        transition-all duration-300
        ${isDraggingOver ? 'scale-[1.02]' : ''}
      `}
    >
      {/* Column Header */}
      <div className={`bg-gradient-to-r ${gradient} rounded-t-3xl p-5 shadow-lg relative overflow-hidden`}>
        <div className="relative z-10 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl filter drop-shadow-lg">{column.icon}</span>
            </div>
            <div>
              <h2 className="font-bold text-white text-xl tracking-tight">{column.name}</h2>
              <p className="text-white/70 text-xs mt-0.5">{column.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white/25 backdrop-blur-sm text-white text-sm font-bold px-3 py-1.5 rounded-full border border-white/20 shadow-lg min-w-[2.5rem] text-center">
              {orders.length}
            </span>
          </div>
        </div>

        {/* Column stats */}
        <div className="flex gap-2 mt-3 relative z-10">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
            <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Total Value</p>
            <p className="text-xs font-bold text-white">
              ৳{orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
            <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Items</p>
            <p className="text-xs font-bold text-white">
              {orders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-4 overflow-y-auto min-h-[500px] rounded-b-3xl border-x-2 border-b-2
              ${snapshot.isDraggingOver
                ? 'bg-dark-800/80 border-primary-500/40 shadow-inner shadow-primary-500/10'
                : 'border-dark-700/40 bg-dark-800/40'
              }
              transition-all duration-300
              backdrop-blur-sm
            `}
            style={{
              maxHeight: 'calc(100vh - 220px)',
              scrollbarWidth: 'thin',
              scrollbarColor: '#4b5563 #1f2937'
            }}
          >
            {orders.length === 0 ? (
              <div className={`
                flex flex-col items-center justify-center h-64 text-center p-8 rounded-2xl
                ${snapshot.isDraggingOver
                  ? 'bg-primary-500/10 border-2 border-dashed border-primary-500 shadow-lg shadow-primary-500/20'
                  : 'bg-dark-800/50 border border-dark-600/50'
                }
                transition-all duration-300
              `}>
                <div className={`text-6xl mb-4 opacity-40 ${snapshot.isDraggingOver ? 'animate-bounce' : ''}`}>
                  {column.icon}
                </div>
                <p className="text-sm font-semibold text-dark-300 mb-1">
                  {snapshot.isDraggingOver ? 'Drop order here' : 'No orders yet'}
                </p>
                <p className="text-xs text-dark-500">{column.description}</p>
              </div>
            ) : (
              <>
                {orders.map((order, index) => (
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
                        onClick={() => onOrderClick(order)}
                        className={`
                          transition-all duration-300 will-change-transform
                          ${snapshot.isDragging
                            ? 'ring-2 ring-primary-500 shadow-2xl shadow-primary-500/40 scale-105 rotate-1 z-50'
                            : 'hover:scale-[1.02]'
                          }
                        `}
                        style={{
                          ...provided.draggableProps.style,
                        }}
                      >
                        <OrderCard
                          order={order}
                          onClick={() => onOrderClick(order)}
                          isDragging={snapshot.isDragging}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export default function TaskBoard() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [draggingOrderId, setDraggingOrderId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
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


  const onDragStart = () => {
    setDraggingOrderId(null)
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

    const sourceOrders = getColumnOrders(sourceCol)
    const destOrders = getColumnOrders(destCol)

    const draggedIndexInSource = sourceOrders.findIndex(o => o.id === orderId)
    if (draggedIndexInSource === -1) {
      setDraggingOrderId(null)
      return
    }
    const draggedOrder = sourceOrders[draggedIndexInSource]

    const statusChanged = sourceCol !== destCol

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

    const positionUpdates = []
    const allAffectedOrders = [...newSourceOrders, ...newDestOrders]
    const seen = new Set()

    allAffectedOrders.forEach((order) => {
      const targetCol = newSourceOrders.find(o => o.id === order.id) ? newSourceOrders : newDestOrders
      const targetIdx = targetCol.findIndex(o => o.id === order.id)
      if (order.position !== targetIdx && !seen.has(order.id)) {
        positionUpdates.push({ id: order.id, position: targetIdx })
        seen.add(order.id)
      }
    })

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

      // Optimistically update order status for immediate UI feedback
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, status: { ...order.status, ...updateData } }
          : order
      ))

      try {
        await ordersApi.updateStatus(orderId, updateData)
        showNotification(`Order #${orderId} moved to ${COLUMNS.find(c => c.id === destCol)?.name}`, 'success')
      } catch (error) {
        console.error('Failed to update order status:', error)
        showNotification('Failed to move order. Please try again.', 'error')
        // Revert by refetching
        setTimeout(fetchOrders, 100)
        setDraggingOrderId(null)
        return
      }
    }

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
        return (status.is_printed === true || status.picking_done === true) && !status.delivery_status
      }
      return status.delivery_status === columnId
    })
    return filtered.sort((a, b) => {
      if (a.position !== null && b.position !== null) {
        return a.position - b.position
      }
      return a.id - b.id
    })
  }

  const columnStats = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      orders: getColumnOrders(col.id),
      totalValue: getColumnOrders(col.id).reduce((sum, o) => sum + (Number(o.price) || 0), 0),
      totalItems: getColumnOrders(col.id).reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0), 0)
    }))
  }, [orders])

  const totalValue = columnStats.reduce((sum, col) => sum + col.totalValue, 0)
  const totalOrders = orders.length
  const totalItems = columnStats.reduce((sum, col) => sum + col.totalItems, 0)

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* Modern Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-primary-100 to-dark-300 bg-clip-text text-transparent mb-2 tracking-tight">
              Task Board
            </h1>
            <p className="text-dark-400 text-sm">
              Drag & drop orders to update status •
              <span className="text-primary-400 font-medium"> {totalOrders} orders</span> •
              <span className="text-emerald-400 font-medium"> ৳{totalValue.toLocaleString()}</span> •
              <span className="text-blue-400 font-medium"> {totalItems} items</span>
            </p>
          </div>

          <div className="flex gap-3">
            {/* Search */}
            <div className="relative group">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 group-focus-within:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-64 bg-dark-800/80 border border-dark-700/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all backdrop-blur-sm"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-xl border transition-all duration-300 flex items-center gap-2 ${
                showFilters
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                  : 'bg-dark-800/80 border-dark-700/50 text-dark-300 hover:border-primary-500/50 hover:text-primary-300'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Refresh button */}
            <button
              onClick={fetchOrders}
              className="group px-6 py-2.5 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 hover:from-primary-500 hover:to-primary-400 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-glow hover:scale-105 active:scale-95 flex items-center gap-2 min-w-[100px] justify-center"
            >
              <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Orders" value={totalOrders} gradient="from-blue-500/20 to-cyan-500/20" />
          <StatCard label="Total Value" value={`৳${totalValue.toLocaleString()}`} gradient="from-emerald-500/20 to-teal-500/20" />
          <StatCard label="Total Items" value={totalItems} gradient="from-violet-500/20 to-purple-500/20" />
          <StatCard label="In Progress" value={columnStats.filter(c => c.id !== 'Delivered' && c.id !== 'Returned').reduce((sum, c) => sum + c.orders.length, 0)} gradient="from-orange-500/20 to-amber-500/20" />
          <StatCard label="Delivered" value={columnStats.find(c => c.id === 'Delivered')?.orders.length || 0} gradient="from-green-500/20 to-emerald-500/20" />
          <StatCard label="Avg Value" value={`৳${totalOrders > 0 ? Math.round(totalValue / totalOrders) : 0}`} gradient="from-pink-500/20 to-rose-500/20" />
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-700/50 rounded-2xl p-4 mb-6 animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-dark-300 mb-2">Priority</label>
                <select className="w-full px-3 py-2 bg-dark-700/80 border border-dark-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  <option value="">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-dark-300 mb-2">Price Range</label>
                <select className="w-full px-3 py-2 bg-dark-700/80 border border-dark-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  <option value="">All Ranges</option>
                  <option value="0-500">৳0 - ৳500</option>
                  <option value="500-1000">৳500 - ৳1,000</option>
                  <option value="1000+">৳1,000+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-dark-300 mb-2">Date Range</label>
                <select className="w-full px-3 py-2 bg-dark-700/80 border border-dark-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={`
          mb-4 p-4 rounded-xl border flex items-center gap-3 animate-slide-down shadow-lg
          ${notification.type === 'error'
            ? 'bg-red-500/15 border-red-500/40 text-red-200 backdrop-blur-sm'
            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 backdrop-blur-sm'
          }
        `}>
          {notification.type === 'error' ? (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="font-medium">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-auto hover:opacity-70">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4 flex-1">
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-5" style={{ width: 'max-content' }}>
            {COLUMNS.map((column) => {
              const columnOrders = getColumnOrders(column.id)

              return (
                <Droppable key={column.id} droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-shrink-0 w-80 xl:w-96 flex flex-col"
                    >
                      {/* Column Header - Already rendered above as sticky */}
                      <div className={`bg-gradient-to-r ${column.gradient} rounded-t-3xl p-5 shadow-lg relative overflow-hidden sticky top-0 z-20`}>
                        <div className="relative z-10 flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                              <span className="text-2xl filter drop-shadow-lg">{column.icon}</span>
                            </div>
                            <div>
                              <h2 className="font-bold text-white text-xl tracking-tight">{column.name}</h2>
                              <p className="text-white/70 text-xs mt-0.5">{column.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-white/25 backdrop-blur-sm text-white text-sm font-bold px-3 py-1.5 rounded-full border border-white/20 shadow-lg min-w-[2.5rem] text-center">
                              {columnOrders.length}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 relative z-10">
                          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
                            <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Total Value</p>
                            <p className="text-xs font-bold text-white">
                              ৳{columnOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
                            <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Items</p>
                            <p className="text-xs font-bold text-white">
                              {columnOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0), 0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`
                          flex-1 p-4 overflow-y-auto min-h-[500px] rounded-b-3xl border-x-2 border-b-2
                          ${snapshot.isDraggingOver
                            ? 'bg-primary-500/10 border-primary-500/60 shadow-inner shadow-primary-500/20 ring-2 ring-primary-500/30'
                            : 'border-dark-700/40 bg-dark-800/40 hover:border-primary-500/30'
                          }
                          transition-all duration-300
                          backdrop-blur-sm
                          flex flex-col gap-4
                        `}
                        style={{
                          maxHeight: 'calc(100vh - 220px)',
                          scrollbarWidth: 'thin',
                          scrollbarColor: '#4b5563 #1f2937'
                        }}
                      >
                        {columnOrders.length === 0 ? (
                          <div className={`
                            flex flex-col items-center justify-center h-64 text-center p-8 rounded-2xl
                            ${snapshot.isDraggingOver
                              ? 'bg-primary-500/10 border-2 border-dashed border-primary-500 shadow-lg shadow-primary-500/20'
                              : 'bg-dark-800/50 border border-dark-600/50'
                            }
                            transition-all duration-300
                          `}>
                            <div className={`text-6xl mb-4 opacity-40 ${snapshot.isDraggingOver ? 'animate-bounce' : ''}`}>
                              {column.icon}
                            </div>
                            <p className="text-sm font-semibold text-dark-300 mb-1">
                              {snapshot.isDraggingOver ? 'Drop order here' : 'No orders yet'}
                            </p>
                            <p className="text-xs text-dark-500">{column.description}</p>
                          </div>
                        ) : (
                          <>
                            {columnOrders.map((order, index) => (
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
                                    style={{
                                      ...provided.draggableProps.style,
                                    }}
                                  >
                                    <OrderCard
                                      order={order}
                                      onClick={() => navigate(`/orders/${order.id}/edit`)}
                                      isDragging={snapshot.isDragging}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
