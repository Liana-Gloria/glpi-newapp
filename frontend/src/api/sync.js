import api from './client'

// Synchronisation GLPI (backoffice, admin only).
// La sync est désormais automatique (temps réel) côté serveur ; ces appels
// servent à visualiser l'état et le journal, et à purger GLPI.
export const getSyncStatus = () => api.get('/sync/status').then((r) => r.data)
export const getSyncJournal = () => api.get('/sync/journal').then((r) => r.data)
export const purgeGlpi = () => api.post('/sync/purge').then((r) => r.data)
