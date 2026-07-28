// 2026-07-26 修复 Taro 4.2.0 Vite 打包 bug:
// Taro Vite runner 将 `import { create } from 'zustand'` 错误归并为
// `taro.react_production_min.create`(React 上无此函数),导致运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 规避方案:绕开 zustand/react 的 create,直接用 zustand/vanilla 的 createStore
// 创建 store 实例 + React 18 的 useSyncExternalStore 手动实现订阅 hook,
// 保持与原 useUserStore API 完全兼容(支持 hook 调用 + getState/setState/subscribe)。
// 2026-07-28:useSyncExternalStore + Object.assign 模式已抽取到
// `./helpers/create-taro-zustand-hook`,与 vip.ts/invite.ts 共用。
import { createStore } from 'zustand/vanilla'
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
import { miniAppLogin, type MiniAppLoginResult } from '../utils/miniapp-login'
import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'

interface UserState {
  token: string
  refreshToken: string
  user: UserInfo | null
  setAuth: (token: string, user: UserInfo, refreshToken?: string) => void
  logout: () => void
  fetchProfile: () => Promise<void>
  /** 真实微信登录流程(wx.login → 后端换 unionid → 持久化) */
  loginByWechat: (options?: {
    withProfile?: boolean
    inviteCode?: string
  }) => Promise<WechatLoginResult>
  /** 静默尝试微信登录(用于 App.onLaunch 启动时,如已有 token 则跳过) */
  trySilentWechatLogin: () => Promise<WechatLoginResult | null>
  /** 跨端小程序登录(自动适配微信/支付宝,推荐使用) */
  loginByMiniApp: (options?: {
    withProfile?: boolean
    inviteCode?: string
  }) => Promise<MiniAppLoginResult>
  /** 静默尝试跨端小程序登录(启动时自动适配微信/支付宝环境) */
  trySilentMiniAppLogin: () => Promise<MiniAppLoginResult | null>
}

// 创建 store 实例(纯逻辑,不依赖 React,可被 Vite 正确打包)
const userStoreApi = createStore<UserState>((set) => ({
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
  loginByMiniApp: async (options) => {
    const result = await miniAppLogin(options ?? {})
    set({ token: getToken(), user: getUserInfo(), refreshToken: getRefreshToken() })
    return result
  },
  trySilentMiniAppLogin: async () => {
    // 已登录则不重复登录(避免无谓的网络请求)
    if (getToken()) return null
    try {
      const result = await miniAppLogin({ withProfile: false })
      set({ token: getToken(), user: getUserInfo(), refreshToken: getRefreshToken() })
      return result
    } catch {
      // 静默失败不抛错,用户后续可手动登录
      return null
    }
  },
}))

// 兼容原 useUserStore 的 API:既能作为 hook 调用(useUserStore((s) => s.user)),
// 又能访问 .getState()/.setState()/.subscribe() 方法
export const useUserStore = createTaroZustandHook(userStoreApi)
