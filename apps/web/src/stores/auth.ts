import { create } from 'zustand'
import { setAuthCookie } from '@/lib/cookie-utils'

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

export const useAuthStore = create<AuthState>((set) => ({
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
}))
