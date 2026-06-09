import axios from 'axios'

export const API_BASE = 'http://localhost:3001/api'
export const ADMIN_CODE_KEY = 'admin_code'

const api = axios.create({ baseURL: API_BASE })

// Inject the admin code (stored at login) on every request.
api.interceptors.request.use((config) => {
  const code = sessionStorage.getItem(ADMIN_CODE_KEY)
  if (code) config.headers['x-admin-code'] = code
  return config
})

export default api
