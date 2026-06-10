import api from './client'

// Items + tableau de bord + import/reset (espace admin)
export async function fetchItems({ type = '', search = '' } = {}) {
  const params = {}
  if (type) params.type = type
  if (search) params.search = search
  const { data } = await api.get('/items', { params })
  return data
}

export async function fetchItemTypes() {
  const { data } = await api.get('/items/types')
  return data
}

export async function fetchDashboard() {
  const { data } = await api.get('/dashboard')
  return data
}

export async function previewImport(formData) {
  const { data } = await api.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function importData(formData, onUploadProgress) {
  const { data } = await api.post('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
  return data
}

export async function resetAll({ syncGlpi = true } = {}) {
  const { data } = await api.delete('/reset', { data: { syncGlpi } })
  return data
}
