// Statuts du Kanban (ordre des colonnes) + labels malgaches par défaut.
export const STATUSES = ['open', 'in_progress', 'done']

export const DEFAULT_LABELS = {
  open: 'Vaovao',          // nouveau
  in_progress: 'Efa manao', // en cours
  done: 'Vita',            // terminé
}

export const DEFAULT_COLORS = {
  open: '#6366f1',
  in_progress: '#f59e0b',
  done: '#10b981',
}

// Toute valeur de statut (CSV "New/Solved", label malgache, etc.) -> 1 des 3 clés.
// Filet de sécurité d'affichage : un ticket au statut inconnu tombe dans "open"
// pour rester visible dans le Kanban.
const STATUS_ALIASES = {
  open: 'open', new: 'open', nouveau: 'open', vaovao: 'open',
  in_progress: 'in_progress', assigned: 'in_progress', planned: 'in_progress',
  waiting: 'in_progress', 'en cours': 'in_progress', encours: 'in_progress',
  'efa manao': 'in_progress', processing: 'in_progress',
  done: 'done', solved: 'done', closed: 'done', resolved: 'done',
  termine: 'done', 'terminé': 'done', vita: 'done', clos: 'done', resolu: 'done', 'résolu': 'done',
}

export function normalizeStatus(raw) {
  if (!raw) return 'open'
  const key = String(raw).trim().toLowerCase()
  if (STATUSES.includes(key)) return key
  return STATUS_ALIASES[key] || 'open'
}

// GET /api/settings renvoie des valeurs brutes (string JSON) -> parse sûr.
export function parseSetting(raw, fallback) {
  if (raw == null) return fallback
  try {
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}
