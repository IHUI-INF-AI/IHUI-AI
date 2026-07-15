import { create } from 'zustand'
import { setAuthCookie } from '@/lib/cookie-utils'

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000
let refreshTimer: ReturnType<typeof setTimeout> | null = null

interface AuthTokenState {
  token: string | null
  expiresAt: number | null
  setToken: (token: string | null, expiresAt?: number) => void
  clear: () => void
  isExpired: () => boolean
}

function scheduleRefresh(expiresAt: number | null) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  if (!expiresAt) return
  const delay = expiresAt - REFRESH_THRESHOLD_MS - Date.now()
  if (delay <= 0) return
  refreshTimer = setTimeout(() => {
    void fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const data = body?.data
        if (data?.accessToken && data?.expiresAt) {
          useAuthTokenStore.getState().setToken(data.accessToken, data.expiresAt)
        }
      })
      .catch(() => {})
  }, delay)
}

export const useAuthTokenStore = create<AuthTokenState>((set, get) => ({
  token: null,
  expiresAt: null,

  setToken: (token, expiresAt) => {
    setAuthCookie(token)
    set({ token, expiresAt: expiresAt ?? null })
    scheduleRefresh(expiresAt ?? null)
  },

  clear: () => {
    setAuthCookie(null)
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    set({ token: null, expiresAt: null })
  },

  isExpired: () => {
    const { token, expiresAt } = get()
    if (!token) return true
    if (!expiresAt) return false
    return Date.now() >= expiresAt
  },
}))
