import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ordersApi, mediaApi } from '../services/api'
import { DIVISION_OPTIONS, DISTRICT_OPTIONS, getDistrictsByDivision, getUpazilasByDistrict } from '../constants/locations'
import OrderModal from '../components/OrderModal'
import { TableSkeleton } from '../components/ui/Skeleton'

const StatusBadge = ({ status }) => {
  const statusMap = {
    Delivered: 'bg-green-900/30 text-green-400 border-green-700',
    Returned: 'bg-red-900/30 text-red-400 border-red-700',
    Submitted: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
    default: 'bg-dark-700 text-dark-300 border-dark-600',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusMap[status] || statusMap.default}`}>
      {status || 'Pending'}
    </span>
  )
}

export default function Returned() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [orderMedia, setOrderMedia] = useState(null)
  const [notification, setNotification] = useState(null)
  const fileInputRef = useRef(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderModalOrder, setOrderModalOrder] = useState(null)

  const filteredDistricts = useMemo(() => {
    if (!selectedDivision) return []
    return getDistrictsByDivision(selectedDivision)
  }, [selectedDivision])

  const filteredUpazilas = useMemo(() => {
    if (!selectedDistrict) return []
    const district = DISTRICT_OPTIONS.find(d => d.id === selectedDistrict)
    return district ? getUpazilasByDistrict(district.id) : []
  }, [selectedDistrict])

  useEffect(() => {
    fetchOrders()
  }, [search, selectedDivision, selectedDistrict])

  const fetchOrders = async () => {
    try {
      const divisionName = selectedDivision
        ? (DIVISION_OPTIONS.find(d => d.id === selectedDivision)?.name || '')
        : ''
      const districtName = selectedDistrict
        ? (DISTRICT_OPTIONS.find(d => d.id === selectedDistrict)?.name || '')
        : ''

      const res = await ordersApi.getAll({
        search,
        division: divisionName,
        district: districtName,
        status: '',
      })

      // Filter for: delivery_status === 'Returned'
      const filtered = res.data.filter(order =>
        order.status?.delivery_status === 'Returned'
      )

      setOrders(filtered)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // Selection handlers
  const handleSelectOrder = (orderId) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedOrderIds.size === orders.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(orders.map(o => o.id)))
    }
  }

  const handleMarkAsDelivered = async () => {
    if (selectedOrderIds.size === 0) {
      alert('Please select at least one order')
      return
    }
    if (!confirm(`Mark ${selectedOrderIds.size} returned order(s) as Delivered?`)) return

    try {
      for (const orderId of selectedOrderIds) {
        await ordersApi.updateStatus(orderId, { delivery_status: 'Delivered' })
      }
      showNotification(`${selectedOrderIds.size} order(s) marked as Delivered`)
      setSelectedOrderIds(new Set())
      fetchOrders()
    } catch (error) {
      showNotification('Failed to update orders', 'error')
    }
  }

  const handleUpdateStatus = async (orderId, statusData) => {
    try {
      await ordersApi.updateStatus(orderId, statusData)
      showNotification('Status updated!')
      fetchOrders()
      setShowModal(false)
      setEditingOrder(null)
    } catch (error) {
      console.error('Failed to update status:', error)
      showNotification('Failed to update status', 'error')
    }
  }

  const handleMediaUpload = async (orderId, files) => {
    try {
      await mediaApi.upload(orderId, files)
      showNotification('Files uploaded!')
      fetchOrders()
      if (editingOrder && editingOrder.id === orderId) {
        const mediaRes = await mediaApi.getAll(orderId)
        setOrderMedia(mediaRes.data)
      }
    } catch (error) {
      showNotification('Failed to upload files', 'error')
    }
  }

  const openOrderModal = async (order) => {
    try {
      const res = await ordersApi.getById(order.id, { include_items: true })
      setOrderModalOrder(res.data)
      setShowOrderModal(true)
    } catch (error) {
      console.error('Failed to fetch order details:', error)
      showNotification('Failed to load order details', 'error')
    }
  }

  const handleSaveOrder = async (orderData) => {
    try {
      const mediaFiles = orderData.media_files
      const updateData = { ...orderData }
      delete updateData.media_files

      await ordersApi.update(updateData.id, updateData)

      if (mediaFiles && mediaFiles.length > 0) {
        try {
          await mediaApi.upload(updateData.id, mediaFiles)
        } catch (mediaErr) {
          console.warn('Media upload failed:', mediaErr)
        }
      }

      showNotification('Order updated successfully!', 'success')
      fetchOrders()
      if (orderModalOrder && orderModalOrder.id === orderData.id) {
        const res = await ordersApi.getById(orderModalOrder.id, { include_items: true })
        setOrderModalOrder(res.data)
      }
    } catch (error) {
      console.error('Failed to update order:', error)
      showNotification('Failed to update order', 'error')
    }
  }

  // Quick Action Modal Component
  const QuickActionModal = ({ order, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
      design_ready: order.status?.design_ready || false,
      is_printed: order.status?.is_printed || false,
      delivery_status: order.status?.delivery_status || '',
      courier_parcel_id: order.courier_parcel_id || '',
    })
    const [designFiles, setDesignFiles] = useState([])
    const designFileInputRef = useRef(null)

    const handleFileChange = (e) => {
      const files = e.target.files
      if (files) {
        const validFiles = []
        const maxSize = 16 * 1024 * 1024
        const allowedTypes = [
          'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
          'video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/wmv',
          'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-rar-compressed'
        ]

        for (const file of files) {
          if (file.size > maxSize) {
            alert(`File "${file.name}" exceeds 16MB limit. Skipping.`)
            continue
          }
          if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert(`File type not allowed for "${file.name}". Skipping.`)
            continue
          }
          validFiles.push(file)
        }

        setDesignFiles(prev => [...prev, ...validFiles])
        if (designFileInputRef.current) {
          designFileInputRef.current.value = ''
        }
      }
    }

    const handlePaste = (e) => {
      e.preventDefault()
      const items = (e.clipboardData || e.originalEvent.clipboardData).items
      const validFiles = []
      const maxSize = 16 * 1024 * 1024
      const allowedTypes = [
        'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
        'video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/wmv',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-rar-compressed'
      ]

      for (const item of items) {
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile()
          if (file) {
            if (file.size > maxSize) {
              alert(`File "${file.name}" exceeds 16MB limit. Skipping.`)
              continue
            }
            if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
              alert(`File type "${file.type}" not allowed for "${file.name}". Skipping.`)
              continue
            }
            validFiles.push(file)
          }
        }
      }

      if (validFiles.length > 0) {
        setDesignFiles(prev => [...prev, ...validFiles])
      }
    }

    const removeDesignFile = (index) => {
      setDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e) => {
      e.preventDefault()
      const wasDesignReady = order.status?.design_ready || false
      if (formData.design_ready && !wasDesignReady && designFiles.length === 0) {
        alert('Please upload at least one design file before marking as Design Ready/Approved.')
        return
      }
      await onUpdate(order.id, formData, designFiles)
      onClose()
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-md max-h-[98vh] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-dark-700">
            <h3 className="text-lg font-semibold text-white">Quick Update</h3>
            <button onClick={onClose} className="text-dark-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.design_ready}
                  onChange={(e) => setFormData({ ...formData, design_ready: e.target.checked })}
                  className="rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-dark-300">Design Ready/Approved</span>
              </label>

              {formData.design_ready && (
                <div className="mt-4 ml-6 border-l-2 border-primary-500 pl-4">
                  <label className="block text-sm font-medium text-dark-300 mb-2">Upload Design File</label>
                  <button
                    type="button"
                    tabIndex={0}
                    className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer focus:outline-none focus:border-primary-500 w-full"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500') }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary-500') }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-primary-500')
                      const files = Array.from(e.dataTransfer.files)
                      handleFileChange({ target: { files } })
                    }}
                    onPaste={handlePaste}
                    onClick={() => designFileInputRef.current?.click()}
                  >
                    <input
                      ref={designFileInputRef}
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp4,.mov,.avi,.mkv,.wmv,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <svg className="w-8 h-8 text-dark-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-dark-300 text-xs">Click or drag design files here</p>
                    <p className="text-xs text-dark-400 mt-1">Images, videos, documents (Max 16MB)</p>
                  </button>
                  <p className="text-xs text-dark-500 mt-1">Tip: You can paste images (Ctrl+V) directly into the drop zone</p>

                  {designFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {designFiles.map((file, idx) => (
                        <div key={idx} className="bg-dark-900 rounded border border-dark-700 p-2 relative">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-16 object-cover rounded" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                          ) : (
                            <div className="w-full h-16 bg-dark-700 rounded flex items-center justify-center">
                              <svg className="w-6 h-6 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <p className="text-xs text-dark-300 truncate mt-1">{file.name}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeDesignFile(idx)
                            }}
                            className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5"
                            title="Remove"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_printed}
                  onChange={(e) => setFormData({ ...formData, is_printed: e.target.checked })}
                  className="rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-dark-300">Printed</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Delivery Status</label>
              <select
                value={formData.delivery_status}
                onChange={(e) => setFormData({ ...formData, delivery_status: e.target.value })}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Status</option>
                <option value="Submitted">Submitted to Courier</option>
                <option value="Delivered">Delivered</option>
                <option value="Returned">Returned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Courier Parcel ID</label>
              <input
                type="text"
                value={formData.courier_parcel_id}
                onChange={(e) => setFormData({ ...formData, courier_parcel_id: e.target.value })}
                placeholder="e.g., TRK123456789"
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Update Status
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Media Modal Component
  const MediaModal = ({ files, onClose }) => {
    const handleDownload = (file) => {
      const url = file.file_url || file.file_path
      const filename = file.file_path?.split('/').pop() || file.file_url?.split('/').pop() || 'download'
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-4xl max-h-90vh overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-dark-700">
            <h3 className="text-lg font-semibold text-white">Order Media</h3>
            <button onClick={onClose} className="text-dark-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => (
                <div key={file.id} className="bg-dark-900 rounded-lg overflow-hidden border border-dark-700 relative group">
                  {file.file_type === 'Image' ? (
                    <img
                      src={file.file_url || file.file_path}
                      alt="Order reference"
                      className="w-full h-32 object-cover cursor-pointer"
                      onClick={() => window.open(file.file_url || file.file_path, '_blank')}
                    />
                  ) : (
                    <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                      <svg className="w-12 h-12 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs text-dark-400 truncate">{file.file_path?.split('/').pop() || file.file_url?.split('/').pop()}</p>
                  </div>
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => window.open(file.file_url || file.file_path, '_blank')}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1"
                      title="View"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-full p-1"
                      title="Download"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Returned</h1>
          <p className="text-dark-400 mt-1">Orders that have been returned</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by name, phone, or order #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <select
              value={selectedDivision}
              onChange={(e) => {
                setSelectedDivision(e.target.value)
                setSelectedDistrict('')
              }}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Divisions</option>
              {DIVISION_OPTIONS.map((div) => (
                <option key={div.id} value={div.id}>{div.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedDivision}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Districts</option>
              {filteredDistricts.map((dist) => (
                <option key={dist.id} value={dist.id}>{dist.bn_name ? `${dist.name} (${dist.bn_name})` : dist.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} columns={6} />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-dark-400">No returned orders found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleMarkAsDelivered}
                  disabled={selectedOrderIds.size === 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg text-sm transition-colors"
                >
                  Mark as Delivered ({selectedOrderIds.size})
                </button>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm transition-colors"
                >
                  {selectedOrderIds.size === orders.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <p className="text-sm text-dark-400">
                {selectedOrderIds.size} of {orders.length} selected
              </p>
            </div>

            <table className="w-full">
              <thead className="bg-dark-900">
                <tr>
                  <th className="px-6 py-4 text-center w-16">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.size === orders.length && orders.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Parcel ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-dark-900 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-white font-medium">#{order.id}</span>
                      <p className="text-xs text-dark-400">{new Date(order.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{order.customer_name}</p>
                      <p className="text-sm text-dark-400">{order.phone_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-dark-300 text-sm">{order.division}</p>
                      <p className="text-xs text-dark-400">{order.district}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-dark-300 font-medium">৳{order.price || '0'}</span>
                      <p className="text-xs text-dark-400">{order.payment_type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-dark-700 px-2 py-1 rounded text-sm text-primary-400">{order.courier_parcel_id}</code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/orders/${order.id}/edit`)}
                          className="group relative p-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 hover:text-primary-300 rounded-xl transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="Edit Order"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Edit
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingOrder(order)
                            setShowModal(true)
                          }}
                          className="group relative p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300 rounded-xl transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="Quick Update"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Quick Update
                          </span>
                        </button>
                        <button
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="group relative p-2 bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan hover:text-accent-teal rounded-xl transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            View Details
                          </span>
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const mediaRes = await mediaApi.getAll(order.id)
                              setOrderMedia(mediaRes.data)
                              setEditingOrder(order)
                            } catch (error) {
                              console.error('Failed to fetch media:', error)
                              alert('Failed to load media.')
                            }
                          }}
                          className="group relative p-2 bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple hover:text-accent-pink rounded-xl transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="View Media"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Media
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="group relative p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg border ${notification.type === 'error' ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-green-900/30 border-green-700 text-green-300'}`}>
          {notification.message}
        </div>
      )}

      {/* Quick Action Modal */}
      {showModal && editingOrder && (
        <QuickActionModal
          order={editingOrder}
          onClose={() => {
            setShowModal(false)
            setEditingOrder(null)
          }}
          onUpdate={handleUpdateStatus}
        />
      )}

      {/* Media Modal */}
      {orderMedia && (
        <MediaModal
          files={orderMedia}
          onClose={() => {
            setOrderMedia(null)
            setEditingOrder(null)
          }}
        />
      )}

      {/* Order Modal */}
      {showOrderModal && orderModalOrder && (
        <OrderModal
          order={orderModalOrder}
          onClose={() => {
            setShowOrderModal(false)
            setOrderModalOrder(null)
          }}
          onSave={handleSaveOrder}
          loading={false}
        />
      )}
    </div>
  )
}
