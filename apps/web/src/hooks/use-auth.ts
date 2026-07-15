'use client'

import * as React from 'react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
import { fetchApi } from '@/lib/api'

export interface UseAuthReturn {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser, refreshToken?: string) => void
  logout: () => void
  refreshToken: () => Promise<boolean>
}

/** 认证 Hook,集成 useAuthStore,登录后自动启动 token 续期 */
export function useAuth(): UseAuthReturn {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const storeLogout = useAuthStore((s) => s.logout)

  const login = React.useCallback(
    (newToken: string, newUser: AuthUser, newRefreshToken?: string) => {
      setToken(newToken, newRefreshToken ?? null)
      setUser(newUser)
      if (newRefreshToken) startAutoRefresh()
    },
    [setToken, setUser],
  )

  const logout = React.useCallback(() => {
    stopAutoRefresh()
    storeLogout()
  }, [storeLogout])

  const refreshToken = React.useCallback(async (): Promise<boolean> => {
    if (!token) return false
    const res = await fetchApi<{ token: string; refreshToken?: string }>('/api/auth/refresh', {
      method: 'POST',
    })
    if (res.success) {
      setToken(res.data.token, res.data.refreshToken ?? null)
      return true
    }
    return false
  }, [token, setToken])

  return { user, token, isAuthenticated, login, logout, refreshToken }
}
