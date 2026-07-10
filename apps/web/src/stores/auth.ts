import { create } from 'zustand'

export interface AuthUser {
  id: string
  nickname: string
  avatar?: string
  phone?: string
  roleId?: number
}

function setAuthCookie(token: string | null) {
  if (typeof document === 'undefined') return
  if (token) {
    document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`
  } else {
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax'
  }
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
