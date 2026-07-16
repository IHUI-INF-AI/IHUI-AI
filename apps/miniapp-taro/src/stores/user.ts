import { create } from 'zustand'
import {
  getToken,
  setToken as persistToken,
  getRefreshToken,
  setRefreshToken as persistRefreshToken,
  getUserInfo,
  setUserInfo as persistUserInfo,
  clearAuth,
} from '../utils/auth'
import type { UserInfo } from '../utils/auth'
import * as api from '../api'

interface UserState {
  token: string
  refreshToken: string
  user: UserInfo | null
  setAuth: (token: string, user: UserInfo, refreshToken?: string) => void
  logout: () => void
  fetchProfile: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  token: getToken(),
  refreshToken: getRefreshToken(),
  user: getUserInfo(),
  setAuth: (token, user, refreshToken) => {
    persistToken(token)
    if (refreshToken) persistRefreshToken(refreshToken)
    persistUserInfo(user)
    set({ token, user, refreshToken: refreshToken ?? getRefreshToken() })
  },
  logout: () => {
    clearAuth()
    set({ token: '', refreshToken: '', user: null })
  },
  fetchProfile: async () => {
    try {
      const user = await api.getProfile()
      persistUserInfo(user)
      set({ user })
    } catch {
      /* ignore */
    }
  },
}))
