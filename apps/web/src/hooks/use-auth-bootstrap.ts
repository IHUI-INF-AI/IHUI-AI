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
