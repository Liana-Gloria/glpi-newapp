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
import { fetchTickets, fetchTicket, updateTicketStatus } from '../../api/tickets'
import { fetchSettings } from '../../api/settings'
import {
  STATUSES,
  DEFAULT_LABELS,
  DEFAULT_COLORS,
  parseSetting,
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
      <p className="mt-1 text-xs text-gray-400">#{ticket.id}</p>
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
        <span className="rounded-full bg-white/30 px-2 text-sm">{tickets.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-1 flex-col gap-2 p-3 transition-colors ${
          isOver ? 'bg-gray-200' : ''
        }`}
      >
        {tickets.map((t) => (
          <Card key={t.id} ticket={t} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

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
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-xl font-bold text-gray-900">{data.title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="mb-1 text-xs text-gray-400">#{data.id} · {data.status}</p>
            <p className="mb-4 whitespace-pre-wrap text-sm text-gray-700">
              {data.description || 'Aucune description.'}
            </p>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Items associés</h3>
            {data.items?.length ? (
              <ul className="divide-y divide-gray-100">
                {data.items.map((it) => (
                  <li key={it.id} className="py-2 text-sm text-gray-800">
                    {it.name} <span className="text-xs text-gray-400">{it.type}</span>
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

export default function Kanban() {
  const [selected, setSelected] = useState(null)
  const queryClient = useQueryClient()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  })
  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const labels = parseSetting(settings.kanban_labels, DEFAULT_LABELS)
  const colors = parseSetting(settings.kanban_colors, DEFAULT_COLORS)

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const ticketId = Number(active.id)
    const newStatus = over.id
    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    // Optimistic update
    queryClient.setQueryData(['tickets'], (old = []) =>
      old.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    )
    try {
      await updateTicketStatus(ticketId, newStatus)
    } finally {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Kanban des tickets</h1>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              label={labels[status] || status}
              color={colors[status] || '#6b7280'}
              tickets={tickets.filter((t) => t.status === status)}
              onCardClick={setSelected}
            />
          ))}
        </div>
      </DndContext>

      {selected && <TicketModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
