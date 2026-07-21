'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

/**
 * Admin 布局:客户端鉴权守卫(迁移自 D 盘 edu/admin/admin/src/router/guard.js L260-307 addDynamicRoute)。
 *
 * 分层鉴权:
 * 1. middleware.ts(Edge Runtime)— 未登录访问 /admin/* → 307 重定向到 /sso/login(cookie 级空值检查)
 * 2. 本 layout(Client Runtime)— 已登录但 roleId < 1(非管理员)→ 重定向到 /forbidden
 * 3. 后端 requireAdmin preHandler — API 级硬校验(roleId >= 1)
 *
 * roleId 阈值:>= 1 视为管理员(与 AGENTS.md §5 "admin 路由用 preHandler 统一校验(roleId >= 1)" 对齐)。
 */
const ADMIN_ROLE_THRESHOLD = 1

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    // 未登录:middleware 应已拦截,这里作为客户端兜底
    if (!isAuthenticated) {
      router.replace('/sso/login?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    // 已登录但非管理员:跳转到 /forbidden
    const roleId = user?.roleId ?? 0
    if (roleId < ADMIN_ROLE_THRESHOLD) {
      router.replace('/forbidden')
      return
    }
    setChecked(true)
  }, [isAuthenticated, user, router])

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
