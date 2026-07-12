import { create } from 'zustand'
import { setAuthCookie } from '@/lib/cookie-utils'

interface AuthTokenState {
  token: string | null
  expiresAt: number | null
  setToken: (token: string | null, expiresAt?: number) => void
  clear: () => void
  isExpired: () => boolean
}

export const useAuthTokenStore = create<AuthTokenState>((set, get) => ({
  token: null,
  expiresAt: null,

  setToken: (token, expiresAt) => {
    setAuthCookie(token)
    set({ token, expiresAt: expiresAt ?? null })
  },

  clear: () => {
    setAuthCookie(null)
    set({ token: null, expiresAt: null })
  },

  isExpired: () => {
    const { token, expiresAt } = get()
    if (!token) return true
    if (!expiresAt) return false
    return Date.now() >= expiresAt
  },
}))
