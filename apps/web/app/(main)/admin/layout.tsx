'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

/**
 * Admin 布局:客户端鉴权守卫(迁移自 D 盘 edu/admin/admin/src/router/guard.js L260-307 addDynamicRoute)。
 *
 * 分层鉴权:
 * 1. middleware.ts(Edge Runtime)— 未登录访问 /admin/* → 307 重定向到 /sso/login(cookie 级空值检查)
 * 2. 本 layout(Client Runtime)— 已登录但 roleId < 1(非管理员)→ 重定向到 /forbidden
 * 3. 后端 requireAdmin preHandler — API 级硬校验(roleId >= 1)
 *
 * roleId 阈值:>= 1 视为管理员(与 AGENTS.md §5 "admin 路由用 preHandler 统一校验(roleId >= 1)" 对齐)。
 *
 * 性能修复(2026-07-25):原 useAuth() 返回 user 对象全订阅,导致任何 setUser 调用
 * (登录 / profile 刷新 / auth bootstrap / persist hydration)都触发整个 /admin/* 子树重渲染
 * + useEffect 依赖 user 引用变化重新执行权限校验 + 视觉闪烁。改为单字段 selector。
 */
const ADMIN_ROLE_THRESHOLD = 1

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userRoleId = useAuthStore((s) => s.user?.roleId)
  const router = useRouter()
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    // 未登录:middleware 应已拦截,这里作为客户端兜底
    if (!isAuthenticated) {
      router.replace('/sso/login?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    // 已登录但非管理员:跳转到 /forbidden
    if ((userRoleId ?? 0) < ADMIN_ROLE_THRESHOLD) {
      router.replace('/forbidden')
      return
    }
    setChecked(true)
  }, [isAuthenticated, userRoleId, router])

  if (!checked) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          正在校验管理员权限…
        </div>
      </div>
    )
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
}
