import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSyncStatus, getSyncJournal, purgeGlpi } from '../../api/sync'

function Banner({ kind, children }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-800',
    error: 'bg-red-50 text-red-700',
    info: 'bg-indigo-50 text-indigo-800',
  }
  return <div className={`rounded-lg p-4 text-sm ${styles[kind]}`}>{children}</div>
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

const ACTION_STYLE = {
  'create-item': 'bg-emerald-100 text-emerald-800',
  'create-ticket': 'bg-emerald-100 text-emerald-800',
  'update-item': 'bg-sky-100 text-sky-800',
  'update-ticket': 'bg-sky-100 text-sky-800',
  purge: 'bg-amber-100 text-amber-800',
}

function ActionBadge({ action, status }) {
  const style = status === 'error' ? 'bg-red-100 text-red-800' : ACTION_STYLE[action] || 'bg-gray-100 text-gray-700'
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${style}`}>{action}</span>
}

function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR')
  } catch {
    return iso
  }
}

export default function Sync() {
  const queryClient = useQueryClient()
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState(null)
  const [error, setError] = useState('')

  // L'état et le journal sont relus en continu => vérification « temps réel ».
  const status = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    retry: false,
    refetchInterval: 5000,
  })
  const journalQuery = useQuery({
    queryKey: ['sync-journal'],
    queryFn: getSyncJournal,
    retry: false,
    refetchInterval: 3000,
  })

  const connected = status.data?.connected
  const glpi = status.data
  const journal = journalQuery.data?.journal || []

  async function handlePurge() {
    setPurging(true)
    setError('')
    setPurgeResult(null)
    try {
      const data = await purgeGlpi()
      setPurgeResult(data)
      setConfirmPurge(false)
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['sync-journal'] })
      status.refetch()
      journalQuery.refetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Purge échouée.')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Synchronisation GLPI</h1>
      <p className="mb-6 text-sm text-gray-500">
        Synchronisation <strong>automatique en temps réel</strong> : chaque création ou
        modification d’item ou de ticket est poussée vers GLPI. Cette page est en lecture seule.
      </p>

      {/* État de connexion + compteurs */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Connexion</h2>
          <span className="text-xs text-gray-400">
            {status.isFetching ? 'Actualisation…' : 'Auto-actualisé'}
          </span>
        </div>

        {status.isLoading ? (
          <p className="text-sm text-gray-400">Test de connexion…</p>
        ) : connected ? (
          <Banner kind="success">
            Connecté à GLPI en tant que <strong>{glpi.glpiUser}</strong> — {glpi.apiUrl}
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-emerald-900 sm:grid-cols-3">
              {Object.entries(glpi.glpiCounts || {}).map(([type, n]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}</span>
                  <span className="font-semibold">{n}</span>
                </div>
              ))}
            </div>
          </Banner>
        ) : (
          <Banner kind="error">
            GLPI injoignable : {status.data?.error || status.error?.message || 'erreur inconnue'}
          </Banner>
        )}

        {glpi?.local && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Items" value={glpi.local.items} />
            <Stat label="Items synchronisés" value={glpi.local.itemsSynced} accent="text-indigo-600" />
            <Stat label="Tickets" value={glpi.local.tickets} />
            <Stat label="Tickets synchronisés" value={glpi.local.ticketsSynced} accent="text-indigo-600" />
          </div>
        )}
      </section>

      {/* Journal temps réel */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Journal de synchronisation</h2>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            temps réel
          </span>
        </div>

        {journal.length === 0 ? (
          <p className="text-sm text-gray-400">
            Aucun événement pour le moment. Importez des données ou modifiez un ticket pour
            déclencher une synchronisation.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-gray-500">
                  <th className="py-1.5 pr-3 font-semibold">Heure</th>
                  <th className="py-1.5 pr-3 font-semibold">Action</th>
                  <th className="py-1.5 pr-3 font-semibold">Élément</th>
                  <th className="py-1.5 pr-3 font-semibold">GLPI</th>
                  <th className="py-1.5 font-semibold">État</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 text-gray-500">{timeLabel(e.at)}</td>
                    <td className="py-1.5 pr-3"><ActionBadge action={e.action} status={e.status} /></td>
                    <td className="py-1.5 pr-3 text-gray-700">
                      {e.name || e.message || '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-500">{e.glpiId ? `#${e.glpiId}` : '—'}</td>
                    <td className="py-1.5">
                      {e.status === 'error' ? (
                        <span className="font-semibold text-red-600" title={e.message}>échec</span>
                      ) : (
                        <span className="text-emerald-600">ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Zone de danger : purge GLPI */}
      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="mb-2 text-lg font-semibold text-red-800">Purger la base GLPI</h2>
        <p className="mb-4 text-sm text-red-700">
          Supprime de GLPI <strong>tout ce que NewApp y a créé</strong> (éléments liés et
          orphelins marqués « {`[NewApp]`} »), puis réinitialise les liens locaux. Irréversible.
        </p>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        {purgeResult && (
          <Banner kind="info">
            GLPI purgé : <strong>{purgeResult.itemsDeleted}</strong> item(s) et{' '}
            <strong>{purgeResult.ticketsDeleted}</strong> ticket(s) supprimés.
            {purgeResult.errors?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-amber-700">
                {purgeResult.errors.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </Banner>
        )}

        {!confirmPurge ? (
          <button
            onClick={() => { setConfirmPurge(true); setPurgeResult(null) }}
            className="rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700"
          >
            Purger GLPI…
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-red-800">Confirmer la purge GLPI ?</span>
            <button
              onClick={handlePurge}
              disabled={purging}
              className="rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {purging ? 'Purge…' : 'Oui, purger'}
            </button>
            <button
              onClick={() => setConfirmPurge(false)}
              className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
