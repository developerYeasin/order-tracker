import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DIVISION_OPTIONS, getDistrictsByDivision, getUpazilasByDistrict, DISTRICT_OPTIONS } from '../constants/locations'
import { mediaApi, ordersApi } from '../services/api'
import SearchableSelect from './SearchableSelect'
import { ModalSkeleton } from './ui/Skeleton'

const TABS = [
  { id: 'info', label: 'Information', icon: 'info' },
  { id: 'items', label: 'Items', icon: 'clipboard' },
  { id: 'attachments', label: 'Attachments', icon: 'paperclip' },
]

const ModernButton = ({ children, onClick, variant = 'primary', className = '', disabled = false, loading = false }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-lg shadow-primary-500/25 hover:shadow-glow',
    secondary: 'bg-gradient-to-r from-dark-700 to-dark-600 hover:from-dark-600 hover:to-dark-500 text-white shadow-sm',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/25',
    success: 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25',
    outline: 'border-2 border-primary-500/50 text-primary-300 hover:bg-primary-500/10',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[44px] flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  )
}

const InfoField = ({ label, value, icon, multiline = false }) => (
  <div className="group">
    <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
      {icon && (
        <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )}
      {label}
    </p>
    {multiline ? (
      <p className="text-sm text-dark-200 bg-dark-700/50 border border-dark-600/50 rounded-lg p-3 leading-relaxed">
        {value || '-'}
      </p>
    ) : (
      <p className="text-sm text-dark-200 font-medium bg-dark-700/30 border border-dark-600/30 rounded-lg px-3 py-2 inline-block">
        {value || '-'}
      </p>
    )}
  </div>
)

const StatusChecker = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50 border border-dark-700/50 hover:border-primary-500/30 transition-all">
    <span className="text-sm font-medium text-dark-200">{label}</span>
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 ${checked ? 'bg-gradient-to-r from-primary-500 to-accent-cyan' : 'bg-dark-600'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  </div>
)

export default function OrderModal({ order, onClose, onSave, loading }) {
  const [activeTab, setActiveTab] = useState('info')
  const [formData, setFormData] = useState(order || {})
  const [existingMedia, setExistingMedia] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [items, setItems] = useState(order?.items || [])
  const [newItem, setNewItem] = useState({ size: 'M', quantity: 1, note: '' })
  const [itemFiles, setItemFiles] = useState({})
  const fileInputRef = useRef(null)
  const [districtSearch, setDistrictSearch] = useState('')
  const [upazilaSearch, setUpazilaSearch] = useState('')

  // Load order data when order changes
  useEffect(() => {
    if (order) {
      const division = DIVISION_OPTIONS.find(div => div.name === order.division)
      const divisionId = division?.id || ''

      const district = DISTRICT_OPTIONS.find(d => d.name === order.district)
      const districtId = district?.id || ''

      let upazilaId = ''
      if (districtId) {
        const upazilas = getUpazilasByDistrict(districtId)
        const upazila = upazilas.find(u => u.name === order.upazila_zone)
        upazilaId = upazila?.id || ''
      }

      setFormData({
        ...order,
        division_id: divisionId,
        district_id: districtId,
        upazila_id: upazilaId,
      })

      setExistingMedia(order.media || [])
      setItems(order.items || [])
    } else {
      setFormData({})
      setExistingMedia([])
      setItems([])
    }
  }, [order])

  // Computed districts and upazilas
  const filteredDistricts = useMemo(() => {
    if (!formData.division_id) return []
    return getDistrictsByDivision(formData.division_id)
  }, [formData.division_id])

  const filteredUpazilas = useMemo(() => {
    if (!formData.district_id) return []
    return getUpazilasByDistrict(formData.district_id)
  }, [formData.district_id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

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
          alert(`File type "${file.type}" not allowed for "${file.name}". Skipping.`)
          continue
        }
        validFiles.push(file)
      }

      setNewFiles(prev => [...prev, ...validFiles])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleItemFileChange = async (itemId, side, files) => {
    const newFilesArray = Array.from(files)
    const validFiles = []
    const maxSize = 16 * 1024 * 1024
    for (const file of newFilesArray) {
      if (file.size > maxSize) {
        alert(`File "${file.name}" exceeds 16MB limit. Skipping.`)
        continue
      }
      validFiles.push(file)
    }
    if (validFiles.length === 0) return

    setItemFiles(prev => {
      const itemState = prev[itemId] || { front: [], back: [] }
      return {
        ...prev,
        [itemId]: {
          ...itemState,
          [side]: [...(itemState[side] || []), ...validFiles]
        }
      }
    })

    try {
      await mediaApi.upload(order.id, validFiles, itemId, side)
      setItemFiles(prev => {
        const itemState = prev[itemId] || { front: [], back: [] }
        return {
          ...prev,
          [itemId]: {
            ...itemState,
            [side]: []
          }
        }
      })
      await fetchOrderWithItems()
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed: ' + (error.response?.data?.error || error.message))
    }
  }

  const removeNewFile = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingMedia = async (mediaId) => {
    try {
      await mediaApi.delete(mediaId)
      setExistingMedia(prev => prev.filter(m => m.id !== mediaId))
    } catch (error) {
      console.error('Failed to delete media:', error)
      alert('Failed to delete file')
    }
  }

  // Items management
  const handleAddItem = async () => {
    if (!order?.id) {
      alert('Order must be saved before adding items')
      return
    }
    try {
      const res = await ordersApi.createItem(order.id, newItem)
      const createdItem = res.data
      setItems(prev => [...prev, createdItem])
      setNewItem({ size: 'M', quantity: 1, note: '' })
      setItemFiles(prev => ({ ...prev, [createdItem.id]: { front: [], back: [] } }))
    } catch (error) {
      console.error('Failed to create item:', error)
      alert('Failed to add item: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleUpdateItem = async (itemId, updates) => {
    try {
      const res = await ordersApi.updateItem(order.id, itemId, updates)
      const updatedItem = res.data
      setItems(prev => prev.map(item => (item.id === itemId ? updatedItem : item)))
    } catch (error) {
      console.error('Failed to update item:', error)
      alert('Failed to update item: ' + (error.response?.data?.error || error.message))
    }
  }

  const setColor = (itemId, color) => {
    ordersApi.updateItem(order.id, itemId, { color })
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, color } : item))
  }

  const setDesign = (itemId, design) => {
    ordersApi.updateItem(order.id, itemId, { design })
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, design } : item))
  }

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this item?')) return
    try {
      await ordersApi.deleteItem(order.id, itemId)
      setItems(prev => prev.filter(item => item.id !== itemId))
      setItemFiles(prev => {
        const copy = { ...prev }
        delete copy[itemId]
        return copy
      })
    } catch (error) {
      console.error('Failed to delete item:', error)
      alert('Failed to delete item: ' + (error.response?.data?.error || error.message))
    }
  }

  const removeItemMedia = async (itemId, mediaId) => {
    try {
      await mediaApi.delete(mediaId)
      setItems(prev =>
        prev.map(item => {
          if (item.id !== itemId) return item
          const front = (item.front_images || []).filter(m => m.id !== mediaId)
          const back = (item.back_images || []).filter(m => m.id !== mediaId)
          return { ...item, front_images: front, back_images: back }
        })
      )
    } catch (error) {
      console.error('Failed to delete media:', error)
    }
  }

  const fetchOrderWithItems = async () => {
    try {
      const res = await ordersApi.getById(order.id, { include_items: true })
      setItems(res.data.items || [])
      setExistingMedia(res.data.media || [])
    } catch (error) {
      console.error('Failed to refresh order:', error)
    }
  }

  const handleDownload = (media) => {
    const downloadUrl = `/api/media/${media.id}/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.customer_name || !formData.division_id || !formData.district_id || !formData.upazila_id || !formData.description) {
      alert('Please fill all required fields')
      return
    }

    const division = DIVISION_OPTIONS.find(div => div.id === formData.division_id)
    const district = DISTRICT_OPTIONS.find(d => d.id === formData.district_id)
    let upazila_zone = ''

    if (district) {
      const upazilas = getUpazilasByDistrict(district.id)
      if (typeof formData.upazila_id === 'object' && formData.upazila_id !== null) {
        upazila_zone = formData.upazila_id.name || ''
      } else if (formData.upazila_id) {
        const upazila = upazilas.find(u => u.id === formData.upazila_id)
        upazila_zone = upazila?.name || ''
      }
    }

    const orderPayload = {
      ...formData,
      media_files: newFiles.length > 0 ? newFiles : undefined,
      division: division?.name || '',
      district: district?.name || '',
      upazila_zone,
    }
    delete orderPayload.division_id
    delete orderPayload.district_id
    delete orderPayload.upazila_id

    await onSave(orderPayload)
    setNewFiles([])
  }

  if (!order) return null

  const tabs = [
    { id: 'info', label: 'Information', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'items', label: 'Items', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'attachments', label: 'Attachments', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-3xl border-2 border-dark-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b-2 border-dark-700/50 bg-gradient-to-r from-dark-800 to-dark-900/50">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
              Order #{order.id}
            </h2>
            <p className="text-sm text-dark-400 mt-1">
              {new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white p-3 hover:bg-dark-700/50 rounded-xl transition-all duration-300 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b-2 border-dark-700/50 bg-dark-800/50">
          <nav className="flex gap-1 p-2">
            {tabs.map((tab) => (
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'info' && (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Customer Information */}
              <div className="bg-dark-800/50 border-2 border-dark-700/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-gradient-to-br from-primary-500/20 to-primary-500/5 rounded-lg border border-primary-500/20">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Customer Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Customer Name *</label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name || ''}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Phone Number *</label>
                    <input
                      type="text"
                      name="phone_number"
                      value={formData.phone_number || ''}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Division *</label>
                    <SearchableSelect
                      options={DIVISION_OPTIONS}
                      value={formData.division_id || ''}
                      onChange={(value) => setFormData({ ...formData, division_id: value, district_id: '', upazila_id: '' })}
                      placeholder="Select Division"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">District *</label>
                    <SearchableSelect
                      options={filteredDistricts}
                      value={formData.district_id || ''}
                      onChange={(value) => setFormData({ ...formData, district_id: value, upazila_id: '' })}
                      placeholder="Select District"
                      isDisabled={!formData.division_id}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Thana / Upazila *</label>
                    <SearchableSelect
                      options={filteredUpazilas}
                      value={formData.upazila_id || ''}
                      onChange={(value) => setFormData({ ...formData, upazila_id: value })}
                      placeholder="Select Thana"
                      isDisabled={!formData.district_id}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Payment Type</label>
                    <select
                      name="payment_type"
                      value={formData.payment_type || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="">Select Payment Type</option>
                      <option value="COD">Cash on Delivery</option>
                      <option value="Prepaid">Prepaid</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Delivery Address</label>
                    <textarea
                      name="address"
                      value={formData.address || ''}
                      onChange={handleChange}
                      rows="3"
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Courier Parcel ID</label>
                    <input
                      type="text"
                      name="courier_parcel_id"
                      value={formData.courier_parcel_id || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Price (৳)</label>
                    <input
                      type="text"
                      name="price"
                      value={formData.price || ''}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-dark-300">Description</label>
                    <textarea
                      name="description"
                      value={formData.description || ''}
                      onChange={handleChange}
                      rows="4"
                      required
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Order Status */}
              <div className="bg-dark-800/50 border-2 border-dark-700/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-gradient-to-br from-accent-purple/20 to-accent-purple/5 rounded-lg border border-accent-purple/20">
                    <svg className="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Order Status</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <StatusChecker
                    label="Design Ready"
                    checked={formData.status?.design_ready || false}
                    onChange={() => setFormData({
                      ...formData,
                      status: { ...formData.status, design_ready: !(formData.status?.design_ready) }
                    })}
                  />
                  <StatusChecker
                    label="Printed"
                    checked={formData.status?.is_printed || false}
                    onChange={() => setFormData({
                      ...formData,
                      status: { ...formData.status, is_printed: !(formData.status?.is_printed) }
                    })}
                  />
                  <StatusChecker
                    label="Picking Done"
                    checked={formData.status?.picking_done || false}
                    onChange={() => setFormData({
                      ...formData,
                      status: { ...formData.status, picking_done: !(formData.status?.picking_done) }
                    })}
                  />
                  <div className="p-4 rounded-xl bg-dark-800/50 border-2 border-dark-700/50">
                    <p className="text-sm font-semibold text-dark-300 mb-2">Delivery Status</p>
                    <select
                      value={formData.status?.delivery_status || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        status: { ...formData.status, delivery_status: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Status</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Returned">Returned</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'items' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Order Items ({items.length})</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!order?.id}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 bg-dark-800/50 border-2 border-dashed border-dark-600/50 rounded-xl">
                  <p className="text-dark-400">No items yet. Add an item to specify t-shirt sizes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-dark-800/50 border-2 border-dark-700/50 rounded-xl p-4 shadow-lg">
                      <div className="flex flex-wrap gap-3 items-center mb-3">
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-semibold text-dark-300">Size:</label>
                          <select
                            value={item.size || ''}
                            onChange={(e) => handleUpdateItem(item.id, { size: e.target.value })}
                            className="px-4 py-2.5 bg-dark-700/80 border-2 border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500"
                          >
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'].map((sz) => (
                              <option key={sz} value={sz}>{sz}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="text-sm font-semibold text-dark-300">Quantity:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-20 px-4 py-2.5 bg-dark-700/80 border-2 border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="text-sm font-semibold text-dark-300">Color:</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setColor(item.id, 'white')}
                              className={`px-4 py-2.5 rounded-lg font-medium border-2 transition-all ${item.color === 'white' ? 'bg-white border-yellow-500 text-white ring-2 ring-white ring-offset-2 ring-offset-dark-800' : 'bg-dark-700/80 border-dark-600 text-dark-300 hover:border-dark-500'}`}
                            >
                              White
                            </button>
                            <button
                              type="button"
                              onClick={() => setColor(item.id, 'black')}
                              className={`px-4 py-2.5 rounded-lg font-medium border-2 transition-all ${item.color === 'black' ? 'bg-black border-yellow-500 text-white ring-2 ring-black ring-offset-2 ring-offset-dark-800' : 'bg-dark-700/80 border-dark-600 text-dark-300 hover:border-dark-500'}`}
                            >
                              Black
                            </button>
                          </div>

                          <label className="text-sm font-semibold text-dark-300">Design:</label>
                          <select
                            value={item.design || 'both'}
                            onChange={(e) => setDesign(item.id, e.target.value)}
                            className="px-4 py-2.5 bg-dark-700/80 border-2 border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="front">Front</option>
                            <option value="back">Back</option>
                            <option value="both">Both</option>
                          </select>
                        </div>

                        <div className="ml-auto">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-dark-300 flex items-center gap-2">
                              <svg className="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.236 13.086a2 2 0 012.736.014l5.532 4.933a2 2 0 010 3.136l-1.762 5.193a2 2 0 01-1.736 1.25l3.523 1.148a2 2 0 01-.31 1.428l-5.2 1.32a2 2 0 01-1.248-.178l-2.594-2.95a2 2 0 01-.859-.682l-1.377-4.18a2 2 0 01-.782-1.464z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Front Design Images
                            </h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(item.front_images || []).map((media) => (
                              <div key={media.id} className="relative bg-dark-900 rounded-xl overflow-hidden border-2 border-dark-700 group hover:border-primary-500/50 transition-all">
                                <img src={media.file_url} alt="front" className="w-full h-32 object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => window.open(media.file_url, '_blank')}
                                    className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg"
                                    title="View"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeItemMedia(item.id, media.id)}
                                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-dark-300 flex items-center gap-2">
                            <svg className="w-4 h-4 text-accent-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                            Back Design Images
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(item.back_images || []).map((media) => (
                              <div key={media.id} className="relative bg-dark-900 rounded-xl overflow-hidden border-2 border-dark-700 group hover:border-primary-500/50 transition-all">
                                <img src={media.file_url} alt="back" className="w-full h-32 object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => window.open(media.file_url, '_blank')}
                                    className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg"
                                    title="View"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeItemMedia(item.id, media.id)}
                                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-dark-300">Note (optional)</label>
                          <textarea
                            value={item.note || ''}
                            onChange={(e) => handleUpdateItem(item.id, { note: e.target.value })}
                            placeholder="Add a note..."
                            className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:ring-2 focus:ring-primary-500 resize-none"
                            rows="2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="bg-dark-800/50 border-2 border-primary-500/30 rounded-2xl p-6">
                  <h4 className="text-lg font-bold text-white mb-4">Add Another Item</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-dark-300">Size</label>
                      <select
                        value={newItem.size}
                        onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:ring-2 focus:ring-primary-500"
                      >
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'].map((sz) => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-dark-300">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-dark-300">Note (optional)</label>
                      <textarea
                        value={newItem.note || ''}
                        onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
                        placeholder="Add a note..."
                        className="w-full px-4 py-3 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white focus:ring-2 focus:ring-primary-500 resize-none"
                        rows="1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-gradient-to-br from-accent-cyan/20 to-accent-cyan/5 rounded-lg border border-accent-cyan/20">
                    <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Order Attachments</h3>
                </div>

                <div className="bg-dark-800/50 border-2 border-primary-500/30 rounded-xl p-4">
                  <div
                    className="border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-xl p-8 text-center transition-all duration-300 hover:bg-primary-500/5 cursor-pointer"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500', 'bg-primary-500/10'); e.currentTarget.classList.remove('border-dark-600') }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary-500', 'bg-primary-500/10'); e.currentTarget.classList.add('border-dark-600') }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-primary-500', 'bg-primary-500/10')
                      e.currentTarget.classList.add('border-dark-600')
                      const files = Array.from(e.dataTransfer.files)
                      setNewFiles(prev => [...prev, ...files])
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp4,.mov,.avi,.mkv,.wmv,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <svg className="w-16 h-16 text-dark-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-lg font-medium text-dark-300 mb-2">Click or drag files here to upload</p>
                    <p className="text-sm text-dark-400">Images, videos, documents (Max 16MB per file)</p>
                    <p className="text-xs text-dark-500 mt-3">Tip: You can paste files (Ctrl+V) directly here</p>
                  </div>

                  {/* New files preview */}
                  {newFiles.length > 0 && (
                    <div className="mt-6">
                      <p className="text-sm font-semibold text-dark-300 mb-3">New Files ({newFiles.length}):</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {newFiles.map((file, index) => (
                          <div key={`new-${index}`} className="relative bg-dark-900 rounded-xl overflow-hidden border-2 border-dark-700 group hover:border-primary-500/50 transition-all">
                            {file.type.startsWith('image/') ? (
                              <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-32 object-cover" />
                            ) : file.type.startsWith('video/') ? (
                              <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                                <svg className="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                                <svg className="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="p-3 bg-dark-800/90">
                              <p className="text-xs text-dark-300 truncate">{file.name}</p>
                              <p className="text-xs text-dark-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeNewFile(index) }}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing media */}
                  {existingMedia.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-dark-300">Current Attachments ({existingMedia.length}):</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {existingMedia.map((media) => (
                          <div key={media.id} className="relative bg-dark-900 rounded-xl overflow-hidden border-2 border-dark-700 group hover:border-primary-500/50 transition-all">
                            {media.file_type === 'Image' || media.file_type === 'Image/JPEG' || media.file_type === 'Image/PNG' ? (
                              <img src={media.file_url} alt={media.file_path?.split('/')?.pop()} className="w-full h-32 object-cover cursor-pointer" onClick={() => window.open(media.file_url, '_blank')} />
                            ) : media.file_type === 'Video' || media.file_type?.startsWith('video/') ? (
                              <video src={media.file_url} className="w-full h-32 object-cover" controls onClick={(e) => { e.stopPropagation(); window.open(media.file_url, '_blank') }} />
                            ) : (
                              <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                                <svg className="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); window.open(media.file_url, '_blank') }}
                                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg"
                                title="View"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDownload(media) }}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-lg"
                                title="Download"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                              {/* Image removal disabled - images cannot be removed once added */}
                              {/* <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeExistingMedia(media.id) }}
                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button> */}
                            </div>
                            <div className="p-2 bg-dark-800/90">
                              <p className="text-xs text-dark-300 truncate" title={media.file_path?.split('/')?.pop() || media.file_url?.split('/')?.pop()}>
                                {media.file_path?.split('/')?.pop() || media.file_url?.split('/')?.pop() || 'File'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {existingMedia.length === 0 && newFiles.length === 0 && (
                    <div className="text-center py-8 bg-dark-800/50 border-2 border-dashed border-dark-600/50 rounded-xl">
                      <p className="text-dark-400">No attachments for this order.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-dark-700/50 bg-gradient-to-r from-dark-800 to-dark-900 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-dark-700 to-dark-600 hover:from-dark-600 hover:to-dark-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="order-form"
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-glow hover:scale-105 active:scale-95 min-h-[44px] flex items-center gap-3"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
