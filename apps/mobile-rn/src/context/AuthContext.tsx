import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loginByAccount, logout as apiLogout, type AuthUser } from '@ihui/api-client'
import {
  initApi,
  setToken,
  setRefreshToken,
  getToken,
  getRefreshToken,
  clearToken,
} from '../lib/token'
import {
  getInitialSsoCode,
  subscribeSsoDeepLink,
  exchangeSsoCode,
} from '../lib/sso'

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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | null = null
    initApi().then(async () => {
      setTokenState(getToken())
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
   * 用 sso_code 换 token 并写入 store
   */
  async function applySsoCode(code: string): Promise<boolean> {
    const data = await exchangeSsoCode(code)
    if (!data) return false
    await setToken(data.accessToken)
    await setRefreshToken(data.refreshToken)
    setTokenState(data.accessToken)
    setUser(data.user)
    return true
  }

  const login = async (account: string, password: string): Promise<LoginResult> => {
    const res = await loginByAccount(account, password)
    if (res.success) {
      await setToken(res.data.accessToken)
      await setRefreshToken(res.data.refreshToken)
      setTokenState(res.data.accessToken)
      setUser(res.data.user)
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
    await clearToken()
    setTokenState(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, ready, login, loginBySso, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
