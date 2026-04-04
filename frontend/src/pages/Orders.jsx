import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ordersApi, mediaApi, settingsApi } from '../services/api'
import { DIVISION_OPTIONS, DISTRICT_OPTIONS, UPAZILA_OPTIONS, getDistrictsByDivision, getUpazilasByDistrict } from '../constants/locations'
import ConfirmationModal from '../components/ConfirmationModal'
import OrderModal from '../components/OrderModal'
import SearchableSelect from '../components/SearchableSelect'

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

const ProgressBar = ({ order }) => {
  const steps = [
    { label: 'Design', done: order.status?.design_ready },
    { label: 'Print', done: order.status?.is_printed },
    { label: 'Parcel', done: !!order.courier_parcel_id },
    { label: 'Deliver', done: order.status?.delivery_status },
  ]

  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <div className={`flex-1 h-1.5 rounded-full ${step.done ? 'bg-primary-500' : 'bg-dark-700'}`} />
          {idx < steps.length - 1 && <div className="w-2" />}
        </React.Fragment>
      ))}
    </div>
  )
}

// Quick action modal component
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
          alert(`File type not allowed for "${file.name}". Skipping.`)
          continue
        }
        validFiles.push(file)
      }

      setDesignFiles(prev => [...prev, ...validFiles])
      // Reset input
      if (designFileInputRef.current) {
        designFileInputRef.current.value = ''
      }
    }
  }

  const removeDesignFile = (index) => {
    setDesignFiles(prev => prev.filter((_, i) => i !== index))
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
      setDesignFiles(prev => [...prev, ...validFiles])
    }
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

            {/* Design file upload section - shows when design_ready is checked */}
            {formData.design_ready && (
              <div className="mt-4 ml-6 border-l-2 border-primary-500 pl-4">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Upload Design File
                </label>
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
                    // Validate and add files
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

                {/* Design files preview */}
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
              className="px-4 py-3 md:py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors touch-manipulation min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-3 md:py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors touch-manipulation min-h-[44px]"
            >
              Update Status
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Download/Preview modal for files
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

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const [upazilaSearch, setUpazilaSearch] = useState('')
  const [formData, setFormData] = useState({
    customer_name: '',
    phone_number: '',
    division_id: '',
    district_id: '',
    upazila_id: '',
    address: '',
    description: '',
    price: '',
    payment_type: 'COD',
    courier_parcel_id: '',
    media_files: [],
    items: [], // Array of { size, quantity, position }
  })
  const [newItem, setNewItem] = useState({ size: 'M', quantity: 1 })
  const [itemFiles, setItemFiles] = useState({}) // { index: { front: File[], back: File[] } }
  const [orderModalOrder, setOrderModalOrder] = useState(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState({
    order_id: true,
    customer_name: false,
    phone_number: false,
    address: false,
    description: false,
    price: false,
    payment_type: false,
    courier_parcel_id: true,
    created_at: false,
    items: true,
    attachments: false
  })
  // Note: Using react-select, so no separate search state needed

  // Computed: districts for filter dropdown (by selectedDivision filter)
  const filteredDistricts = useMemo(() => {
    if (!selectedDivision) return []
    return getDistrictsByDivision(selectedDivision)
  }, [selectedDivision])

  // Computed: upazilas for filter dropdown (by selectedDistrict filter)
  const filteredUpazilas = useMemo(() => {
    if (!selectedDistrict) return []
    const district = DISTRICT_OPTIONS.find(d => d.id === selectedDistrict)
    return district ? getUpazilasByDistrict(district.id) : []
  }, [selectedDistrict])

  // Computed: districts for create form (by formData.division_id)
  const filteredFormDistricts = useMemo(() => {
    if (!formData.division_id) return []
    return getDistrictsByDivision(formData.division_id)
  }, [formData.division_id])

  // Computed: upazilas for create form (by formData.district_id)
  const filteredFormUpazilas = useMemo(() => {
    if (!formData.district_id) return []
    return getUpazilasByDistrict(formData.district_id)
  }, [formData.district_id])
  const [uploadFiles, setUploadFiles] = useState([])
  const [orderMedia, setOrderMedia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null)
  const fileInputRef = useRef(null)
  const itemFileRefs = useRef({}) // For item-specific file inputs (front/back)
  const [saving, setSaving] = useState(false)

  // File upload handlers for create order
  const validateAndAddFiles = (files) => {
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
        alert(`File type not allowed for "${file.name}". Skipping.`)
        continue
      }
      validFiles.push(file)
    }

    setFormData(prev => ({
      ...prev,
      media_files: [...(prev.media_files || []), ...validFiles]
    }))
  }

  const handleFileChange = (e) => {
    if (e.target.files) {
      validateAndAddFiles(Array.from(e.target.files))
      // Reset input
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
      validateAndAddFiles(validFiles)
    }
  }

  const removeNewFile = (index) => {
    setFormData(prev => ({
      ...prev,
      media_files: prev.media_files.filter((_, i) => i !== index)
    }))
  }

  // ========== Items Management (Create Order) ==========
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem, position: prev.items.length + 1 }]
    }))
    setNewItem({ size: 'M', quantity: 1 }) // reset
  }

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
    // Reindex itemFiles to keep them in sync with items array after removal
    setItemFiles(prev => {
      const newItemFiles = {}
      Object.keys(prev).forEach(key => {
        const idx = parseInt(key, 10)
        if (idx < index) {
          newItemFiles[idx] = prev[key]
        } else if (idx > index) {
          newItemFiles[idx - 1] = prev[key]
        }
        // idx === index is skipped (removed)
      })
      return newItemFiles
    })
  }

  const handleItemFileChange = (itemIndex, side, files) => {
    console.log('handleItemFileChange called:', { itemIndex, side, fileCount: files?.length })
    const fileList = Array.from(files)
    console.log('Files array:', fileList.map(f => f.name))
    setItemFiles(prev => {
      const itemState = prev[itemIndex] || { front: [], back: [] }
      const validFiles = []
      const maxSize = 16 * 1024 * 1024
      for (const file of fileList) {
        if (file.size > maxSize) {
          alert(`File "${file.name}" exceeds 16MB limit. Skipping.`)
          continue
        }
        validFiles.push(file)
      }
      const newState = {
        ...prev,
        [itemIndex]: {
          ...itemState,
          [side]: [...(itemState[side] || []), ...validFiles]
        }
      }
      console.log('itemFiles newState:', newState)
      return newState
    })
  }

  const removePendingItemFile = (itemIndex, side, fileIdx) => {
    setItemFiles(prev => {
      const itemState = prev[itemIndex] || { front: [], back: [] }
      const newFiles = itemState[side].filter((_, i) => i !== fileIdx)
      return {
        ...prev,
        [itemIndex]: { ...itemState, [side]: newFiles }
      }
    })
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(), 300)
    return () => clearTimeout(timer)
  }, [search, selectedDivision, selectedDistrict, statusFilter])

  const fetchOrders = async () => {
    try {
      // Convert selected IDs to names for API
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
        status: statusFilter,
      })
      setOrders(res.data)
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

  const handlePrintSelected = () => {
    if (selectedOrderIds.size === 0) {
      alert('Please select at least one order to print')
      return
    }
    // Open column selection modal
    setShowColumnModal(true)
  }

  const handleGeneratePrint = () => {
    // Validate at least one column selected
    const hasSelectedColumn = Object.values(selectedColumns).some(val => val)
    if (!hasSelectedColumn) {
      alert('Please select at least one column to include')
      return
    }

    const orderIds = Array.from(selectedOrderIds).join(',')
    const columnsJson = JSON.stringify(selectedColumns)
    const encodedColumns = encodeURIComponent(columnsJson)
    const printUrl = `/api/orders/print?order_ids=${orderIds}&columns=${encodedColumns}`
    window.open(printUrl, '_blank')
    setShowColumnModal(false)
  }

  const handleColumnChange = (columnKey) => {
    setSelectedColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const handleMarkAsReady = async () => {
    if (selectedOrderIds.size === 0) {
      alert('Please select at least one order')
      return
    }
    if (!confirm(`Mark ${selectedOrderIds.size} order(s) as Design Ready?`)) return

    try {
      for (const orderId of selectedOrderIds) {
        await ordersApi.updateStatus(orderId, { design_ready: true })
      }
      showNotification(`${selectedOrderIds.size} order(s) marked as Design Ready`)
      setSelectedOrderIds(new Set())
      fetchOrders()
    } catch (error) {
      showNotification('Failed to update orders', 'error')
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedOrderIds.size === 0) {
      alert('Please select at least one order to delete')
      return
    }
    if (!confirm(`Delete ${selectedOrderIds.size} order(s)? This cannot be undone.`)) return

    try {
      for (const orderId of selectedOrderIds) {
        await ordersApi.delete(orderId)
      }
      showNotification(`${selectedOrderIds.size} order(s) deleted`)
      setSelectedOrderIds(new Set())
      fetchOrders()
    } catch (error) {
      showNotification('Failed to delete orders', 'error')
    }
  }

  // Generate preview for media files
  const renderFilePreview = (file, index) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    return (
      <div key={index} className="bg-dark-900 rounded-lg overflow-hidden border border-dark-700 relative group">
        {isImage ? (
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="w-full h-32 object-cover"
            onLoad={(e) => URL.revokeObjectURL(e.target.src)}
          />
        ) : isVideo ? (
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
      </div>
    )
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    setSaving(true)
    console.log('=== handleCreateOrder called ===')
    console.log('formData.state:', {
      customer_name: formData.customer_name,
      division_id: formData.division_id,
      district_id: formData.district_id,
      upazila_id: formData.upazila_id,
      has_media: !!formData.media_files,
      media_count: formData.media_files?.length || 0
    })
    try {
      // Validate required fields
      if (!formData.customer_name || !formData.division_id || !formData.district_id || !formData.upazila_id || !formData.description) {
        console.error('Validation failed - missing required fields')
        showNotification('Please fill all required fields', 'error')
        setSaving(false)
        return
      }

      // Convert IDs to names for backend
      const division = DIVISION_OPTIONS.find(div => div.id === formData.division_id)
      const district = DISTRICT_OPTIONS.find(d => d.id === formData.district_id)
      let upazila_zone = ''

      // Handle both cases: upazila_id could be an ID string or the zone object itself
      if (typeof formData.upazila_id === 'object' && formData.upazila_id !== null) {
        // It's the zone object directly (when zone had no id initially)
        upazila_zone = formData.upazila_id.name || ''
      } else if (formData.upazila_id) {
        const upazila = filteredFormUpazilas.find(u => u.id === formData.upazila_id)
        upazila_zone = upazila?.name || ''
      }

      console.log('Location lookups:', { division, district, upazila_zone, upazila_id_type: typeof formData.upazila_id })

      const orderData = {
        customer_name: formData.customer_name,
        phone_number: formData.phone_number,
        division: division?.name || '',
        district: district?.name || '',
        upazila_zone,
        address: formData.address,
        description: formData.description,
        price: formData.price,
        payment_type: formData.payment_type,
        courier_parcel_id: formData.courier_parcel_id,
        items: formData.items.map(item => ({
          size: item.size,
          quantity: item.quantity,
          position: item.position
        }))
      }

      console.log('Order data to send:', orderData)

      // Extract media files separately
      const mediaFiles = formData.media_files
      console.log('Media files to upload:', {
        count: mediaFiles?.length || 0,
        files: mediaFiles ? Array.from(mediaFiles).map(f => ({ name: f.name, size: f.size, type: f.type })) : []
      })

      // Create order
      console.log('Sending order creation request...')
      const res = await ordersApi.create(orderData)
      const orderId = res.data.id
      console.log('Order created successfully, ID:', orderId, 'Response:', res.data)

      // Check Steadfast result
      const steadfastResult = res.data.steadfast
      let steadfastError = null
      if (steadfastResult) {
        if (steadfastResult.attempted && !steadfastResult.success) {
          steadfastError = steadfastResult.error
          console.warn('Steadfast consignment creation failed:', steadfastError)
        }
      }

      // Upload media if any (order-level attachments)
      let mediaUploadError = null
      if (mediaFiles && mediaFiles.length > 0) {
        console.log('Starting media upload for', mediaFiles.length, 'files')
        console.log('Uploading files:', Array.from(mediaFiles).map(f => f.name))
        try {
          const uploadResult = await mediaApi.uploadDesignFiles(orderId, mediaFiles)
          console.log('✅ Media upload successful:', uploadResult)
        } catch (err) {
          console.error('❌ Media upload failed:', err)
          console.error('Upload error details:', err.response?.data || err.message)
          mediaUploadError = err
        }
      } else {
        console.log('No media files to upload')
      }

      // Items are created with the order; now upload item-specific files
      let itemsError = null
      const createdItems = res.data.items || []
      console.log('Created items from response:', createdItems)
      console.log('itemFiles state:', itemFiles)
      if (formData.items && formData.items.length > 0) {
        console.log('Uploading files for', formData.items.length, 'items')
        try {
          for (let idx = 0; idx < formData.items.length; idx++) {
            const createdItem = createdItems[idx]
            console.log(`Processing item ${idx}:`, createdItem, 'itemFiles[${idx}]:', itemFiles[idx])
            if (!createdItem || !createdItem.id) {
              console.warn(`Item ${idx} missing ID in response, skipping file upload`)
              continue
            }
            // Upload item images if any for this item index
            const filesForItem = itemFiles[idx]
            if (filesForItem) {
              if (filesForItem.front && filesForItem.front.length > 0) {
                console.log(`Uploading ${filesForItem.front.length} front images for item ${createdItem.id}`)
                try {
                  await mediaApi.upload(orderId, filesForItem.front, createdItem.id, 'front')
                  console.log(`✅ Front images uploaded for item ${createdItem.id}`)
                } catch (uploadErr) {
                  console.error(`❌ Front image upload failed for item ${createdItem.id}:`, uploadErr)
                  itemsError = uploadErr
                }
              }
              if (filesForItem.back && filesForItem.back.length > 0) {
                console.log(`Uploading ${filesForItem.back.length} back images for item ${createdItem.id}`)
                try {
                  await mediaApi.upload(orderId, filesForItem.back, createdItem.id, 'back')
                  console.log(`✅ Back images uploaded for item ${createdItem.id}`)
                } catch (uploadErr) {
                  console.error(`❌ Back image upload failed for item ${createdItem.id}:`, uploadErr)
                  itemsError = uploadErr
                }
              }
            }
          }
        } catch (err) {
          console.error('❌ Item file upload failed:', err)
          itemsError = err
        }
      } else {
        console.log('No items to upload files for')
      }

      // Determine notification message
      if (steadfastError) {
        showNotification(`Order created but Steadfast failed: ${steadfastError}`, 'error')
      } else if (!mediaUploadError && !itemsError) {
        showNotification('Order created successfully with items!')
      } else if (mediaUploadError && itemsError) {
        showNotification('Order created but both media and items failed. Please retry.', 'error')
      } else if (mediaUploadError) {
        showNotification('Order and items created, but media upload failed.', 'error')
      } else if (itemsError) {
        showNotification('Order created, but some items failed. Please add items manually.', 'error')
      } else {
        showNotification('Order created successfully!')
      }
      setShowForm(false)
      setFormData({
        customer_name: '',
        phone_number: '',
        division_id: '',
        district_id: '',
        upazila_id: '',
        address: '',
        description: '',
        price: '',
        payment_type: 'COD',
        courier_parcel_id: '',
        media_files: [],
        items: [],
      })
      setItemFiles({})
      setNewItem({ size: 'M', quantity: 1 })
      fetchOrders()
      console.log('=== handleCreateOrder completed ===')
      setSaving(false)
    } catch (error) {
      console.error('Order creation failed:', error)
      console.error('Error details:', error.response?.data || error.message)
      showNotification(error.response?.data?.error || 'Failed to create order', 'error')
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (orderId, statusData, designFiles = null) => {
    try {
      // If there are new design files, upload them first
      if (designFiles && designFiles.length > 0) {
        try {
          await mediaApi.uploadDesignFiles(orderId, designFiles)
        } catch (mediaErr) {
          console.warn('Design upload failed:', mediaErr)
          showNotification('Design file upload failed. Please try again.', 'error')
          return // keep modal open for retry
        }
      }

      // Update status only after successful upload (or if no files needed)
      await ordersApi.updateStatus(orderId, statusData)

      // Show appropriate success message
      if (designFiles && designFiles.length > 0) {
        showNotification('Status updated and design file(s) uploaded!')
      } else {
        showNotification('Status updated!')
      }

      fetchOrders()
      setShowModal(false)
      setEditingOrder(null)
    } catch (error) {
      showNotification('Failed to update status', 'error')
    }
  }

  const handleDeleteOrder = async (orderId) => {
    setDeleteConfirmOrder(orderId)
  }

  const confirmDeleteOrder = async () => {
    if (!deleteConfirmOrder) return
    try {
      await ordersApi.delete(deleteConfirmOrder)
      showNotification('Order deleted!')
      fetchOrders()
    } catch (error) {
      showNotification('Failed to delete order', 'error')
    } finally {
      setDeleteConfirmOrder(null)
    }
  }

  const handleMediaUpload = async (orderId, files) => {
    try {
      await mediaApi.upload(orderId, files)
      showNotification('Files uploaded!')
      fetchOrders()
      // If we're currently viewing media for this order, refresh the list
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
      const orderData = res.data

      // Map division, district, upazila names to IDs for the edit form
      const division = DIVISION_OPTIONS.find(div => div.name === orderData.division)
      const district = DISTRICT_OPTIONS.find(d => d.name === orderData.district)
      let upazila_id = ''
      if (district) {
        const upazilas = getUpazilasByDistrict(district.id)
        const upazila = upazilas.find(u => u.name === orderData.upazila_zone)
        upazila_id = upazila?.id || ''
      }

      // Add ID fields to orderData for the modal form
      orderData.division_id = division?.id || ''
      orderData.district_id = district?.id || ''
      orderData.upazila_id = upazila_id

      setOrderModalOrder(orderData)
      setShowOrderModal(true)
    } catch (error) {
      console.error('Failed to fetch order details:', error)
      alert('Failed to load order details')
    }
  }

  const sendToSteadfast = async (orderId, e) => {
    e.stopPropagation()
    if (!confirm('Create Steadfast consignment for this order?')) return
    try {
      const res = await settingsApi.createSteadfastOrder(orderId)
      if (res.data.success) {
        showNotification('Steadfast consignment created successfully!')
        // Refresh the order list to show tracking ID if available
        fetchOrders()
      } else {
        showNotification('Failed: ' + (res.data.error || res.data.details || 'Unknown error'), 'error')
      }
    } catch (error) {
      console.error('Steadfast send failed:', error)
      showNotification('Failed to create consignment: ' + (error.response?.data?.error || error.message), 'error')
    }
  }

  const handleOrderSave = async (orderData) => {
    setSaving(true)
    try {
      const mediaFiles = orderData.media_files
      const updateData = { ...orderData }
      delete updateData.media_files

      await ordersApi.update(updateData.id, updateData)

      if (mediaFiles && mediaFiles.length > 0) {
        try {
          await mediaApi.uploadDesignFiles(updateData.id, mediaFiles)
        } catch (mediaErr) {
          console.warn('Media upload failed:', mediaErr)
        }
      }

      showNotification('Order updated successfully!')
      fetchOrders()
      // Refresh modal order if it's the same
      if (orderModalOrder && orderModalOrder.id === orderData.id) {
        const res = await ordersApi.getById(orderModalOrder.id, { include_items: true })
        setOrderModalOrder(res.data)
      }
    } catch (error) {
      console.error('Failed to update order:', error)
      showNotification('Failed to update order: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-dark-400 mt-1">Manage all your custom t-shirt orders</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by name, phone, or parcel ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <SearchableSelect
              options={DIVISION_OPTIONS}
              value={selectedDivision}
              onChange={(value) => {
                setSelectedDivision(value)
                setSelectedDistrict('')
                setFilterDistrictSearch('')
              }}
              placeholder="All Divisions"
              isDisabled={false}
            />
          </div>
          <div>
            <SearchableSelect
              options={filteredDistricts}
              value={selectedDistrict}
              onChange={(value) => setSelectedDistrict(value)}
              placeholder="All Districts"
              isDisabled={!selectedDivision}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="design_pending">Design Pending</option>
              <option value="design_ready">Design Ready</option>
              <option value="printed">Printed</option>
              <option value="picked">Picked</option>
              <option value="submitted">Submitted to Courier</option>
              <option value="delivered">Delivered</option>
              <option value="returned">Returned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Toast - Top Right */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-fade-in">
          <div className={`p-4 rounded-lg border shadow-lg ${notification.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' : 'bg-green-900/90 border-green-700 text-green-100'}`}>
            <div className="flex items-center gap-3">
              {notification.type === 'error' ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-dark-400">No orders found. Create your first order!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrintSelected}
                  disabled={selectedOrderIds.size === 0}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg text-sm transition-colors"
                >
                  Print Selected ({selectedOrderIds.size})
                </button>
                <button
                  onClick={handleMarkAsReady}
                  disabled={selectedOrderIds.size === 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg text-sm transition-colors"
                >
                  Mark Design Ready ({selectedOrderIds.size})
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedOrderIds.size === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-lg text-sm transition-colors"
                >
                  Delete Selected ({selectedOrderIds.size})
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-dark-800 rounded-lg border border-dark-700 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="w-5 h-5 cursor-pointer"
                      />
                      <div>
                        <p className="text-white font-medium text-lg">#{order.id}</p>
                        <p className="text-xs text-dark-400">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <StatusBadge status={order.status?.delivery_status} />
                  </div>

                  <div className="space-y-2 mb-3">
                    <div>
                      <p className="text-white font-medium">{order.customer_name}</p>
                      <p className="text-sm text-dark-400">{order.phone_number}</p>
                    </div>
                    <div>
                      <p className="text-dark-300 text-sm">{order.division}, {order.district}</p>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-dark-400 text-xs">Price</p>
                        <p className="text-white font-medium">৳{order.price || '0'}</p>
                        <p className="text-xs text-dark-400">{order.payment_type}</p>
                      </div>
                      <div>
                        <p className="text-dark-400 text-xs">Items</p>
                        <p className="text-white">
                          {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ProgressBar order={order} />

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setOrderModalOrder(order)
                        setShowOrderModal(true)
                      }}
                      className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors touch-manipulation min-h-[44px]"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openQuickAction(order)}
                      className="flex-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm transition-colors touch-manipulation min-h-[44px]"
                    >
                      Quick Update
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors touch-manipulation min-h-[44px]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto -mx-6 sm:mx-0">
              <table className="w-full min-w-[800px]">
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">Status</th>
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
                      <StatusBadge status={order.status?.delivery_status} />
                      <ProgressBar order={order} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingOrder(order)
                            setShowModal(true)
                          }}
                          className="text-primary-400 hover:text-primary-300 p-1"
                          title="Quick Update"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const mediaRes = await mediaApi.getAll(order.id)
                              console.log('Media loaded for order', order.id, ':', mediaRes.data)
                              setOrderMedia(mediaRes.data)
                              setEditingOrder(order)
                            } catch (error) {
                              console.error('Failed to fetch media for order', order.id, ':', error)
                              alert('Failed to load media. See console for details.')
                            }
                          }}
                          className="text-purple-400 hover:text-purple-300 p-1"
                          title="View Media"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openOrderModal(order)}
                          className="text-teal-400 hover:text-teal-300 p-1"
                          title="View/Edit Order"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {!order.courier_parcel_id && (
                          <button
                            onClick={(e) => sendToSteadfast(order.id, e)}
                            className="text-orange-400 hover:text-orange-300 p-1"
                            title="Send to Steadfast"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 18h.01" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white">Create New Order</h2>
              <button onClick={() => setShowForm(false)} className="text-dark-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Division *</label>
                  <SearchableSelect
                    options={DIVISION_OPTIONS}
                    value={formData.division_id}
                    onChange={(value) => {
                      setFormData({ ...formData, division_id: value, district_id: '', upazila_id: '' })
                      setDistrictSearch('')
                      setUpazilaSearch('')
                    }}
                    placeholder="Select Division"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">District *</label>
                  <SearchableSelect
                    options={filteredFormDistricts}
                    value={formData.district_id}
                    onChange={(value) => {
                      setFormData({ ...formData, district_id: value, upazila_id: '' })
                      setUpazilaSearch('')
                    }}
                    placeholder="Select District"
                    isDisabled={!formData.division_id}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Thana *</label>
                  <SearchableSelect
                    options={filteredFormUpazilas}
                    value={formData.upazila_id}
                    onChange={(value) => setFormData({ ...formData, upazila_id: value })}
                    placeholder="Select Thana"
                    isDisabled={!formData.district_id}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Address</label>
                  <textarea
                    name="address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows="3"
                    placeholder="Full delivery address"
                    className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Payment Type *</label>
                  <select
                    value={formData.payment_type}
                    onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                    className="w-full px-4 py-3 md:py-2 bg-dark-700 border border-dark-600 rounded-lg text-base md:text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation resize-none"
                  >
                    <option value="COD">Cash on Delivery</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Description *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Product details, sizes, colors, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Courier Parcel ID</label>
                <input
                  type="text"
                  value={formData.courier_parcel_id}
                  onChange={(e) => setFormData({ ...formData, courier_parcel_id: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional: Assign tracking ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Price (৳)</label>
                <input
                  type="text"
                  name="price"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Attachments (Images, Videos, Files)</label>

                {/* Drag and drop zone */}
                <button
                  type="button"
                  tabIndex={0}
                  className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer focus:outline-none focus:border-primary-500 w-full text-left"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary-500') }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-primary-500')
                    const files = Array.from(e.dataTransfer.files)
                    validateAndAddFiles(files)
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
                {formData.media_files && formData.media_files.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-dark-300 mb-2">Selected Files ({formData.media_files.length}):</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {formData.media_files.map((file, index) => renderFilePreview(file, index))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-dark-400 mt-2">
                  Supported: Images (JPG, PNG, GIF, WebP), Videos (MP4, MOV, AVI), Documents (PDF, DOC, ZIP). Max 16MB per file.
                </p>
              </div>

              {/* ========== Order Items Section ========== */}
              <div className="md:col-span-2 border-t border-dark-700 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-white">Order Items</h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded"
                  >
                    + Add Item
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <p className="text-dark-400 text-sm">No items yet. Add items to specify t-shirt sizes and upload design images.</p>
                ) : (
                  <div className="space-y-6">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-dark-300">Size:</label>
                            <select
                              value={item.size || ''}
                              onChange={(e) => {
                                const newItems = [...formData.items]
                                newItems[idx] = { ...newItems[idx], size: e.target.value }
                                setFormData({ ...formData, items: newItems })
                              }}
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
                                const newItems = [...formData.items]
                                newItems[idx] = { ...newItems[idx], quantity: qty }
                                setFormData({ ...formData, items: newItems })
                              }}
                              className="bg-dark-700 border border-dark-600 rounded text-white text-sm w-16 px-2 py-1"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="ml-auto text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </div>

                        {/* Front Images */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-dark-300">Front Design Images</h4>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                handleItemFileChange(idx, 'front', e.target.files)
                                e.target.value = ''
                              }}
                            />
                          </div>
                          {/* Pending uploads for front */}
                          {itemFiles[idx]?.front?.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                              {itemFiles[idx].front.map((file, fileIdx) => (
                                <div key={fileIdx} className="relative bg-dark-800 rounded border border-dark-700 overflow-hidden">
                                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                                  <button
                                    type="button"
                                    onClick={() => removePendingItemFile(idx, 'front', fileIdx)}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                  <div className="text-[10px] text-dark-300 p-1 truncate">{file.name}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Back Images */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-dark-300">Back Design Images</h4>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                handleItemFileChange(idx, 'back', e.target.files)
                                e.target.value = ''
                              }}
                            />
                          </div>
                          {/* Pending uploads for back */}
                          {itemFiles[idx]?.back?.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                              {itemFiles[idx].back.map((file, fileIdx) => (
                                <div key={fileIdx} className="relative bg-dark-800 rounded border border-dark-700 overflow-hidden">
                                  <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                                  <button
                                    type="button"
                                    onClick={() => removePendingItemFile(idx, 'back', fileIdx)}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                  <div className="text-[10px] text-dark-300 p-1 truncate">{file.name}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Item Form */}
                {formData.items.length > 0 && (
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

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="px-4 py-3 md:py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-3 md:py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                >
                  {saving ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Update Modal */}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirmOrder}
        onClose={() => setDeleteConfirmOrder(null)}
        onConfirm={confirmDeleteOrder}
        title="Delete Order"
        message="Are you sure you want to delete this order? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Full Order Edit Modal */}
      {showOrderModal && orderModalOrder && (
        <OrderModal
          order={orderModalOrder}
          onClose={() => {
            setShowOrderModal(false)
            setOrderModalOrder(null)
          }}
          onSave={handleOrderSave}
          loading={saving}
        />
      )}

      {/* Column Selection Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg border border-dark-700 w-full max-w-lg flex flex-col" style={{ maxHeight: '98vh' }}>
            <div className="flex justify-between items-center p-4 border-b border-dark-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">Select Columns for Print</h3>
              <button onClick={() => setShowColumnModal(false)} className="text-dark-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-grow">
              <p className="text-sm text-dark-300 mb-4">
                Select the columns to include in the printout. At least one column is required.
              </p>
              <div className="space-y-3">
                {/* Select All checkbox */}
                <label className="flex items-center space-x-3 cursor-pointer hover:text-dark-200 font-semibold text-primary-400 border-b border-dark-700 pb-2">
                  <input
                    type="checkbox"
                    checked={Object.values(selectedColumns).every(v => v)}
                    onChange={() => {
                      const allSelected = Object.values(selectedColumns).every(v => v)
                      const newColumns = {}
                      Object.keys(selectedColumns).forEach(key => {
                        newColumns[key] = !allSelected
                      })
                      setSelectedColumns(newColumns)
                    }}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{Object.values(selectedColumns).every(v => v) ? 'Deselect All' : 'Select All'}</span>
                </label>

                {Object.entries(selectedColumns).map(([key, value]) => (
                  <label key={key} className="flex items-center space-x-3 cursor-pointer hover:text-dark-200">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => handleColumnChange(key)}
                      className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-dark-300">
                      {key === 'order_id' && 'Order ID'}
                      {key === 'customer_name' && 'Customer Name'}
                      {key === 'phone_number' && 'Phone Number'}
                      {key === 'address' && 'Address (Division, District, Thana)'}
                      {key === 'description' && 'Description'}
                      {key === 'price' && 'Price'}
                      {key === 'payment_type' && 'Payment Type'}
                      {key === 'courier_parcel_id' && 'Courier Parcel ID'}
                      {key === 'created_at' && 'Created Date'}
                      {key === 'items' && 'Items (Size, Qty, Front/Back Images)'}
                      {key === 'attachments' && 'Attachments/Design Files'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-dark-700 flex-shrink-0">
              <button
                onClick={() => setShowColumnModal(false)}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePrint}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Print ({selectedOrderIds.size} order{selectedOrderIds.size > 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
