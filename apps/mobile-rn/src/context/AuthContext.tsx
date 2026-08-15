import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loginByAccount, logout as apiLogout, type AuthUser } from '@ihui/api-client'
import { initApi, getRefreshToken } from '../lib/token'
import { getInitialSsoCode, subscribeSsoDeepLink, exchangeSsoCode } from '../lib/sso'
import { rnAuthStore, useAuthStore, hydrateAuth } from '../stores/auth-store'

export type { AuthUser }

export interface LoginResult {
  success: boolean
  error?: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  ready: boolean
  login: (account: string, password: string) => Promise<LoginResult>
  loginBySso: () => Promise<LoginResult>
  logout: () => Promise<void>
  /**
   * 登录成功后回跳的路由名(对齐 uniapp setStorageSync('returnUrl', ...) 机制):
   * 跳登录前由业务页 setReturnUrl 记录原页面,登录成功后消费并回跳;无则默认进 Main。
   */
  returnUrl: string | null
  setReturnUrl: (url: string | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 委托 auth-store 作为单一数据源(消除平行 useState),user/token 不再本地持有
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  // ready 保持本地:必须等 initApi() 完成且 token 已镜像后才置 true,
  // 避免 persist onRehydrateStorage 提前置 ready=true 导致 token 仍为 null 的窗口
  const [ready, setReady] = useState(false)
  // returnUrl:跳登录前记录的原页面路由名,登录成功后回跳(对齐 uniapp returnUrl 机制)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | null = null
    initApi().then(async () => {
      // 镜像 tokenStore → auth-store,统一数据源
      hydrateAuth()
      setReady(true)

      // 冷启动时检查 SSO deep link(若应用因 ihui://sso/callback?sso_code=xxx 唤起)
      const initialCode = await getInitialSsoCode()
      if (initialCode) {
        await applySsoCode(initialCode)
      }

      // 已运行时监听 deep link
      unsub = subscribeSsoDeepLink(async (code) => {
        await applySsoCode(code)
      })
    })
    return () => {
      if (unsub) unsub()
    }
  }, [])

  /**
   * 用 sso_code 换 token 并写入 auth-store(同步镜像 tokenStore)
   */
  async function applySsoCode(code: string): Promise<boolean> {
    const data = await exchangeSsoCode(code)
    if (!data) return false
    await rnAuthStore.getState().setAuth({
      token: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    })
    return true
  }

  const login = async (account: string, password: string): Promise<LoginResult> => {
    const res = await loginByAccount(account, password)
    if (res.success) {
      await rnAuthStore.getState().setAuth({
        token: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        user: res.data.user,
      })
      return { success: true }
    }
    return { success: false, error: res.error }
  }

  const loginBySso = async (): Promise<LoginResult> => {
    const { openSsoLogin } = await import('../lib/sso')
    const redirectUrl = await openSsoLogin()
    if (!redirectUrl) {
      return { success: false, error: '用户取消授权' }
    }
    // openAuthSession 返回的 URL 含 sso_code,直接换 token
    const { extractSsoCode } = await import('../lib/sso')
    const code = extractSsoCode(redirectUrl)
    if (!code) {
      return { success: false, error: 'SSO 回跳未包含 code' }
    }
    const ok = await applySsoCode(code)
    return ok ? { success: true } : { success: false, error: 'SSO 换取 token 失败' }
  }

  const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await apiLogout(refreshToken)
    }
    // auth-store.logout 清 tokenStore + 本地镜像 + user 持久化
    await rnAuthStore.getState().logout()
  }

  return (
    <AuthContext.Provider
      value={{ user, token, ready, login, loginBySso, logout, returnUrl, setReturnUrl }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
