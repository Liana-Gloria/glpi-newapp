import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Frontoffice
import Items from './pages/frontoffice/Items'
import CreateTicket from './pages/frontoffice/CreateTicket'
import Kanban from './pages/frontoffice/Kanban'

// Backoffice
import Login from './pages/backoffice/Login'
import Dashboard from './pages/backoffice/Dashboard'
import Import from './pages/backoffice/Import'
import Reset from './pages/backoffice/Reset'
import Tickets from './pages/backoffice/Tickets'
import KanbanSettings from './pages/backoffice/KanbanSettings'
import Sync from './pages/backoffice/Sync'

export default function App() {
  return (
    <Routes>
      {/* Login hors layout protégé */}
      <Route path="/backoffice/login" element={<Login />} />

      <Route element={<Layout />}>
        {/* Frontoffice (public) */}
        <Route path="/" element={<Items />} />
        <Route path="/creer-ticket" element={<CreateTicket />} />
        <Route path="/kanban" element={<Kanban />} />

        {/* Backoffice (protégé) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/backoffice/dashboard" element={<Dashboard />} />
          <Route path="/backoffice/import" element={<Import />} />
          <Route path="/backoffice/reset" element={<Reset />} />
          <Route path="/backoffice/tickets" element={<Tickets />} />
          <Route path="/backoffice/settings" element={<KanbanSettings />} />
          <Route path="/backoffice/sync" element={<Sync />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
