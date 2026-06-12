import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCoutsParItem } from '../../api/tickets'

const eur = (n) =>
  Number(n || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  })

// Regroupe les items par catégorie (type) et calcule les totaux par catégorie.
function groupByCategory(items) {
  const byCat = new Map()
  for (const it of items) {
    const cat = it.item_type || 'Sans catégorie'
    let group = byCat.get(cat)
    if (!group) {
      group = { category: cat, cout_glpi: 0, cout_kanban: 0, cout_total: 0, items: [] }
      byCat.set(cat, group)
    }
    group.cout_glpi += it.cout_glpi
    group.cout_kanban += it.cout_kanban
    group.cout_total += it.cout_total
    group.items.push(it)
  }
  return Array.from(byCat.values()).sort((a, b) => b.cout_total - a.cout_total)
}

export default function CoutsParItem() {
  const [search, setSearch] = useState('')
  const [openCat, setOpenCat] = useState(null)

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['couts-par-item'],
    queryFn: fetchCoutsParItem,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.item_name?.toLowerCase().includes(q) ||
        it.item_type?.toLowerCase().includes(q)
    )
  }, [items, search])

  const groups = useMemo(() => groupByCategory(filtered), [filtered])

  const totalGlpi = useMemo(() => items.reduce((s, it) => s + it.cout_glpi, 0), [items])
  const totalKanban = useMemo(() => items.reduce((s, it) => s + it.cout_kanban, 0), [items])

  if (isLoading) return <p className="text-gray-500">Chargement…</p>
  if (isError) return <p className="text-red-600">Erreur de chargement.</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Coût total par item</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Items concernés</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Coût GLPI (importé)</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{eur(totalGlpi)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Coût Kanban (saisi)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{eur(totalKanban)}</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Rechercher par nom ou type d'item…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Coût GLPI</th>
              <th className="px-4 py-3 text-right">Coût Kanban</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  {items.length === 0
                    ? 'Aucun item lié à un ticket'
                    : 'Aucun item ne correspond à la recherche.'}
                </td>
              </tr>
            ) : (
              groups.map((g) => {
                const open = openCat === g.category
                return (
                  <FragmentRows
                    key={g.category}
                    group={g}
                    open={open}
                    onToggle={() =>
                      setOpenCat((cur) => (cur === g.category ? null : g.category))
                    }
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Ligne catégorie (cliquable) + lignes items dépliées.
function FragmentRows({ group, open, onToggle }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer bg-white hover:bg-indigo-50">
        <td className="px-4 py-3 font-semibold text-gray-900">
          <span className="mr-2 inline-block w-3 text-gray-400">{open ? '▾' : '▸'}</span>
          {group.category}
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            {group.items.length}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-indigo-700">
          {eur(group.cout_glpi)}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-emerald-700">
          {eur(group.cout_kanban)}
        </td>
        <td className="px-4 py-3 text-right font-bold text-gray-900">
          {eur(group.cout_total)}
        </td>
      </tr>
      {open &&
        group.items.flatMap((it) =>
          // Un même item est séparé par ticket : une ligne par ticket contributeur.
          (it.tickets.length ? it.tickets : [null]).map((t) => (
            <tr key={`${it.item_id}-${t ? t.ticket_id : 'none'}`} className="bg-gray-50">
              <td className="py-2 pl-12 pr-4">
                <span className="text-gray-800">{it.item_name}</span>
                {t ? (
                  <span className="ml-2 text-xs text-gray-400">
                    #{t.ticket_id} · {t.ticket_title}
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-gray-300">aucun ticket</span>
                )}
              </td>
              <td className="px-4 py-2 text-right text-gray-600">
                {eur(t ? t.part_glpi : 0)}
              </td>
              <td className="px-4 py-2 text-right text-gray-600">
                {eur(t ? t.part_kanban : 0)}
              </td>
              <td className="px-4 py-2 text-right font-medium text-gray-800">
                {eur(t ? t.part_glpi + t.part_kanban : 0)}
              </td>
            </tr>
          ))
        )}
    </>
  )
}
