import { createContext, useContext, useState } from 'react'
import { ADMIN_CODE_KEY } from '../api/client'
import { verifyAdminCode } from '../api/settings'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [code, setCode] = useState(() => sessionStorage.getItem(ADMIN_CODE_KEY) || '')

  const isAuthenticated = !!code

  async function login(inputCode) {
    await verifyAdminCode(inputCode) // throws si invalide
    sessionStorage.setItem(ADMIN_CODE_KEY, inputCode)
    setCode(inputCode)
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_CODE_KEY)
    setCode('')
  }

  return (
    <AuthContext.Provider value={{ code, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
