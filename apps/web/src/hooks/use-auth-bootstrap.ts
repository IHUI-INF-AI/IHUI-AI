'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { fetchApi } from '@/lib/api'

export interface UseAuthBootstrapReturn {
  ready: boolean
  isAuthenticated: boolean
  error: string | null
}

/**
 * 认证引导 Hook
 *
 * 应用启动时尝试用已有 token 恢复登录态并拉取用户资料，
 * 供根布局/Provider 调用以完成"静默登录"。
 */
export function useAuthBootstrap(): UseAuthBootstrapReturn {
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setUser = useAuthStore((s) => s.setUser)
  const setToken = useAuthStore((s) => s.setToken)
  const logout = useAuthStore((s) => s.logout)
  const fetchProfile = useUserStore((s) => s.fetchProfile)

  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      // 从 cookie 读取 token（SSR 场景下 store 尚未水合）
      let storedToken = token
      if (!storedToken && typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)
        storedToken = match ? decodeURIComponent(match[1]!) : null
      }
      if (!storedToken) {
        setReady(true)
        return
      }

      // 🎭 Mock 模式: token 以 mock_ 开头时,跳过 /auth/profile API 调用
      // (mock token 是前端伪造,后端不认),改从 mock_user_info 跨域 cookie 恢复 user
      // 该 cookie 由 OAuthCallbackHandler 的 mock 分支设置,domain=.aizhs.top
      if (storedToken.startsWith('mock_')) {
        // 同步设置 token + isAuthenticated,避免 setUser 后 isAuthenticated 仍为 false
        setToken(storedToken, null)
        const mockUserCookie = document.cookie.match(/(?:^|;\s*)mock_user_info=([^;]+)/)
        if (mockUserCookie && mockUserCookie[1]) {
          try {
            const decoded = decodeURIComponent(escape(atob(decodeURIComponent(mockUserCookie[1]))))
            const mockUser = JSON.parse(decoded) as {
              id: string
              nickname: string
              email?: string
              avatar?: string | null
              provider?: string
            }
            setUser(mockUser as never)
          } catch {
            /* base64 解析失败时,token 仍然标记已认证,user 留空(导航不显示) */
          }
        }
        if (!cancelled) setReady(true)
        return
      }

      try {
        const res = await fetchApi<{
          id: string
          nickname: string
          avatar?: string
          phone?: string
        }>('/auth/profile')
        if (cancelled) return
        if (res.success) {
          setUser({
            id: res.data.id,
            nickname: res.data.nickname,
            avatar: res.data.avatar,
            phone: res.data.phone,
          })
          await fetchProfile()
        } else {
          // token 失效
          logout()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '引导失败')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
    // 仅在挂载时执行一次
  }, [])

  return { ready, isAuthenticated, error }
}
