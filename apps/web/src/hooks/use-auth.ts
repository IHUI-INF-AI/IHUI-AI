// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { useAuthStore, type AuthUser } from '@/stores/auth'
import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
import { refreshAccessTokenOnce } from '@ihui/api-client'
import { loadLocalLoginPrefs, saveLocalLoginPrefs } from '@/lib/login-preferences'
import { loadAutoLogin } from '@ihui/ui-react'

export interface UseAuthReturn {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser, refreshToken?: string) => void
  logout: () => void
  refreshToken: () => Promise<boolean>
}

/** 认证 Hook,集成 useAuthStore,登录后按偏好启动 token 续期 */
export function useAuth(): UseAuthReturn {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setToken = useAuthStore((s) => s.setToken)
  const setTokenWithPrefs = useAuthStore((s) => s.setTokenWithPrefs)
  const setUser = useAuthStore((s) => s.setUser)
  const storeLogout = useAuthStore((s) => s.logout)

  const login = React.useCallback(
    (newToken: string, newUser: AuthUser, newRefreshToken?: string) => {
      // 读取本地 autoLogin/autoRenew 偏好(登录页勾选状态)
      const prefs = loadLocalLoginPrefs()
      // 同步登录表单保存的 autoLogin(ihui-auto-login)到 ihui-login-prefs
      const formAutoLogin = loadAutoLogin()
      const effectiveAutoLogin = prefs.autoLogin || formAutoLogin
      if (formAutoLogin && !prefs.autoLogin) {
        saveLocalLoginPrefs({ autoLogin: true })
      }
      if (newRefreshToken) {
        // 用偏好写入 cookie(autoLogin=true → 30天;false → session)
        setTokenWithPrefs(newToken, newRefreshToken, effectiveAutoLogin)
        // autoRenew=true 才启动自动续期(关闭则 30 天后强制重新登录)
        if (prefs.autoRenew) startAutoRefresh()
      } else {
        setToken(newToken, null)
      }
      setUser(newUser)
    },
    [setToken, setTokenWithPrefs, setUser],
  )

  const logout = React.useCallback(() => {
    stopAutoRefresh()
    storeLogout()
  }, [storeLogout])

  const refreshToken = React.useCallback(async (): Promise<boolean> => {
    // 2026-09-04 根治刷新风暴:复用全局单例,避免与 401 拦截器 / bootstrap 并发各发一次
    // /auth/refresh(单次轮转 → family 吊销 → 登录态丢失)。原实现裸调 fetchApi('/api/auth/refresh')
    // 完全绕过 api-client 的 refreshInFlight 去重,是刷新风暴的旁路源之一。
    const newToken = await refreshAccessTokenOnce()
    return !!newToken
  }, [])

  return { user, token, isAuthenticated, login, logout, refreshToken }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
