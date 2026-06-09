import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSyncStatus, pushToGlpi, pullFromGlpi } from '../../api/sync'

function Banner({ kind, children }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-800',
    error: 'bg-red-50 text-red-700',
    info: 'bg-indigo-50 text-indigo-800',
  }
  return <div className={`rounded-lg p-4 text-sm ${styles[kind]}`}>{children}</div>
}

export default function Sync() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const status = useQuery({ queryKey: ['sync-status'], queryFn: getSyncStatus, retry: false })

  async function run(action, fn) {
    setBusy(action)
    setError('')
    setResult(null)
    try {
      const data = await fn()
      setResult({ action, data })
      // Refresh anything that may have changed.
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      status.refetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Opération échouée.')
    } finally {
      setBusy('')
    }
  }

  const connected = status.data?.connected
  const glpi = status.data

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Synchronisation GLPI</h1>
      <p className="mb-6 text-sm text-gray-500">
        Pousser les items et tickets de NewApp vers GLPI, puis récupérer les
        changements de statut effectués dans GLPI.
      </p>

      {/* Connection state */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Connexion</h2>
          <button
            onClick={() => status.refetch()}
            className="text-sm text-indigo-600 hover:underline"
          >
            Tester à nouveau
          </button>
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

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => run('push', pushToGlpi)}
          disabled={!connected || !!busy}
          className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy === 'push' ? 'Envoi vers GLPI…' : 'Pousser vers GLPI →'}
        </button>
        <button
          onClick={() => run('pull', pullFromGlpi)}
          disabled={!connected || !!busy}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy === 'pull' ? 'Récupération…' : '← Tirer depuis GLPI'}
        </button>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {result && (
        <div className="mt-4">
          <Banner kind="info">
            {result.action === 'push' ? (
              <span>
                <strong>{result.data.itemsPushed}</strong> item(s) et{' '}
                <strong>{result.data.ticketsPushed}</strong> ticket(s) créés dans GLPI.
              </span>
            ) : (
              <span>
                <strong>{result.data.itemsUpdated}</strong> item(s) et{' '}
                <strong>{result.data.ticketsUpdated}</strong> ticket(s) mis à jour depuis GLPI.
                {(result.data.itemsMissing > 0 || result.data.ticketsMissing > 0) && (
                  <> {result.data.itemsMissing + result.data.ticketsMissing} élément(s) supprimé(s) côté GLPI (lien retiré).</>
                )}
              </span>
            )}
            {result.data.errors?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-amber-700">
                {result.data.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </Banner>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  )
}
