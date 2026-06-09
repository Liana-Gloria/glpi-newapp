import api from './client'

// Phase 7 — synchronisation GLPI (backoffice, admin only).
export const getSyncStatus = () => api.get('/sync/status').then((r) => r.data)
export const pushToGlpi = () => api.post('/sync/push').then((r) => r.data)
export const pullFromGlpi = () => api.post('/sync/pull').then((r) => r.data)
