import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../lib/axios'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  const refreshAuth = useCallback(async () => {
    try {
      const response = await api.get('/auth/me', { skipAuthRedirect: true })
      setUser(response.data.user)
      return response.data.user
    } catch (error) {
      setUser(null)
      return null
    } finally {
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    refreshAuth()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        authChecked,
        refreshAuth,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
