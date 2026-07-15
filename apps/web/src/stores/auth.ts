import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAuthCookie } from '@/lib/cookie-utils'
import { createPersistConfig } from './persist-helpers'

export interface AuthUser {
  id: string
  nickname: string
  avatar?: string
  phone?: string
  roleId?: number
  role?: string
  permissions?: string[]
  roles?: string[]
}

export interface TokenPair {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresIn: number | null
  isAuthenticated: boolean
  user: AuthUser | null
  setToken: (token: string | null, refreshOrPair?: string | TokenPair | null) => void
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      expiresIn: null,
      isAuthenticated: false,
      user: null,
      setToken: (token, refreshOrPair) => {
        setAuthCookie(token)
        if (refreshOrPair === null || refreshOrPair === undefined) {
          set({ token, isAuthenticated: !!token, refreshToken: null, expiresIn: null })
          return
        }
        if (typeof refreshOrPair === 'string') {
          set({
            token,
            isAuthenticated: !!token,
            refreshToken: refreshOrPair || null,
            expiresIn: null,
          })
          return
        }
        set({
          token,
          isAuthenticated: !!token,
          refreshToken: refreshOrPair.refreshToken ?? null,
          expiresIn: refreshOrPair.expiresIn ?? null,
        })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        setAuthCookie(null)
        set({
          token: null,
          refreshToken: null,
          expiresIn: null,
          isAuthenticated: false,
          user: null,
        })
      },
    }),
    createPersistConfig<AuthState>('ihui-auth', (s) => ({
      token: s.token,
      refreshToken: s.refreshToken,
      expiresIn: s.expiresIn,
      isAuthenticated: s.isAuthenticated,
      user: s.user,
    })),
  ),
)
