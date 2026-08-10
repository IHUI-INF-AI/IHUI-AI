'use client'

/**
 * VisitTracker — 页面访问埋点(2026-08-10 立,接通 visit_logs 统计看板)
 *
 * 后端已具备完整链路(POST /api/visit-tracking/visit-log + 管理端统计 API),
 * 此前前端从未上报 → visit_logs 长期 0 行。此组件在 GlobalShell 中全局挂载,
 * 监听 pathname 变化自动上报页面访问。
 *
 * 特性:
 * - pathname 变化时上报(带 referer/sessionId/userId,userId 取 auth store)
 * - 忽略 /admin/*(后台操作不计入用户访问)、/api/*、/_next/*、静态资源
 * - 防抖:同一路径 3s 内不重复上报
 * - 失败静默(不打断用户体验,失败自动丢弃)
 * - sendBeacon 优先(卸载/跳转场景可靠),回退 fetch keepalive
 */
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

const REPORT_API = '/api/visit-tracking/visit-log'

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('ihui_visit_sid')
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('ihui_visit_sid', sid)
    }
    return sid
  } catch {
    return ''
  }
}

function isIgnored(path: string): boolean {
  if (!path || path === '/') return false
  // 后台 / 内部接口 / 静态资源不记入用户访问
  return (
    path.startsWith('/admin') ||
    path.startsWith('/api/') ||
    path.startsWith('/_next') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    /\.(png|jpg|jpeg|svg|ico|css|js|woff2?|webp|gif)(\?|$)/i.test(path)
  )
}

export function VisitTracker() {
  const pathname = usePathname()
  const lastRef = React.useRef<{ path: string; ts: number }>({ path: '', ts: 0 })
  const userId = useAuthStore((s) => s.user?.id)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname + window.location.search
    if (isIgnored(path)) return

    const now = Date.now()
    const last = lastRef.current
    // 防抖:同路径 3s 内只报一次(Next 客户端路由可能多次触发)
    if (last.path === path && now - last.ts < 3000) return
    lastRef.current = { path, ts: now }

    const payload = JSON.stringify({
      url: path,
      referer: document.referrer?.slice(0, 500) || undefined,
      sessionId: getSessionId(),
      userId: userId ?? undefined,
      visitDate: new Date().toISOString().slice(0, 10),
    })

    const send = () => {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const ok = navigator.sendBeacon(
            REPORT_API,
            new Blob([payload], { type: 'application/json' }),
          )
          if (ok) return
        }
        void fetch(REPORT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
          credentials: 'include',
        }).catch(() => {
          /* 埋点失败静默,不影响用户 */
        })
      } catch {
        /* 埋点失败静默 */
      }
    }

    // 延迟上报,避免影响首屏渲染
    const timer = setTimeout(send, 1500)
    return () => clearTimeout(timer)
  }, [pathname, userId])

  return null
}
