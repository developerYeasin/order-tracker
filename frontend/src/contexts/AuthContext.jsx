import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'
import axios from 'axios'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      verifyToken(token)
    } else {
      setIsLoading(false)
    }
  }, [])

  const verifyToken = async (token) => {
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      const response = await authApi.verify()
      setUser({
        id: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.name,
        is_admin: response.data.user.is_admin,
        token: token
      })
    } catch (error) {
      localStorage.removeItem('auth_token')
      delete axios.defaults.headers.common['Authorization']
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await authApi.login(email, password)
      const { token, user: userData } = response.data
      localStorage.setItem('auth_token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        is_admin: userData.is_admin,
        token: token
      })
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('auth_token')
      delete axios.defaults.headers.common['Authorization']
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.is_admin || false
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
