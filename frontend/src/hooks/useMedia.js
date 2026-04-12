import { useState, useEffect, useCallback } from 'react'
import { mediaApi } from '../services/api'

export function useMedia(orderId) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMedia = useCallback(async () => {
    if (!orderId) return
    try {
      setLoading(true)
      setError(null)
      const res = await mediaApi.getAll(orderId)
      setMedia(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch media')
      console.error('useMedia: fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const uploadMedia = useCallback(async (files, itemId = null, side = null) => {
    const res = await mediaApi.upload(orderId, files, itemId, side)
    const uploaded = res.data.uploaded || res.data
    // Refresh media list after upload
    await fetchMedia()
    return uploaded
  }, [orderId, fetchMedia])

  const uploadDesignFiles = useCallback(async (files) => {
    const res = await mediaApi.uploadDesignFiles(orderId, files)
    const uploaded = res.data.uploaded || res.data
    await fetchMedia()
    return uploaded
  }, [orderId, fetchMedia])

  const deleteMedia = useCallback(async (mediaId) => {
    await mediaApi.delete(mediaId)
    setMedia(prev => prev.filter(m => m.id !== mediaId))
  }, [])

  const downloadMedia = useCallback((media) => {
    const downloadUrl = `/api/media/${media.id}/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  return {
    media,
    loading,
    error,
    uploadMedia,
    uploadDesignFiles,
    deleteMedia,
    downloadMedia,
    refresh: fetchMedia,
    fetchMedia,
  }
}
