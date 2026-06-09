import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchItems, fetchItemTypes } from '../../api/items'

export default function Items() {
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')

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
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
              {item.serial && (
                <p className="mt-1 truncate text-xs text-gray-400">SN: {item.serial}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
