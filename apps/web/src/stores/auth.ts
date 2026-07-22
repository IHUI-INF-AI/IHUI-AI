import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logout as apiLogout, type AuthUser as ApiAuthUser } from '@ihui/api-client'
import {
  setAuthCookie,
  setRefreshTokenCookie,
  getRefreshTokenCookie,
  clearRefreshTokenCookie,
  REMEMBER_MAX_AGE,
} from '@/lib/cookie-utils'
import { createPersistConfig } from './persist-helpers'

/** 与共享层 @ihui/api-client AuthUser 完全一致,确保 5 端用户类型统一 */
export type AuthUser = ApiAuthUser

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
  /** 带 autoLogin 偏好的 setToken:autoLogin=true 时 refreshToken cookie max-age=30d */
  setTokenWithPrefs: (
    token: string,
    refreshOrPair: string | TokenPair,
    autoLogin: boolean,
  ) => void
  setUser: (user: AuthUser | null) => void
  /** 从 cookie 恢复 refreshToken(页面刷新后调用,实现"记住 30 天") */
  hydrateRefreshToken: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      expiresIn: null,
      isAuthenticated: false,
      user: null,
      setToken: (token, refreshOrPair) => {
        setAuthCookie(token)
        if (refreshOrPair === null || refreshOrPair === undefined) {
          clearRefreshTokenCookie()
          set({ token, isAuthenticated: !!token, refreshToken: null, expiresIn: null })
          return
        }
        if (typeof refreshOrPair === 'string') {
          // 默认 session cookie(浏览器关闭失效);autoLogin 由 setTokenWithPrefs 控制
          setRefreshTokenCookie(refreshOrPair || null)
          set({
            token,
            isAuthenticated: !!token,
            refreshToken: refreshOrPair || null,
            expiresIn: null,
          })
          return
        }
        setRefreshTokenCookie(refreshOrPair.refreshToken ?? null)
        set({
          token,
          isAuthenticated: !!token,
          refreshToken: refreshOrPair.refreshToken ?? null,
          expiresIn: refreshOrPair.expiresIn ?? null,
        })
      },
      setTokenWithPrefs: (token, refreshOrPair, autoLogin) => {
        const refreshToken =
          typeof refreshOrPair === 'string' ? refreshOrPair : refreshOrPair.refreshToken
        const expiresIn =
          typeof refreshOrPair === 'string' ? null : (refreshOrPair.expiresIn ?? null)
        const cookieMaxAge = autoLogin ? REMEMBER_MAX_AGE : undefined
        setAuthCookie(token, { maxAge: cookieMaxAge })
        setRefreshTokenCookie(refreshToken ?? null, { maxAge: cookieMaxAge })
        set({ token, isAuthenticated: !!token, refreshToken: refreshToken ?? null, expiresIn })
      },
      hydrateRefreshToken: () => {
        const { refreshToken } = get()
        if (refreshToken) return // 内存已有,无需恢复
        const fromCookie = getRefreshTokenCookie()
        if (fromCookie) {
          set({ refreshToken: fromCookie })
        }
      },
      setUser: (user) => set({ user }),
      logout: () => {
        const { refreshToken } = get()
        if (refreshToken) {
          void apiLogout(refreshToken).catch(() => {})
        }
        setAuthCookie(null)
        clearRefreshTokenCookie()
        set({
          token: null,
          refreshToken: null,
          expiresIn: null,
          isAuthenticated: false,
          user: null,
        })
      },
    }),
    // 2026-07-21 安全审计加固:严禁把 token / refreshToken 持久化到 localStorage
    // 原因:localStorage 可被任意 JavaScript 读取,任何 XSS 漏洞
    // (含第三方依赖的间接 XSS) 都会让攻击者通过 localStorage.getItem('ihui-auth')
    // 直接拿到 access_token + refresh_token,造成全账户劫持
    // 修复:仅持久化非敏感 UI 状态(isAuthenticated + user)到 localStorage
    // access_token 改用 httpOnly cookie(由后端 Set-Cookie 写入,JS 无法读取)
    // refresh_token 必须由后端管理(httpOnly cookie + 定期轮换)
    // 此处仅保留 isAuthenticated 标志位用于 UI 渲染决策
    createPersistConfig<AuthState>('ihui-auth', (s) => ({
      isAuthenticated: s.isAuthenticated,
      user: s.user,
    })),
  ),
)
