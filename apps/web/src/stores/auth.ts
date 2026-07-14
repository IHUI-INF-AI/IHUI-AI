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

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  user: AuthUser | null
  setToken: (token: string | null) => void
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      user: null,
      setToken: (token) => {
        setAuthCookie(token)
        set({ token, isAuthenticated: !!token })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        setAuthCookie(null)
        set({ token: null, isAuthenticated: false, user: null })
      },
    }),
    createPersistConfig<AuthState>('ihui-auth', (s) => ({
      token: s.token,
      isAuthenticated: s.isAuthenticated,
      user: s.user,
    })),
  ),
)
