import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ordersApi, mediaApi } from '../services/api'
import { DIVISION_OPTIONS, DISTRICT_OPTIONS, getDistrictsByDivision, getUpazilasByDistrict } from '../constants/locations'

const TABS = [
  { id: 'info', label: 'Information', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'items', label: 'Items', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'attachments', label: 'Attachments', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

const OrderView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('info')
  const [notification, setNotification] = useState(null)

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  useEffect(() => {
    fetchOrder()
  }, [id])

  const fetchOrder = async () => {
    try {
      const res = await ordersApi.getById(id, { include_items: true })
      setOrder(res.data)
    } catch (error) {
      console.error('Failed to fetch order:', error)
      setError('Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (media) => {
    const downloadUrl = `/api/media/${media.id}/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = ''
    link.click()
  }

  const openEditModal = () => {
    navigate(`/orders/${id}/edit`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-red-400">{error || 'Order not found'}</div>
      </div>
    )
  }

  const divisionName = order.division || '-'
  const districtName = order.district || '-'
  const upazilaName = order.upazila_zone || '-'

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered': return 'bg-green-900/30 text-green-400 border-green-700'
      case 'Returned': return 'bg-red-900/30 text-red-400 border-red-700'
      case 'Submitted': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700'
      default: return 'bg-dark-700 text-dark-300 border-dark-600'
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg border ${notification.type === 'error' ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-green-900/30 border-green-700 text-green-300'}`}>
            {notification.message}
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <button
            onClick={() => navigate(`/orders`)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            All Orders
          </button>
          <button
            onClick={openEditModal}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg transition-colors shadow-lg shadow-emerald-500/25 hover:shadow-glow"
          >
            Edit Order
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b-2 border-dark-700/50 bg-dark-800/50">
          <nav className="flex gap-1 p-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Order Info Card */}
        {activeTab === 'info' && (
        <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border-2 border-dark-700/50 shadow-soft overflow-hidden">
          <div className="p-6 border-b-2 border-dark-700/50 bg-gradient-to-r from-primary-500/10 to-transparent">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
                  Order #{order.id}
                </h1>
                <p className="text-dark-400 mt-2">
                  Created: {new Date(order.created_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {order.priority && order.priority !== 'normal' && (
                  <span className={`text-sm font-bold uppercase px-3 py-1.5 rounded-full border ${
                    order.priority === 'urgent' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                    order.priority === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                  }`}>
                    {order.priority}
                  </span>
                )}
                <span className={`px-3 py-1.5 text-sm font-medium rounded-full border ${getStatusColor(order.status?.delivery_status)}`}>
                  {order.status?.delivery_status || 'Pending'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Customer Name</h3>
                <p className="text-lg font-medium text-white">{order.customer_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Phone Number</h3>
                <p className="text-lg font-medium text-white">{order.phone_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Payment Type</h3>
                <p className="text-lg font-medium text-white">{order.payment_type || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Price</h3>
                <p className="text-lg font-medium text-emerald-400">৳{Number(order.price || 0).toLocaleString()}</p>
              </div>
              <div className="md:col-span-2 lg:col-span-2">
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Location</h3>
                <p className="text-lg font-medium text-white">
                  {divisionName}, {districtName}
                  {upazilaName && ` (${upazilaName})`}
                </p>
              </div>
              {order.courier_parcel_id && (
                <div>
                  <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Courier Parcel ID</h3>
                  <p className="text-lg font-mono font-medium text-violet-400 bg-dark-800 px-3 py-1 rounded-lg inline-block">
                    {order.courier_parcel_id}
                  </p>
                </div>
              )}
            </div>

            {/* Address */}
            {order.address && (
              <div>
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Delivery Address</h3>
                <p className="text-dark-200 bg-dark-800/50 border border-dark-700/50 rounded-xl p-4 leading-relaxed">
                  {order.address}
                </p>
              </div>
            )}

            {/* Description */}
            {order.description && (
              <div>
                <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-dark-200 bg-dark-800/50 border border-dark-700/50 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                  {order.description}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-3">Order Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-4 rounded-xl border-2 ${order.status?.design_ready ? 'bg-primary-500/20 border-primary-500/50' : 'bg-dark-800/50 border-dark-700/50'}`}>
                  <p className="text-sm font-medium text-dark-300">Design Ready</p>
                  <p className="text-2xl font-bold mt-1">{order.status?.design_ready ? '✅' : '⏳'}</p>
                </div>
                <div className={`p-4 rounded-xl border-2 ${order.status?.is_printed ? 'bg-primary-500/20 border-primary-500/50' : 'bg-dark-800/50 border-dark-700/50'}`}>
                  <p className="text-sm font-medium text-dark-300">Printed</p>
                  <p className="text-2xl font-bold mt-1">{order.status?.is_printed ? '✅' : '⏳'}</p>
                </div>
                <div className={`p-4 rounded-xl border-2 ${order.status?.picking_done ? 'bg-primary-500/20 border-primary-500/50' : 'bg-dark-800/50 border-dark-700/50'}`}>
                  <p className="text-sm font-medium text-dark-300">Picking Done</p>
                  <p className="text-2xl font-bold mt-1">{order.status?.picking_done ? '✅' : '⏳'}</p>
                </div>
                <div className={`p-4 rounded-xl border-2 ${order.status?.delivery_status ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-dark-800/50 border-dark-700/50'}`}>
                  <p className="text-sm font-medium text-dark-300">Delivery</p>
                  <p className="text-lg font-bold mt-1">{order.status?.delivery_status || 'Pending'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Order Items */}
        {activeTab === 'items' && order.items && order.items.length > 0 && (
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border-2 border-dark-700/50 shadow-soft overflow-hidden">
            <div className="p-6 border-b-2 border-dark-700/50 bg-gradient-to-r from-accent-cyan/10 to-transparent">
              <h2 className="text-xl font-bold text-white">Order Items ({order.items.length})</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={item.id || idx} className="bg-dark-900/50 border border-dark-700/50 rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <div>
                        <span className="text-sm font-semibold text-dark-400">Size</span>
                        <p className="text-lg font-medium text-white">{item.size}</p>
                      </div>
                      {item.color && (
                        <div>
                          <span className="text-sm font-semibold text-dark-400">Color</span>
                          <p className="text-lg font-medium text-white capitalize">{item.color}</p>
                        </div>
                      )}
                      {item.design && (
                        <div>
                          <span className="text-sm font-semibold text-dark-400">Design</span>
                          <p className="text-lg font-medium text-white capitalize">{item.design}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-semibold text-dark-400">Quantity</span>
                        <p className="text-lg font-medium text-white">{item.quantity}</p>
                      </div>
                      {item.note && (
                        <div className="flex-1 min-w-[200px]">
                          <span className="text-sm font-semibold text-dark-400">Note</span>
                          <p className="text-dark-200">{item.note}</p>
                        </div>
                      )}
                    </div>

                    {/* Item Images */}
                    <div className="grid grid-cols-2 gap-4">
                      {item.front_images && item.front_images.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-dark-400 mb-2">Front Designs ({item.front_images.length})</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {item.front_images.map((img) => (
                              <div key={img.id} className="relative group">
                                <img src={img.file_url || img.file_path} alt="Front design" className="w-full h-24 object-cover rounded-lg" />
                                <button
                                  onClick={() => handleDownload(img)}
                                  className="absolute top-1 right-1 bg-primary-500/80 hover:bg-primary-500 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Download"
                                >
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.back_images && item.back_images.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-dark-400 mb-2">Back Designs ({item.back_images.length})</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {item.back_images.map((img) => (
                              <div key={img.id} className="relative group">
                                <img src={img.file_url || img.file_path} alt="Back design" className="w-full h-24 object-cover rounded-lg" />
                                <button
                                  onClick={() => handleDownload(img)}
                                  className="absolute top-1 right-1 bg-primary-500/80 hover:bg-primary-500 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Download"
                                >
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Attachments */}
        {activeTab === 'attachments' && order.media && order.media.length > 0 && (
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border-2 border-dark-700/50 shadow-soft overflow-hidden">
            <div className="p-6 border-b-2 border-dark-700/50 bg-gradient-to-r from-accent-purple/10 to-transparent">
              <h2 className="text-xl font-bold text-white">Attachments ({order.media.length})</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {order.media.map((file) => (
                  <div key={file.id} className="relative group rounded-lg overflow-hidden border border-dark-700/50">
                    {file.file_type === 'Image' || file.file_type === 'image' ? (
                      <img
                        src={file.file_url || file.file_path}
                        alt="Attachment"
                        className="w-full h-32 object-cover"
                        onClick={() => window.open(file.file_url || file.file_path, '_blank')}
                      />
                    ) : (
                      <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                        <svg className="w-12 h-12 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="p-2 bg-dark-800">
                      <p className="text-xs text-dark-400 truncate">{file.file_path?.split('/').pop() || file.file_url?.split('/').pop()}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      className="absolute top-1 right-1 bg-primary-500/80 hover:bg-primary-500 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PDF Summary - Material Breakdown */}
        <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border-2 border-dark-700/50 shadow-soft overflow-hidden">
          <div className="p-6 border-b-2 border-dark-700/50 bg-gradient-to-r from-accent-teal/10 to-transparent">
            <h2 className="text-xl font-bold text-white">PDF Summary - Material Breakdown</h2>
          </div>
          <div className="p-6">
            {order.items && order.items.length > 0 ? (
              (() => {
                const summary = {}
                order.items.forEach((item) => {
                  const key = `${item.size} ${item.color || 'unknown'}`
                  if (!summary[key]) {
                    summary[key] = { size: item.size, color: item.color || 'unknown', quantity: 0 }
                  }
                  summary[key].quantity += item.quantity || 0
                })

                const sortedSummary = Object.values(summary).sort((a, b) => {
                  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size']
                  const sizeA = sizes.indexOf(a.size)
                  const sizeB = sizes.indexOf(b.size)
                  if (sizeA !== -1 && sizeB !== -1) return sizeA - sizeB
                  return a.size.localeCompare(b.size)
                })

                const totalPieces = sortedSummary.reduce((sum, item) => sum + item.quantity, 0)

                return (
                  <div className="space-y-4">
                    <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
                      <p className="text-sm text-dark-400">Total Pieces:</p>
                      <p className="text-2xl font-bold text-white">{totalPieces}</p>
                    </div>

                    <div className="space-y-2">
                      {sortedSummary.map((item, idx) => (
                        <div key={idx} className="bg-dark-800/50 border border-dark-700/50 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-dark-400">{item.size} {item.color?.toUpperCase()}</p>
                            <p className="text-xs text-dark-500">
                              {item.quantity === 1 ? `${item.quantity} piece` : `${item.quantity} pieces`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary-400">{item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white rounded-xl font-semibold shadow-lg shadow-primary-500/25 transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2"
                      onClick={() => alert('PDF generation coming soon!')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download PDF Summary
                    </button>
                  </div>
                )
              })()
            ) : (
              <p className="text-dark-400">No items in this order.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderView
