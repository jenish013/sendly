import api from './api'

export const transferService = {
  async createTransfer(data) {
    const response = await api.post('/transfers', data, true)
    return response.data
  },

  async getSentTransfers(params = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page)
    if (params.limit) query.set('limit', params.limit)
    if (params.search) query.set('search', params.search)
    if (params.sort) query.set('sort', params.sort)
    const response = await api.get(`/transfers/sent?${query.toString()}`, true)
    return response.data
  },

  async getReceivedTransfers(params = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page)
    if (params.limit) query.set('limit', params.limit)
    const response = await api.get(`/transfers/received?${query.toString()}`, true)
    return response.data
  },

  async getTransfer(id) {
    const response = await api.get(`/transfers/${id}`, true)
    return response.data
  },

  async revokeTransfer(id) {
    const response = await api.delete(`/transfers/${id}`, true)
    return response.data
  },

  async resendEmail(id) {
    const response = await api.post(`/transfers/${id}/resend-email`, {}, true)
    return response.data
  },

  async completeTransfer(id) {
    const response = await api.post(`/transfers/${id}/complete`, {}, true)
    return response.data
  }
}

export default transferService
