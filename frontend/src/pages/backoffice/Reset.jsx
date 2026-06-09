import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resetAll } from '../../api/items'

export default function Reset() {
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  async function handleReset() {
    setBusy(true)
    setError('')
    try {
      await resetAll()
      setDone(true)
      setConfirming(false)
      queryClient.invalidateQueries()
    } catch (err) {
      setError(err.response?.data?.error || 'Réinitialisation échouée.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Réinitialiser la base</h1>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="mb-4 text-sm text-red-800">
          Cette action supprime <strong>tous les items, tickets et associations</strong>.
          Elle est irréversible.
        </p>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        {done && (
          <p className="mb-3 rounded bg-emerald-100 p-2 text-sm text-emerald-800">
            Base réinitialisée avec succès.
          </p>
        )}

        {!confirming ? (
          <button
            onClick={() => { setConfirming(true); setDone(false) }}
            className="rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700"
          >
            Réinitialiser…
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-red-800">Êtes-vous sûr ?</span>
            <button
              onClick={handleReset}
              disabled={busy}
              className="rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? 'Suppression…' : 'Oui, tout supprimer'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
