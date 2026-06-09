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

// GET /api/settings renvoie des valeurs brutes (string JSON) -> parse sûr.
export function parseSetting(raw, fallback) {
  if (raw == null) return fallback
  try {
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}
