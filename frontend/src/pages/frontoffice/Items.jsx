import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchItems, fetchItemTypes } from '../../api/items'

// Modale de détail d'un item (clic sur une carte du parc).
function ItemModal({ item, onClose }) {
  const rows = [
    ['Name', item.name],
    ['Status', item.status],
    ['Location', item.location],
    ['Manufacturer', item.manufacturer],
    ['Item_Type', item.type],
    ['Model', item.model],
    ['Inventory_Number', item.inventory_number],
    ['User', item.assigned_user],
  ]
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {item.image_path && (
          <div className="mb-4 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            <img
              src={`http://localhost:3001${item.image_path}`}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <dl className="divide-y divide-gray-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2 text-sm">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-right font-medium text-gray-900">
                {value || <span className="text-gray-300">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export default function Items() {
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const { data: types = [] } = useQuery({
    queryKey: ['item-types'],
    queryFn: fetchItemTypes,
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', { type, search }],
    queryFn: () => fetchItems({ type, search }),
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Parc informatique</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher (nom, série, type)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400">Aucun item trouvé.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelected(item)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                {item.image_path ? (
                  <img
                    src={`http://localhost:3001${item.image_path}`}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">Pas d’image</span>
                )}
              </div>
              <h3 className="truncate font-medium text-gray-900" title={item.name}>
                {item.name}
              </h3>
              <p className="text-xs text-gray-500">{item.type || 'Type inconnu'}</p>
              {item.status && (
                <span className="mt-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {item.status}
                </span>
              )}
              {item.serial && (
                <p className="mt-1 truncate text-xs text-gray-400">SN: {item.serial}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && <ItemModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
