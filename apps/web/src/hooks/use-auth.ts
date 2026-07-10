'use client'

import * as React from 'react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { fetchApi } from '@/lib/api'

export interface UseAuthReturn {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
  refreshToken: () => Promise<boolean>
}

/** 认证 Hook，集成 useAuthStore */
export function useAuth(): UseAuthReturn {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const storeLogout = useAuthStore((s) => s.logout)

  const login = React.useCallback(
    (newToken: string, newUser: AuthUser) => {
      setToken(newToken)
      setUser(newUser)
    },
    [setToken, setUser],
  )

  const logout = React.useCallback(() => {
    storeLogout()
  }, [storeLogout])

  const refreshToken = React.useCallback(async (): Promise<boolean> => {
    if (!token) return false
    const res = await fetchApi<{ token: string }>('/api/auth/refresh', {
      method: 'POST',
    })
    if (res.success) {
      setToken(res.data.token)
      return true
    }
    return false
  }, [token, setToken])

  return { user, token, isAuthenticated, login, logout, refreshToken }
}
