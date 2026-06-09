import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTickets, fetchTicket } from '../../api/tickets'

function TicketModal({ id, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id),
    enabled: !!id,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !data ? (
          <p className="text-gray-500">Chargement…</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-xl font-bold text-gray-900">{data.title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="mb-1 text-xs text-gray-400">Ticket #{data.id} · {data.status}</p>
            <p className="mb-4 whitespace-pre-wrap text-sm text-gray-700">
              {data.description || 'Aucune description.'}
            </p>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Items associés</h3>
            {data.items?.length ? (
              <ul className="divide-y divide-gray-100">
                {data.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                    {it.image_path && (
                      <img
                        src={`http://localhost:3001${it.image_path}`}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <span className="text-gray-800">{it.name}</span>
                    <span className="text-xs text-gray-400">{it.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Aucun item.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Tickets() {
  const [selected, setSelected] = useState(null)
  const { data: tickets = [], isLoading, isError } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  })

  if (isLoading) return <p className="text-gray-500">Chargement…</p>
  if (isError) return <p className="text-red-600">Erreur de chargement.</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Tickets</h1>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Créé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Aucun ticket.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className="cursor-pointer hover:bg-indigo-50"
                >
                  <td className="px-4 py-3 text-gray-500">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && <TicketModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
