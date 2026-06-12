import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTickets, fetchTicket, updateTicketStatus, createTicket } from '../../api/tickets'
import { fetchItems } from '../../api/items'
import { fetchSettings } from '../../api/settings'
import {
  STATUSES,
  DEFAULT_LABELS,
  DEFAULT_COLORS,
  parseSetting,
  normalizeStatus,
} from '../../kanbanConfig'

function Card({ ticket, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(ticket.id),
  })
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(ticket.id)}
      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-gray-900">{ticket.title}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-gray-400">#{ticket.id}</span>
        {ticket.priority && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {ticket.priority}
          </span>
        )}
      </div>
    </div>
  )
}

function Column({ status, label, color, tickets, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex w-full flex-col rounded-xl bg-gray-100">
      <div
        className="flex items-center justify-between rounded-t-xl px-4 py-3 text-white"
        style={{ backgroundColor: color }}
      >
        <span className="font-semibold">{label}</span>
        <span className="rounded-full bg-white/30 px-2.5 py-0.5 text-sm font-semibold">
          {tickets.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-1 flex-col gap-2 p-3 transition-colors ${
          isOver ? 'bg-gray-200' : ''
        }`}
      >
        {tickets.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-gray-400">Aucun ticket</p>
        ) : (
          tickets.map((t) => <Card key={t.id} ticket={t} onClick={onCardClick} />)
        )}
      </div>
    </div>
  )
}

function TicketModal({ id, labels, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id),
    enabled: !!id,
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !data ? (
          <p className="text-gray-500">Chargement…</p>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-xl font-bold text-gray-900">{data.title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-500">#{data.id}</span>
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">
                {labels[normalizeStatus(data.status)] || data.status}
              </span>
              {data.priority && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">{data.priority}</span>
              )}
              {data.ticket_type && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{data.ticket_type}</span>
              )}
              {data.ticket_date && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-500">{data.ticket_date}</span>
              )}
            </div>

            <h3 className="mb-1 text-sm font-semibold text-gray-800">Description</h3>
            <p className="mb-4 whitespace-pre-wrap text-sm text-gray-700">
              {data.description || 'Aucune description.'}
            </p>

            {data.resolution && (
              <>
                <h3 className="mb-1 text-sm font-semibold text-gray-800">Résolution</h3>
                <p className="mb-4 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  {data.resolution}
                </p>
              </>
            )}

            <h3 className="mb-2 text-sm font-semibold text-gray-800">
              Items associés ({data.items?.length || 0})
            </h3>
            {data.items?.length ? (
              <ul className="divide-y divide-gray-100">
                {data.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-2 text-sm text-gray-800">
                    {it.image_path && (
                      <img src={`http://localhost:3001${it.image_path}`} alt="" className="h-8 w-8 rounded object-cover" />
                    )}
                    <span className="font-medium">{it.name}</span>
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

// Boîte de dialogue affichée quand un changement de statut nécessite une saisie.
// Ici : passage en "Vita" (terminé) -> commentaire de résolution obligatoire.
function ResolutionDialog({ targetLabel, onConfirm, onCancel }) {
  const [text, setText] = useState('')
  const [cout, setCout] = useState('')

  const coutValid = cout !== '' && Number(cout) >= 0 && !Number.isNaN(Number(cout))
  const canConfirm = !!text.trim() && coutValid

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-bold text-gray-900">Clôturer le ticket</h2>
        <p className="mb-4 text-sm text-gray-500">
          Passage en « {targetLabel} » : décrivez la résolution apportée.
        </p>
        <textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Commentaire de résolution…"
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <label className="mb-1 block text-sm font-medium text-gray-700">Coût (€)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={cout}
          onChange={(e) => setCout(e.target.value)}
          placeholder="0.00"
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(text.trim(), Number(cout))}
            disabled={!canConfirm}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

// Modale de création de ticket (bouton « Ajouter 1 ticket »).
function CreateTicketModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: items = [] } = useQuery({
    queryKey: ['items', { search }],
    queryFn: () => fetchItems({ search }),
  })

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('Le titre est obligatoire.')
      return
    }
    setBusy(true)
    try {
      await createTicket({ title, description, item_ids: selected })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.error || 'Création échouée.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Nouveau ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Items concernés ({selected.length})
            </label>
            <input
              type="text"
              placeholder="Filtrer les items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <div className="max-h-48 overflow-auto rounded-lg border border-gray-200">
              {items.length === 0 ? (
                <p className="p-3 text-sm text-gray-400">Aucun item.</p>
              ) : (
                items.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className="text-xs text-gray-400">{item.type}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Création…' : 'Créer le ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Kanban() {
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [pendingMove, setPendingMove] = useState(null) // { ticketId, status }
  const queryClient = useQueryClient()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data: tickets = [] } = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets })
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  const labels = parseSetting(settings.kanban_labels, DEFAULT_LABELS)
  const colors = parseSetting(settings.kanban_colors, DEFAULT_COLORS)

  async function applyStatus(ticketId, newStatus, resolution, cout) {
    // Mise à jour optimiste
    queryClient.setQueryData(['tickets'], (old = []) =>
      old.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    )
    try {
      await updateTicketStatus(ticketId, newStatus, resolution, cout)
    } finally {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const ticketId = Number(active.id)
    const newStatus = over.id
    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || normalizeStatus(ticket.status) === newStatus) return

    // Transition nécessitant une saisie : clôture (-> done) = commentaire requis.
    if (newStatus === 'done') {
      setPendingMove({ ticketId, status: newStatus })
      return
    }
    applyStatus(ticketId, newStatus)
  }

  const total = tickets.length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Kanban des tickets <span className="text-base font-normal text-gray-400">({total})</span>
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Ajouter 1 ticket
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              label={labels[status] || status}
              color={colors[status] || '#6b7280'}
              tickets={tickets.filter((t) => normalizeStatus(t.status) === status)}
              onCardClick={setSelected}
            />
          ))}
        </div>
      </DndContext>

      {selected && <TicketModal id={selected} labels={labels} onClose={() => setSelected(null)} />}

      {creating && (
        <CreateTicketModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            queryClient.invalidateQueries({ queryKey: ['tickets'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}

      {pendingMove && (
        <ResolutionDialog
          targetLabel={labels[pendingMove.status] || pendingMove.status}
          onCancel={() => setPendingMove(null)}
          onConfirm={(resolution, cout) => {
            applyStatus(pendingMove.ticketId, pendingMove.status, resolution, cout)
            setPendingMove(null)
          }}
        />
      )}
    </div>
  )
}
