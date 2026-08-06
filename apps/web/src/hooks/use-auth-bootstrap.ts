'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { fetchApi } from '@/lib/api'
import { refreshAccessToken } from '@ihui/api-client'

export interface UseAuthBootstrapReturn {
  ready: boolean
  isAuthenticated: boolean
  error: string | null
}

/**
 * 用 httpOnly refresh_token cookie 调 /api/auth/refresh 获取新 accessToken。
 * 成功返回 { accessToken, refreshToken },失败返回 null。
 * P2-18 修复(2026-08-06):refresh_token 已 httpOnly,前端 JS 读不到 cookie,
 * 不再从 document.cookie 读取,改为无参调用刷新接口(不带 refreshToken body),
 * 由浏览器自动附带 httpOnly cookie。
 */
async function tryRefresh(): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const r = await refreshAccessToken()
    if (!r.success || !r.data?.accessToken) {
      return null
    }
    return {
      accessToken: r.data.accessToken,
      refreshToken: r.data.refreshToken,
    }
  } catch {
    return null
  }
}

/**
 * 认证引导 Hook
 *
 * 应用启动时尝试用已有 token 恢复登录态并拉取用户资料，
 * 供根布局/Provider 调用以完成"静默登录"。
 *
 * 自动登录闭环(2026-07-22 完善,2026-08-06 P2-18 修订):
 *  1. 无内存 token 时,直接无参调 /api/auth/refresh(httpOnly refresh_token cookie 自动附带)
 *  2. 刷新成功 → setToken 恢复登录态
 *  3. 刷新失败(401) → 保持未登录(静默,不弹登录框)
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
      // P2-18 修复(2026-08-06):auth_token 已 httpOnly,前端 JS 读不到 cookie,
      // 不再从 document.cookie 恢复 token。改为无内存 token 时直接静默刷新
      // (POST /api/auth/refresh 不带 refreshToken body,靠 httpOnly cookie 自动附带)。
      let storedToken = token

      // 无内存 accessToken:尝试静默刷新恢复登录态(自动登录闭环)
      if (!storedToken) {
        const refreshed = await tryRefresh()
        if (cancelled) return
        if (refreshed) {
          storedToken = refreshed.accessToken
          setToken(refreshed.accessToken, refreshed.refreshToken ?? null)
        } else {
          // 刷新失败(401):清理幽灵登录态(2026-08-07 修复)
          // 根因:persist 仅存 isAuthenticated 标志位,httpOnly cookie 失效后
          // 标志位残留 → 前端误判已登录渲染任务列表 → 请求无凭据 401 → "加载失败"。
          // 此处必须 logout() 清空标志位,而非仅 setReady(true) 静默返回。
          logout()
          setReady(true)
          return
        }
      } else {
        // 内存已有 token(本会话登录过):补 setToken 保持状态一致。
        // P2-18:原实现传 null 会清掉内存 refreshToken,而 httpOnly 后无法再从 cookie 恢复,
        // 将导致页面刷新后自动续期(startAutoRefresh)与登出吊销失效,故改为保留。
        setToken(storedToken, useAuthStore.getState().refreshToken)
      }

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
