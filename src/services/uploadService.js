import api, { getUploadBaseUrl } from './api'

export const uploadService = {
  async createMultipartUpload(key, mimeType, partCount = 1) {
    const response = await api.post('/uploads/multipart', {
      key,
      mimeType,
      partCount
    }, true)
    return response.data
  },

  getUploadPartUrl(uploadId, key, partNumber) {
    const baseUrl = getUploadBaseUrl()
    return `${baseUrl}/uploads/${uploadId}/part?key=${encodeURIComponent(key)}&partNumber=${partNumber}`
  },

  async uploadPartDirect(uploadId, key, partNumber, file) {
    const uploadUrl = this.getUploadPartUrl(uploadId, key, partNumber)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('key', key)
    formData.append('partNumber', String(partNumber))

    const token = typeof window !== 'undefined' ? localStorage.getItem('sendly_token') : null
    const headers = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.error?.message || `Upload failed: ${response.status}`)
    }

    return response.json()
  },

  async uploadPart(uploadId, key, partNumber, file) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('key', key)
    formData.append('partNumber', String(partNumber))
    const response = await api.uploadFile(`/uploads/${uploadId}/part`, formData, true)
    return response.data
  },

  async completeUpload(uploadId, key, parts) {
    const response = await api.post(`/uploads/${uploadId}/complete`, {
      key,
      parts: parts || []
    }, true)
    return response.data
  },

  async abortUpload(uploadId, key) {
    const response = await api.post(`/uploads/${uploadId}/abort`, {
      key
    }, true)
    return response.data
  }
}

export default uploadService
