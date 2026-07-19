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
import { wechatLogin, type WechatLoginResult } from '../utils/wechat-login'

interface UserState {
  token: string
  refreshToken: string
  user: UserInfo | null
  setAuth: (token: string, user: UserInfo, refreshToken?: string) => void
  logout: () => void
  fetchProfile: () => Promise<void>
  /** 真实微信登录流程(wx.login → 后端换 unionid → 持久化) */
  loginByWechat: (options?: { withProfile?: boolean; inviteCode?: string }) => Promise<WechatLoginResult>
  /** 静默尝试微信登录(用于 App.onLaunch 启动时,如已有 token 则跳过) */
  trySilentWechatLogin: () => Promise<WechatLoginResult | null>
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
  loginByWechat: async (options) => {
    const result = await wechatLogin(options ?? {})
    set({ token: getToken(), user: getUserInfo(), refreshToken: getRefreshToken() })
    return result
  },
  trySilentWechatLogin: async () => {
    // 已登录则不重复 wx.login(避免无谓的网络请求)
    if (getToken()) return null
    try {
      const result = await wechatLogin({ withProfile: false })
      set({ token: getToken(), user: getUserInfo(), refreshToken: getRefreshToken() })
      return result
    } catch {
      // 静默失败不抛错,用户后续可手动登录
      return null
    }
  },
}))
