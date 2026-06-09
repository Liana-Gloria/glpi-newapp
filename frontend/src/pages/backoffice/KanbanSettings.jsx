import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSettings, saveSettings } from '../../api/settings'
import {
  STATUSES,
  DEFAULT_LABELS,
  DEFAULT_COLORS,
  parseSetting,
} from '../../kanbanConfig'

export default function KanbanSettings() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const [labels, setLabels] = useState(DEFAULT_LABELS)
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      setLabels(parseSetting(settings.kanban_labels, DEFAULT_LABELS))
      setColors(parseSetting(settings.kanban_colors, DEFAULT_COLORS))
    }
  }, [settings])

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    try {
      await saveSettings({ kanban_labels: labels, kanban_colors: colors })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <p className="text-gray-500">Chargement…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Paramètres du Kanban</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {STATUSES.map((status) => (
          <div
            key={status}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4"
          >
            <input
              type="color"
              value={colors[status]}
              onChange={(e) => setColors((c) => ({ ...c, [status]: e.target.value }))}
              className="h-10 w-12 cursor-pointer rounded border border-gray-300"
            />
            <div className="flex-1">
              <label className="mb-1 block text-xs uppercase text-gray-400">
                Colonne « {status} » — label malgache
              </label>
              <input
                type="text"
                value={labels[status]}
                onChange={(e) => setLabels((l) => ({ ...l, [status]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        ))}

        {saved && (
          <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">
            Paramètres enregistrés.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
