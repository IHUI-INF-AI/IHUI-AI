// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { isSessionLoggedOut } from '@/lib/session-marker'

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
 *
 * hydration 修复(2026-07-29):zustand persist 在 SSR 时用 noopStorage(isAuthenticated=false),
 * 客户端 hydration 后才从 localStorage 读取。原逻辑在 hydration 完成前就触发重定向,导致
 * 已登录用户访问 /admin/* 被错误重定向到 /sso/login。改为等 hasHydrated()=true 后再判断。
 */
const ADMIN_ROLE_THRESHOLD = 1
/** 等资料落定的宽限:/auth/me 走隧道实测 1–2s,取 10s 留足余量;到点仍无 roleId 才按无权限处理。 */
const ROLE_SETTLE_GRACE_MS = 10_000

/**
 * 「未登录」但会话可恢复时的宽限(2026-10-26)。
 *
 * `isAuthenticated` 只是持久化的 UI 标志位:上一次被动失效(expireSession)会把它落成 false,
 * 而 30 天 httpOnly refresh cookie 可能仍然有效。立即 307 会把这类用户直接送回登录页
 * (实测「隔天打开后台就要重新登录」)。这里先等 bootstrap / 401 拦截器把登录态接回来,
 * 到点仍为 false 才踢 —— 失效方向是"多等一次",不是"多弹一次"。
 */
const RECOVER_GRACE_MS = 3_000

/** 全出血页面:自己要「填满工作区 + 内部滚动」,不能再被 max-w-7xl + 四边 padding 包住。 */
const FULL_BLEED_PREFIXES = ['/admin/monitor/panels', '/admin/monitor/wallboard'] as const

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userRoleId = useAuthStore((s) => s.user?.roleId)
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)
  const fullBleed =
    pathname !== null && FULL_BLEED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  // 等 zustand persist hydration 完成(SSR 时 isAuthenticated=false,需等客户端 hydration)
  React.useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [])

  React.useEffect(() => {
    if (!hydrated) return // 等 hydration 完成后再判断,避免 SSR 初始值导致的误重定向
    // 延迟一帧再导航(2026-08-29):hydration 完成瞬间同步 replace 会命中
    // Next.js Router 初始化窗口("Router action dispatched before initialization"),
    // 且 dev 下与 middleware/proxy 的 307 形成双重守卫竞态。下一帧 Router 必已就绪;
    // 依赖变化导致 effect 重跑时 cleanup 取消未执行导航,避免重复跳转。
    // 未登录:middleware 应已拦截,这里作为客户端兜底。
    // 但"曾登录过且未主动登出"时先给一次恢复宽限 —— 详见 RECOVER_GRACE_MS 头注。
    if (!isAuthenticated) {
      const toLogin = () => {
        router.replace('/sso/login?redirect=' + encodeURIComponent(window.location.pathname))
      }
      // 服务端守卫(middleware)只有在 refresh cookie 也在场时才会放行到这里,所以
      // "未登录"只可能是本地 isAuthenticated 落成 false(persist 值 / 一次被动失效)。
      // 2026-10-26:判据不再依赖 hasSessionEstablished —— 它会被 expireSession() 清掉,
      // 而那次 expireSession 可能正是一次误判;只要用户没显式登出,就给恢复宽限。
      const recoverable = !isSessionLoggedOut()
      if (!recoverable) {
        const raf = requestAnimationFrame(toLogin)
        return () => cancelAnimationFrame(raf)
      }
      const timer = setTimeout(() => {
        if (useAuthStore.getState().isAuthenticated) return
        requestAnimationFrame(toLogin)
      }, RECOVER_GRACE_MS)
      return () => clearTimeout(timer)
    }
    // 已登录但非管理员:跳转到 /forbidden
    //
    // **「角色还不知道」不得当成「角色不够」判(2026-10-21 实测)**:bootstrap 的顺序是
    // 先 `setToken(...)`(⇒ isAuthenticated=true)再拉 `/auth/me` 才 `setUser(...)`(roleId 随资料一起到),
    // 中间这一格 `user?.roleId` 是 undefined。原先 `(userRoleId ?? 0) < 1` 把它折成 0 ⇒ 真管理员
    // 被弹到 /forbidden,而且 replaceState 之后不会自己回来。现读复现:同一份登录态下
    // 6 次冷加载有 3 次落在 /forbidden(时间差,与明暗主题无关 —— 主题只是让某一侧稳定地更快)。
    if (userRoleId === undefined || userRoleId === null) {
      // 有终态的等待:宽限期内资料到了就照常放行(依赖变化会重跑本 effect 并 clearTimeout);
      // 到点仍取不到才按「无权限」处理 —— 失效方向是"多等一次",绝不是"多弹一次"。
      const timer = setTimeout(() => {
        const settled = useAuthStore.getState().user?.roleId
        if (settled === undefined || settled === null) {
          requestAnimationFrame(() => router.replace('/forbidden'))
        }
      }, ROLE_SETTLE_GRACE_MS)
      return () => clearTimeout(timer)
    }
    if ((userRoleId ?? 0) < ADMIN_ROLE_THRESHOLD) {
      const raf = requestAnimationFrame(() => {
        router.replace('/forbidden')
      })
      return () => cancelAnimationFrame(raf)
    }
    setChecked(true)
  }, [hydrated, isAuthenticated, userRoleId, router])

  if (!checked) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          正在校验管理员权限…
        </div>
      </div>
    )
  }

  return (
    <div
      className={fullBleed ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full max-w-7xl px-4 py-4'}
    >
      {children}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
