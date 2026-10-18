// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-07-26 修复 Taro 4.2.0 Vite 打包 bug:
// Taro Vite runner 将 `import { create } from 'zustand'` 错误归并为
// `taro.react_production_min.create`(React 上无此函数),导致运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 规避方案:绕开 zustand/react 的 create,直接用 zustand/vanilla 的 createStore
// 创建 store 实例 + createTaroZustandHook 手动实现订阅 hook,
// 保持与原 useUserStore API 完全兼容(支持 hook 调用 + getState/setState/subscribe)。
// 2026-07-28 P0-1: 复用 stores/helpers/create-taro-zustand-hook.ts,消除三处重复实现。
import { createStore } from 'zustand/vanilla'
import {
  getToken,
  setToken as persistToken,
  getRefreshToken,
  setRefreshToken as persistRefreshToken,
  getUserInfo,
  setUserInfo as persistUserInfo,
  clearAuth,
  isSessionLoggedOut,
} from '../utils/auth'
import { canSilentlyReLogin } from '@ihui/shared/auth/auto-login-policy'
import type { UserInfo } from '../utils/auth'
import * as api from '../api'
import { wechatLogin, type WechatLoginResult } from '../utils/wechat-login'
import { miniAppLogin, type MiniAppLoginResult } from '../utils/miniapp-login'
import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'

interface UserState {
  token: string
  refreshToken: string
  user: UserInfo | null
  /**
   * 冷启动鉴权就绪位(G-933「冷启动抢跑全仓盘点」小程序腿)。
   *
   * 语义只有一条:**本端这一次冷启动的鉴权判定已经落定**(不再区分成功还是失败)。
   * 三条路径**都必须**把它置为 true ——
   *   ① 静默登录成功;② 静默登录失败(含 catch);
   *   ③ 压根没进静默登录:非小程序环境 / 已有票 / 登出标记闸拦下,即"无票可换"的短路。
   * 漏掉任何一条,后续页面拿到的就绪位就永远不亮,页面会一直卡在"等就绪"——
   * 那比现在这个"读到 isLoggedIn()===false 就抢发鉴权请求"的抢跑更糟。
   * 所以这一位是**门控用的基座**,不是登录态的第二份真相:登录与否仍然只看 token
   * (`isLoggedIn()`),就绪位只回答"这一次判定做完了没有"。
   * 与 @ihui/shared/stores createAuthStore 的 `ready` 不同源也不同义(那位是 persist 水合完成,
   * 本端 store 走 zustand/vanilla + Taro.storage,根本没有水合这一步)。
   */
  authReady: boolean
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
  /**
   * 置起 `authReady`(幂等:已为 true 时不再 set,免得给订阅者发空轮)。
   * 生产调用点全端只有 app.tsx 冷启动链末尾那一处 —— 本 store 不自己点亮,
   * 因为"落定"这件事由那条链判,不由取票动作判(取票动作有三条短路根本不会被调到)。
   */
  markAuthReady: () => void
}

// 创建 store 实例(纯逻辑,不依赖 React,可被 Vite 正确打包)
const userStoreApi = createStore<UserState>((set, get) => ({
  token: getToken(),
  refreshToken: getRefreshToken(),
  user: getUserInfo(),
  // 冷启动时这一位必然是 false:模块加载即定形的三件套(token/user)不等于判定已落定。
  authReady: false,
  markAuthReady: () => {
    if (get().authReady) return
    set({ authReady: true })
  },
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
    // 静默登录的准入闸(与 app.tsx 冷启动那一条同一个判据,不是两份实现):
    // 用户主动登出后不得自己登回去。显式点击的 loginByWechat / loginByMiniApp 不经这一闸。
    if (!canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })) return null
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
    // 同 trySilentWechatLogin:静默路径一律过登出标记闸(同一个共享判据,不是第二份实现)
    if (!canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })) return null
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
const useUserStore = createTaroZustandHook(userStoreApi)

export { useUserStore }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
