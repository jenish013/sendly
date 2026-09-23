const resolveBaseUrl = () => {
  if (typeof window === 'undefined') return '/api/v1'
  if (import.meta.env.MODE === 'development') return '/api/v1'
  return import.meta.env.VITE_API_URL || '/api/v1'
}

export const getUploadBaseUrl = () => {
  if (typeof window === 'undefined') return '/api/v1'
  const { hostname, protocol } = window.location

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1'
  }

  if (hostname.match(/^192\.168\./) || hostname.match(/^10\./) || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
    return `http://${hostname}:5000/api/v1`
  }

  if (protocol === 'http:') {
    return `http://${hostname}:5000/api/v1`
  }

  return '/api/v1'
}

export const API_BASE_URL = resolveBaseUrl()

const getToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sendly_token')
}

const getHeaders = (includeAuth = true, extraHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  }
  if (includeAuth) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  return headers
}

const handleResponse = async (response) => {
  const data = await response.json()
  if (!response.ok || !data.success) {
    const error = new Error(data?.error?.message || 'Something went wrong')
    error.code = data?.error?.code || 'UNKNOWN_ERROR'
    error.status = response.status
    throw error
  }
  return data
}

export const api = {
  async get(path, includeAuth = true, extraHeaders = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: getHeaders(includeAuth, extraHeaders)
    })
    return handleResponse(response)
  },

  async post(path, body, includeAuth = true, extraHeaders = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(includeAuth, extraHeaders),
      body: body ? JSON.stringify(body) : undefined
    })
    return handleResponse(response)
  },

  async delete(path, body, includeAuth = true, extraHeaders = {}) {
    const headers = getHeaders(includeAuth, extraHeaders)
    if (body) {
      headers['Content-Type'] = 'application/json'
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    return handleResponse(response)
  },

  async uploadFile(path, formData, includeAuth = true) {
    const headers = {}
    if (includeAuth) {
      const token = getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData
    })
    return handleResponse(response)
  }
}

export default api
