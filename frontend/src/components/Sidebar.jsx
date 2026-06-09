import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const frontLinks = [
  { to: '/', label: 'Parc (Items)', end: true },
  { to: '/creer-ticket', label: 'Créer un ticket' },
  { to: '/kanban', label: 'Kanban' },
]

const backLinks = [
  { to: '/backoffice/dashboard', label: 'Tableau de bord' },
  { to: '/backoffice/import', label: 'Import' },
  { to: '/backoffice/tickets', label: 'Tickets' },
  { to: '/backoffice/settings', label: 'Paramètres Kanban' },
  { to: '/backoffice/reset', label: 'Réinitialiser' },
]

function linkClass({ isActive }) {
  return [
    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100',
  ].join(' ')
}

export default function Sidebar() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/backoffice/login')
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white p-4">
      <div className="mb-6 px-2 text-lg font-bold text-indigo-700">GLPI App</div>

      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Espace utilisateur
      </div>
      <nav className="flex flex-col gap-1">
        {frontLinks.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Back-office
      </div>
      {isAuthenticated ? (
        <nav className="flex flex-col gap-1">
          {backLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="mt-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Déconnexion
          </button>
        </nav>
      ) : (
        <NavLink to="/backoffice/login" className={linkClass}>
          Connexion admin
        </NavLink>
      )}
    </aside>
  )
}
