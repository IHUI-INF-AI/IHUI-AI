'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { fetchApi } from '@/lib/api'
import { getRefreshTokenCookie, clearRefreshTokenCookie } from '@/lib/cookie-utils'
import { refreshAccessToken } from '@ihui/api-client'

export interface UseAuthBootstrapReturn {
  ready: boolean
  isAuthenticated: boolean
  error: string | null
}

/**
 * 用 refreshToken 调 /api/auth/refresh 获取新 accessToken。
 * 成功返回 { accessToken, refreshToken },失败返回 null 并清理 refresh cookie。
 * 这是"自动登录"的核心:浏览器关闭再打开后,refreshToken cookie(30d)仍在,
 * 自动换取新 token 实现免密登录。
 */
async function tryRefresh(): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const refreshToken = getRefreshTokenCookie()
  if (!refreshToken) return null
  try {
    const r = await refreshAccessToken(refreshToken)
    if (!r.success || !r.data?.accessToken) {
      clearRefreshTokenCookie()
      return null
    }
    return {
      accessToken: r.data.accessToken,
      refreshToken: r.data.refreshToken,
    }
  } catch {
    clearRefreshTokenCookie()
    return null
  }
}

/**
 * 认证引导 Hook
 *
 * 应用启动时尝试用已有 token 恢复登录态并拉取用户资料，
 * 供根布局/Provider 调用以完成"静默登录"。
 *
 * 自动登录闭环(2026-07-22 完善):
 *  1. 优先用 auth_token cookie 直接恢复
 *  2. token 失效时,用 refresh_token cookie 调 /api/auth/refresh 换取新 token
 *  3. refresh 也失败 → 清理 cookie,用户需重新登录
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

      // 无 accessToken:尝试用 refreshToken 自动登录(自动登录闭环)
      if (!storedToken) {
        const refreshed = await tryRefresh()
        if (cancelled) return
        if (refreshed) {
          storedToken = refreshed.accessToken
          setToken(refreshed.accessToken, refreshed.refreshToken ?? null)
        } else {
          setReady(true)
          return
        }
      }

      // 🎭 Mock 模式: token 以 mock_ 开头时,跳过 /auth/me API 调用
      if (storedToken.startsWith('mock_')) {
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
            /* base64 解析失败时,token 仍然标记已认证,user 留空 */
          }
        }
        if (!cancelled) setReady(true)
        return
      }

      setToken(storedToken, null)

      try {
        const res = await fetchApi<{ user: { id: string; nickname: string; avatar?: string; phone?: string; roleId?: number; username?: string; status?: number } }>('/auth/me')
        if (cancelled) return
        if (res.success) {
          const u = res.data.user
          // 保留 roleId(后端 publicUser 已返回),admin layout 守卫需用它判断权限
          setUser({
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
            phone: u.phone,
            roleId: u.roleId,
            username: u.username,
            status: u.status,
          })
          await fetchProfile()
        } else {
          // token 失效:尝试 refreshToken 自动续期(自动登录闭环)
          const refreshed = await tryRefresh()
          if (cancelled) return
          if (refreshed) {
            setToken(refreshed.accessToken, refreshed.refreshToken ?? null)
            const retry = await fetchApi<{ user: { id: string; nickname: string; avatar?: string; phone?: string; roleId?: number; username?: string; status?: number } }>('/auth/me')
            if (!cancelled && retry.success) {
              const u = retry.data.user
              setUser({
                id: u.id,
                nickname: u.nickname,
                avatar: u.avatar,
                phone: u.phone,
                roleId: u.roleId,
                username: u.username,
                status: u.status,
              })
              await fetchProfile()
            } else {
              logout()
            }
          } else {
            logout()
          }
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
