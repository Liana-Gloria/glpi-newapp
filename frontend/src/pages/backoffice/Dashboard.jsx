import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../../api/items'

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent || 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  })

  if (isLoading) return <p className="text-gray-500">Chargement…</p>
  if (isError) return <p className="text-red-600">Erreur de chargement.</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Tableau de bord</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Items au total" value={data.totalItems} accent="text-indigo-600" />
        <StatCard label="Tickets au total" value={data.totalTickets} accent="text-emerald-600" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Items par type</h2>
          {data.itemsByType.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun item.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.itemsByType.map((row) => (
                <li key={row.type} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-700">{row.type}</span>
                  <span className="font-semibold text-gray-900">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Tickets par statut</h2>
          {data.ticketsByStatus.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun ticket.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.ticketsByStatus.map((row) => (
                <li key={row.status} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-700">{row.status}</span>
                  <span className="font-semibold text-gray-900">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
