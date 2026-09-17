import api from './api'

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password }, false)
    const { token, user } = response.data
    if (typeof window !== 'undefined') {
      localStorage.setItem('sendly_token', token)
    }
    return { token, user }
  },

  async register(name, email, password) {
    const response = await api.post('/auth/register', { name, email, password }, false)
    const { token, user } = response.data
    if (typeof window !== 'undefined') {
      localStorage.setItem('sendly_token', token)
    }
    return { token, user }
  },

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sendly_token')
    }
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me', true)
    return response.data.user
  },

  isAuthenticated() {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('sendly_token')
  },

  getToken() {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('sendly_token')
  }
}

export default authService
