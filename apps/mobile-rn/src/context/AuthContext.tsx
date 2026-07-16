import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loginByAccount, logout as apiLogout, type AuthUser } from '@ihui/api-client'
import {
  initApi,
  setToken,
  setRefreshToken,
  getToken,
  getRefreshToken,
  clearToken,
} from '../lib/token'

export type { AuthUser }

export interface LoginResult {
  success: boolean
  error?: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  ready: boolean
  login: (account: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initApi().then(() => {
      setTokenState(getToken())
      setReady(true)
    })
  }, [])

  const login = async (account: string, password: string): Promise<LoginResult> => {
    const res = await loginByAccount(account, password)
    if (res.success) {
      await setToken(res.data.accessToken)
      await setRefreshToken(res.data.refreshToken)
      setTokenState(res.data.accessToken)
      setUser(res.data.user)
      return { success: true }
    }
    return { success: false, error: res.error }
  }

  const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await apiLogout(refreshToken)
    }
    await clearToken()
    setTokenState(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
