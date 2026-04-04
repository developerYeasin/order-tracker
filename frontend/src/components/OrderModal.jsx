import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DIVISION_OPTIONS, getDistrictsByDivision, getUpazilasByDistrict, DISTRICT_OPTIONS } from '../constants/locations'
import { mediaApi, ordersApi } from '../services/api'
import SearchableSelect from './SearchableSelect'

export default function OrderModal({ order, onClose, onSave, loading }) {
  const [formData, setFormData] = useState(order || {})
  const [existingMedia, setExistingMedia] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [items, setItems] = useState(order?.items || [])
  const [newItem, setNewItem] = useState({ size: 'M', quantity: 1 })
  const [itemFiles, setItemFiles] = useState({}) // { itemId: { front: File[], back: File[] } }
  const itemFileRefs = useRef({}) // { [itemId]: { front: ref, back: ref } }
  const fileInputRef = useRef(null)
  const [districtSearch, setDistrictSearch] = useState('')
  const [upazilaSearch, setUpazilaSearch] = useState('')

  // Debug: Log when component mounts and order prop changes
  useEffect(() => {
    console.log('=== OrderModal render ===')
    console.log('order prop:', order)
    console.log('order?.id:', order?.id)
    console.log('order?.media:', order?.media)
    console.log('order?.items:', order?.items)
    console.log('existingMedia state:', existingMedia)
  })

  // Load order data (media and items) when order changes
  useEffect(() => {
    console.log('Order useEffect triggered. order:', order?.id)
    if (order) {
      // Set media from order (already loaded via get order API)
      const media = order.media || []
      console.log('Setting existingMedia to:', media)
      setExistingMedia(media)
      // Set items from order
      const orderItems = order.items || []
      console.log('Setting items to:', orderItems)
      setItems(orderItems)
    } else {
      setExistingMedia([])
      setItems([])
    }
  }, [order])

  // Computed: districts filtered by form division_id
  const filteredDistricts = useMemo(() => {
    if (!formData.division_id) return []
    return getDistrictsByDivision(formData.division_id)
  }, [formData.division_id])

  // Computed: upazilas filtered by selected district_id
  const filteredUpazilas = useMemo(() => {
    if (!formData.district_id) return []
    return getUpazilasByDistrict(formData.district_id)
  }, [formData.district_id])

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = '0' // Prevent scrollbar jump
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [])

  useEffect(() => {
    if (order) {
      console.log('Setting existingMedia from order.media:', order.media)
      // Convert division name to ID
      const division = DIVISION_OPTIONS.find(div => div.name === order.division)
      const divisionId = division?.id || ''

      // Find district ID from name (look through all districts)
      const district = DISTRICT_OPTIONS.find(d => d.name === order.district)
      const districtId = district?.id || ''

      // Find upazila ID from name
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

      // Set media from order (already loaded via get order API)
      setExistingMedia(order.media || [])
      console.log('Media state updated:', order.media || [])
    } else {
      setFormData({})
      setExistingMedia([])
    }
  }, [order])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleFileChange = (e) => {
    const files = e.target.files
    if (files) {
      const validFiles = []
      const maxSize = 16 * 1024 * 1024 // 16MB
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
          // For unknown types, we'll still allow but show warning? Let's be strict.
          alert(`File type "${file.type}" not allowed for "${file.name}". Skipping.`)
          continue
        }
        validFiles.push(file)
      }

      setNewFiles(prev => [...prev, ...validFiles])
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const items = (e.clipboardData || e.originalEvent.clipboardData).items
    const validFiles = []
    const maxSize = 16 * 1024 * 1024 // 16MB
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
      setNewFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleItemPaste = (itemId, side, e) => {
    e.preventDefault()
    const items = (e.clipboardData || e.originalEvent.clipboardData).items
    const validFiles = []
    const maxSize = 16 * 1024 * 1024 // 16MB
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      'video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/wmv',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetsml.sheet',
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
      handleItemFileChange(itemId, side, validFiles)
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

  // ========== Items Management ==========

  const handleAddItem = async () => {
    if (!order?.id) {
      alert('Order must be saved before adding items')
      return
    }
    try {
      const res = await ordersApi.createItem(order.id, newItem)
      const createdItem = res.data
      setItems(prev => [...prev, createdItem])
      setNewItem({ size: 'M', quantity: 1 }) // reset
      // Initialize empty file arrays for this item
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

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this item?')) return
    try {
      await ordersApi.deleteItem(order.id, itemId)
      setItems(prev => prev.filter(item => item.id !== itemId))
      // Also remove from itemFiles state
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

    // Update state to show preview
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

    // Upload immediately
    try {
      await mediaApi.upload(order.id, validFiles, itemId, side)
      // Clear pending files immediately after successful upload to prevent duplicate preview
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
      // Refresh items to include new media (purely for updating the UI with the new media)
      await fetchOrderWithItems()
      console.log(`Uploaded ${validFiles.length} ${side} images for item ${itemId}`)
    } catch (error) {
      console.error(`Upload failed for item ${itemId}:`, error)
      alert('Upload failed: ' + (error.response?.data?.error || error.message))
    }
  }

  const removePendingItemFile = (itemId, side, index) => {
    setItemFiles(prev => {
      const itemState = prev[itemId] || { front: [], back: [] }
      const newFiles = itemState[side].filter((_, i) => i !== index)
      return {
        ...prev,
        [itemId]: { ...itemState, [side]: newFiles }
      }
    })
  }

  const uploadItemFiles = async (itemId, side) => {
    const files = itemFiles[itemId]?.[side]
    if (!files || files.length === 0) return
    try {
      const uploadResult = await mediaApi.upload(order.id, files, itemId, side)
      // Add uploaded media to items list
      const uploadedMedia = uploadResult.data.uploaded || uploadResult.data // depending on API response shape
      // The API returns list of uploaded file info but we need full media objects including id
      // Actually our media upload endpoint returns { uploaded: [{filename, file_type, url, item_id, side}] } but doesn't return the media DB objects (id). We need to get the latest media after upload.
      // Alternative: after upload, we can fetch updated order with items again.
      await fetchOrderWithItems()
    } catch (error) {
      console.error('Failed to upload item files:', error)
      alert('Upload failed: ' + (error.response?.data?.error || error.message))
    }
  }

  const removeItemMedia = async (itemId, mediaId) => {
    try {
      await mediaApi.delete(mediaId)
      // Remove from items state
      setItems(prev =>
        prev.map(item => {
          if (item.id !== itemId) return item
          // Filter out deleted media from front_images and back_images
          const front = (item.front_images || []).filter(m => m.id !== mediaId)
          const back = (item.back_images || []).filter(m => m.id !== mediaId)
          return { ...item, front_images: front, back_images: back }
        })
      )
    } catch (error) {
      console.error('Failed to delete item media:', error)
    }
  }

  const fetchOrderWithItems = async (clearSide = null) => {
    try {
      const res = await ordersApi.getById(order.id, { include_items: true })
      setItems(res.data.items || [])
      // Also refresh existingMedia (order-level)
      setExistingMedia(res.data.media || [])
      // Clear pending files for specific item and side if requested (in same batch to avoid duplicate preview)
      if (clearSide && clearSide.itemId && clearSide.side) {
        const { itemId, side } = clearSide
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
      }
    } catch (error) {
      console.error('Failed to refresh order:', error)
    }
  }

  // ========== End Items Management ==========

  const handleDownload = (media) => {
    // Use the backend download endpoint which handles both local and Cloudinary files
    const downloadUrl = `/api/media/${media.id}/download`

    // Create a temporary anchor element - same-origin, so download attribute will work
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = ''  // Let backend set filename via Content-Disposition
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

    // Convert IDs to names for backend
    const division = DIVISION_OPTIONS.find(div => div.id === formData.division_id)
    const district = DISTRICT_OPTIONS.find(d => d.id === formData.district_id)
    let upazila_zone = ''

    if (district) {
      const upazilas = getUpazilasByDistrict(district.id)
      console.log('DEBUG: upazilas for district', district.id, upazilas.slice(0, 5))

      // Handle both cases: upazila_id could be an ID string or the zone object itself
      if (typeof formData.upazila_id === 'object' && formData.upazila_id !== null) {
        // It's the zone object directly (legacy behavior when zones had no id)
        upazila_zone = formData.upazila_id.name || ''
        console.log('DEBUG: upazila_id is object, using name:', upazila_zone)
      } else if (formData.upazila_id) {
        const upazila = upazilas.find(u => u.id === formData.upazila_id)
        upazila_zone = upazila?.name || ''
        console.log('DEBUG: selected upazila_id:', formData.upazila_id, 'found upazila:', upazila, 'zone:', upazila_zone)
      }
    }

    const orderPayload = {
      ...formData,
      media_files: newFiles.length > 0 ? newFiles : undefined,
      division: division?.name || '',
      district: district?.name || '',
      upazila_zone,
    }
    // Remove ID fields before sending
    delete orderPayload.division_id
    delete orderPayload.district_id
    delete orderPayload.upazila_id

    console.log('DEBUG: orderPayload being sent:', orderPayload)
    await onSave(orderPayload)
    setNewFiles([])
    // Parent will update order prop which triggers effect to refresh media
  }

  if (!order) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-dark-700">
          <h2 className="text-xl font-bold text-white">
            Order #{order.id}
          </h2>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Debug panel */}
          <div className="bg-dark-900 border border-dark-700 rounded p-3 mb-4 text-xs">
            <details>
              <summary className="cursor-pointer text-dark-300">Debug Info</summary>
              <pre className="mt-2 overflow-auto text-dark-400">
{JSON.stringify({
  orderId: order?.id,
  hasMediaProp: !!order?.media,
  mediaCount: order?.media?.length,
  existingMediaCount: existingMedia.length,
  mediaItems: existingMedia
}, null, 2)}
              </pre>
            </details>
          </div>

          <form id="order-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Division
                </label>
                <SearchableSelect
                  options={DIVISION_OPTIONS}
                  value={formData.division_id || ''}
                  onChange={(value) => {
                    setFormData({ ...formData, division_id: value, district_id: '', upazila_id: '' })
                    setDistrictSearch('')
                    setUpazilaSearch('')
                  }}
                  placeholder="Select Division"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  District
                </label>
                <SearchableSelect
                  options={filteredDistricts}
                  value={formData.district_id || ''}
                  onChange={(value) => {
                    setFormData({ ...formData, district_id: value, upazila_id: '' })
                    setUpazilaSearch('')
                  }}
                  placeholder="Select District"
                  isDisabled={!formData.division_id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Thana
                </label>
                <SearchableSelect
                  options={filteredUpazilas}
                  value={formData.upazila_id || ''}
                  onChange={(value) => setFormData({ ...formData, upazila_id: value })}
                  placeholder="Select Thana"
                  isDisabled={!formData.district_id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address || ''}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Full delivery address"
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Payment Type
                </label>
                <select
                  name="payment_type"
                  value={formData.payment_type || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Courier Parcel ID
                </label>
                <input
                  type="text"
                  name="courier_parcel_id"
                  value={formData.courier_parcel_id || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Price (৳)
                </label>
                <input
                  type="text"
                  name="price"
                  value={formData.price || ''}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Attachments (Images, Videos, Files)
                </label>

                {/* Drag and drop zone */}
                <button
                  type="button"
                  tabIndex={0}
                  className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer focus:outline-none focus:border-primary-500 w-full"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary-500') }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-primary-500')
                    const files = Array.from(e.dataTransfer.files)
                    setNewFiles(prev => [...prev, ...files])
                  }}
                  onPaste={handlePaste}
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
                  <svg className="w-12 h-12 text-dark-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-dark-300 text-sm">Click or drag files here to upload</p>
                  <p className="text-xs text-dark-400 mt-1">
                    Images, videos, documents (Max 16MB per file)
                  </p>
                </button>
                <p className="text-xs text-dark-500 mt-1">Tip: You can paste images (Ctrl+V) directly into the drop zone</p>

                {/* New files preview */}
                {newFiles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-dark-300 mb-2">New Files ({newFiles.length}):</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {newFiles.map((file, index) => (
                        <div key={`new-${index}`} className="bg-dark-900 rounded-lg overflow-hidden border border-dark-700 relative group">
                          {file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-32 object-cover"
                              onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                            />
                          ) : file.type.startsWith('video/') ? (
                            <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                              <svg className="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                              <svg className="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs text-dark-300 truncate" title={file.name}>{file.name}</p>
                            <p className="text-xs text-dark-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          {!loading && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeNewFile(index)
                              }}
                              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove file"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing media files */}
                {existingMedia.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm text-dark-300 mb-2">Current Attachments ({existingMedia.length}):</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {existingMedia.map((media) => (
                        <div key={media.id} className="bg-dark-900 rounded-lg overflow-hidden border border-dark-700 relative group">
                          {media.file_type === 'Image' ? (
                            <div className="relative">
                              <img
                                src={media.file_url}
                                alt="Order attachment"
                                className="w-full h-32 object-cover cursor-pointer"
                                onClick={() => window.open(media.file_url, '_blank')}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.open(media.file_url, '_blank')
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2"
                                  title="View"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownload(media)
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white rounded-full p-2"
                                  title="Download"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : media.file_type === 'Video' ? (
                            <div className="relative">
                              <video
                                src={media.file_url}
                                className="w-full h-32 object-cover cursor-pointer"
                                controls
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(media.file_url, '_blank')
                                }}
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.open(media.file_url, '_blank')
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2"
                                  title="Open in new tab"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                                <svg className="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.open(media.file_url || media.file_path, '_blank')
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2"
                                  title="View"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownload(media)
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white rounded-full p-2"
                                  title="Download"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs text-dark-300 truncate" title={media.file_path || media.file_url}>
                              {media.file_path?.split('/')?.pop() || media.file_url?.split('/')?.pop() || 'File'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-4 border border-dark-600 rounded-lg">
                    <p className="text-sm text-dark-400">
                      No attachments for this order.
                    </p>
                  </div>
                )}

                <p className="text-xs text-dark-400 mt-2">
                  Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, MOV, AVI), Documents (PDF, DOC, ZIP). Max 16MB per file.
                </p>
              </div>
            </div>

            {/* ========== Order Items Section ========== */}
            <div className="md:col-span-2 border-t border-dark-700 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-white">Order Items</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!order?.id}
                  className="px-3 py-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white text-sm rounded"
                >
                  + Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-dark-400 text-sm">No items yet. Add an item to specify t-shirt sizes and upload design images.</p>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-dark-300">Size:</label>
                          <select
                            value={item.size || ''}
                            onChange={(e) => handleUpdateItem(item.id, { size: e.target.value })}
                            className="bg-dark-700 border border-dark-600 rounded text-white text-sm px-2 py-1"
                          >
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'].map((sz) => (
                              <option key={sz} value={sz}>{sz}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-dark-300">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 1
                              handleUpdateItem(item.id, { quantity: qty })
                            }}
                            className="bg-dark-700 border border-dark-600 rounded text-white text-sm w-16 px-2 py-1"
                          />
                        </div>
                        <div className="text-xs text-dark-400">
                          Position: {item.position !== null && item.position !== undefined ? item.position : '—'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="ml-auto text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Front Images */}
                      <div className="mb-4">
                        <div
                          tabIndex={0}
                          className="flex items-center justify-between mb-2 cursor-pointer focus:outline-none"
                          onPaste={(e) => handleItemPaste(item.id, 'front', e)}
                        >
                          <h4 className="text-sm font-medium text-dark-300">Front Design Images</h4>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => {
                              handleItemFileChange(item.id, 'front', e.target.files)
                              e.target.value = '' // reset
                            }}
                          />
                        </div>
                        <p className="text-xs text-dark-500 mb-2">Tip: You can paste images (Ctrl+V) directly here</p>
                        {/* Pending uploads for front */}
                        {(itemFiles[item.id]?.front?.length > 0) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {itemFiles[item.id].front.map((file, idx) => (
                              <div key={idx} className="relative bg-dark-800 rounded border border-dark-700 overflow-hidden">
                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                                <button
                                  type="button"
                                  onClick={() => removePendingItemFile(item.id, 'front', idx)}
                                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <div className="text-[10px] text-dark-300 p-1 truncate">{file.name}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Existing front images */}
                        {(item.front_images || []).length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {item.front_images.map((media) => (
                              <div key={media.id} className="relative bg-dark-800 rounded border border-dark-700 overflow-hidden">
                                <img src={media.file_url} alt="front" className="w-full h-24 object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeItemMedia(item.id, media.id)}
                                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                  title="Remove"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Back Images */}
                      <div className="mb-2">
                        <div
                          tabIndex={0}
                          className="flex items-center justify-between mb-2 cursor-pointer focus:outline-none"
                          onPaste={(e) => handleItemPaste(item.id, 'back', e)}
                        >
                          <h4 className="text-sm font-medium text-dark-300">Back Design Images</h4>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => {
                              handleItemFileChange(item.id, 'back', e.target.files)
                              e.target.value = ''
                            }}
                          />
                        </div>
                        <p className="text-xs text-dark-500 mb-2">Tip: You can paste images (Ctrl+V) directly here</p>
                        {/* Pending uploads for back */}
                        {(itemFiles[item.id]?.back?.length > 0) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {itemFiles[item.id].back.map((file, idx) => (
                              <div key={idx} className="relative bg-dark-800 rounded border border-dark-700 overflow-hidden">
                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                                <button
                                  type="button"
                                  onClick={() => removePendingItemFile(item.id, 'back', idx)}
                                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <div className="text-[10px] text-dark-300 p-1 truncate">{file.name}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Existing back images */}
                        {(item.back_images || []).length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {item.back_images.map((media) => (
                              <div key={media.id} className="relative bg-dark-800 rounded border border-dark-700 overflow-hidden">
                                <img src={media.file_url} alt="back" className="w-full h-24 object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeItemMedia(item.id, media.id)}
                                  className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                  title="Remove"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Item Form (always visible when there are no items or to add new) */}
              {items.length > 0 && (
                <div className="mt-4 p-4 border border-dark-600 rounded-lg bg-dark-900">
                  <h4 className="text-sm font-medium text-dark-300 mb-2">Add Another Item</h4>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <label className="block text-xs text-dark-400 mb-1">Size</label>
                      <select
                        value={newItem.size}
                        onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                        className="bg-dark-700 border border-dark-600 rounded text-white text-sm px-2 py-1"
                      >
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'].map((sz) => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-dark-400 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        className="bg-dark-700 border border-dark-600 rounded text-white text-sm w-20 px-2 py-1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* ========== End Order Items ========== */}

            <div className="border-t border-dark-700 pt-4">
              <h3 className="text-sm font-medium text-dark-300 mb-2">Current Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-dark-400">Design Ready:</span>{' '}
                  <span className={order.status?.design_ready ? 'text-green-400' : 'text-red-400'}>
                    {order.status?.design_ready ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-dark-400">Printed:</span>{' '}
                  <span className={order.status?.is_printed ? 'text-green-400' : 'text-red-400'}>
                    {order.status?.is_printed ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-dark-400">Picking Done:</span>{' '}
                  <span className={order.status?.picking_done ? 'text-green-400' : 'text-red-400'}>
                    {order.status?.picking_done ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-dark-400">Delivery:</span>{' '}
                  <span className="text-blue-400">{order.status?.delivery_status || 'Pending'}</span>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-dark-700 bg-dark-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 md:py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors touch-manipulation min-h-[44px]"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="order-form"
            disabled={loading}
            className="px-4 py-3 md:py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors touch-manipulation min-h-[44px] text-base md:text-sm"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
