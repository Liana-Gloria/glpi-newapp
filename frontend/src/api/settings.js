import api from './client'

export async function fetchSettings() {
  const { data } = await api.get('/settings')
  return data
}

export async function saveSettings(payload) {
  const { data } = await api.put('/settings', payload)
  return data
}

// Valide un code admin via la route protégée GET /api/auth/check.
export async function verifyAdminCode(code) {
  await api.get('/auth/check', { headers: { 'x-admin-code': code } })
  return true
}
