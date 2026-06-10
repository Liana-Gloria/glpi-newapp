import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const DEFAULT_CODE = 'ADMIN-2026'

export default function Login() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(code)
      navigate('/backoffice/dashboard')
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Code administrateur invalide')
      } else {
        setError('Serveur injoignable : vérifiez que le backend est démarré (port 3001).')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow"
      >
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Back-office</h1>
        <p className="mb-6 text-sm text-gray-500">
          Entrez le code administrateur pour continuer.
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Code admin
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
          autoFocus
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
