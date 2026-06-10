import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resetAll } from '../../api/items'
import { getSyncStatus } from '../../api/sync'

const LABELS = {
  items: 'Items',
  tickets: 'Tickets',
  ticket_items: 'Associations ticket–item',
  ticket_costs: 'Coûts / temps',
}

export default function Reset() {
  const [confirming, setConfirming] = useState(false)
  const [report, setReport] = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncGlpi, setSyncGlpi] = useState(true)
  const queryClient = useQueryClient()

  async function handleReset() {
    setBusy(true)
    setError('')
    setReport(null)
    setSyncStatus(null)
    try {
      const data = await resetAll({ syncGlpi })
      setReport(data)
      setConfirming(false)
      queryClient.invalidateQueries()

      // Vérification de la synchro « en temps réel » : on relit l'état GLPI + local.
      try {
        const status = await getSyncStatus()
        setSyncStatus(status)
        queryClient.setQueryData(['sync-status'], status)
      } catch {
        setSyncStatus({ connected: false })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Réinitialisation échouée.')
    } finally {
      setBusy(false)
    }
  }

  const totalDeleted = report
    ? Object.values(report.deleted).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Réinitialiser la base</h1>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="mb-4 text-sm text-red-800">
          Cette action supprime <strong>tous les items, tickets, associations et coûts</strong>.
          Elle est irréversible.
        </p>

        <label className="mb-4 flex items-start gap-2 text-sm text-red-800">
          <input
            type="checkbox"
            checked={syncGlpi}
            onChange={(e) => setSyncGlpi(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Supprimer aussi dans <strong>GLPI</strong> les éléments déjà synchronisés
            (suppression définitive côté GLPI, en temps réel).
          </span>
        </label>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

        {!confirming ? (
          <button
            onClick={() => { setConfirming(true); setReport(null) }}
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

      {/* Journal des données effacées */}
      {report && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              Données effacées ({totalDeleted})
            </h2>
            <ul className="divide-y divide-gray-100 text-sm">
              {Object.entries(report.deleted).map(([key, n]) => (
                <li key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-600">{LABELS[key] || key}</span>
                  <span className={`font-semibold ${n > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {n} supprimé{n > 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Résumé de la suppression GLPI */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Synchronisation GLPI</h2>
            {!report.glpi.attempted ? (
              <p className="text-sm text-gray-500">
                {syncGlpi
                  ? 'Aucun élément n’était synchronisé avec GLPI : rien à supprimer côté GLPI.'
                  : 'Suppression GLPI désactivée — les éléments poussés restent dans GLPI.'}
              </p>
            ) : (
              <div className="text-sm">
                <p className="text-gray-700">
                  <strong className="text-emerald-700">{report.glpi.itemsDeleted}</strong>/
                  {report.glpi.itemsTargeted} item(s) et{' '}
                  <strong className="text-emerald-700">{report.glpi.ticketsDeleted}</strong>/
                  {report.glpi.ticketsTargeted} ticket(s) supprimés dans GLPI.
                </p>
                {report.glpi.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-amber-700">
                    {report.glpi.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* État de synchro relu en temps réel après le reset */}
            {syncStatus && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  État après reset
                </p>
                {syncStatus.connected ? (
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Stat label="Items locaux" value={syncStatus.local?.items ?? 0} />
                    <Stat label="Items synchro" value={syncStatus.local?.itemsSynced ?? 0} />
                    <Stat label="Tickets locaux" value={syncStatus.local?.tickets ?? 0} />
                    <Stat label="Tickets synchro" value={syncStatus.local?.ticketsSynced ?? 0} />
                    <div className="col-span-2 sm:col-span-4 mt-1 text-xs text-gray-500">
                      GLPI :{' '}
                      {Object.entries(syncStatus.glpiCounts || {})
                        .map(([t, n]) => `${t}=${n}`)
                        .join(' · ')}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    GLPI injoignable — impossible de vérifier l’état distant.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  )
}
