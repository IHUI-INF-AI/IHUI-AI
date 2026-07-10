import { create } from 'zustand'
import { getToken, setToken as persistToken, getUserInfo, setUserInfo as persistUserInfo, clearAuth } from '../utils/auth'
import type { UserInfo } from '../utils/auth'
import * as api from '../api'

interface UserState {
  token: string
  user: UserInfo | null
  setAuth: (token: string, user: UserInfo) => void
  logout: () => void
  fetchProfile: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  token: getToken(),
  user: getUserInfo(),
  setAuth: (token, user) => {
    persistToken(token)
    persistUserInfo(user)
    set({ token, user })
  },
  logout: () => {
    clearAuth()
    set({ token: '', user: null })
  },
  fetchProfile: async () => {
    try {
      const user = await api.getProfile()
      persistUserInfo(user)
      set({ user })
    } catch { /* ignore */ }
  }
}))
