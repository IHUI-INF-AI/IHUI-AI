'use client'

/**
 * AnalyticsCapture — 全局行为埋点采集(2026-08-10 立)
 *
 * 自动采集以下行为事件并批量上报 /api/analytics/track:
 * - click:     带 data-analytics 属性元素的点击(如按钮/菜单项/卡片)
 * - search:    站内搜索框提交(keyword)
 * - download:  <a download> / 常见文档链接点击
 * - link_out:  站外链接点击(新窗口)
 * - form_submit: 表单提交(带 data-analytics-form 属性)
 *
 * 与 useRouteAnalytics(page_view/page_time/route_change)互补:
 * 页面级数据走 visit_logs + analytics_events,行为级数据走 analytics_events。
 *
 * 采样/防抖:同一元素 10s 内不重复上报,避免连点刷屏。
 * 失败静默:不上报错误,不打断用户。
 */
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

const REPORT_URL = '/api/analytics/track'

// 常见文档/下载扩展名
const DOWNLOAD_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|tar|gz|mp4|mp3|wav|png|jpe?g|webp|gif)(\?|#|$)/i

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

/** 从事件冒泡路径找最近的可追踪目标 */
function findTrackable(el: Element | null): { label: string; category?: string } | null {
  let node: Element | null = el
  let depth = 0
  while (node && depth < 6) {
    const label = node.getAttribute?.('data-analytics')
    if (label) {
      return {
        label,
        category: node.getAttribute?.('data-analytics-category') ?? undefined,
      }
    }
    const text = node.textContent?.trim().slice(0, 50)
    if (text && (node.tagName === 'BUTTON' || node.tagName === 'A')) {
      return { label: text }
    }
    node = node.parentElement
    depth++
  }
  return null
}

export function AnalyticsCapture() {
  const pathname = usePathname()
  const userId = useAuthStore((s) => s.user?.id)
  const bufferRef = React.useRef<Array<Record<string, unknown>>>([])
  const lastReportRef = React.useRef<Record<string, number>>({})
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const queue = React.useCallback((events: Array<Record<string, unknown>>) => {
    bufferRef.current.push(...events)
    // 批量满 30 或 8s 定时上报
    if (bufferRef.current.length >= 30) {
      void flush()
    } else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null
        void flush()
      }, 8000)
    }
  }, [])

  const flush = React.useCallback(async () => {
    if (bufferRef.current.length === 0) return
    const batch = bufferRef.current.splice(0, bufferRef.current.length)
    try {
      await fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
        credentials: 'include',
      })
    } catch {
      // 失败静默
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const sid = getSessionId()
    const path = pathname ?? window.location.pathname

    const emit = (name: string, label: string, extra: Record<string, unknown> = {}) => {
      const key = `${name}:${label}`
      const now = Date.now()
      // 防抖:同元素 10s 内不重复
      if (lastReportRef.current[key] && now - lastReportRef.current[key] < 10000) return
      lastReportRef.current[key] = now
      queue([
        {
          name,
          category: extra.category ?? 'ui',
          label,
          props: { path, sessionId: sid, userId: userId ?? null, ...extra },
        },
      ])
    }

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target || typeof target.closest !== 'function') return
      // 下载链接
      const anchor = target.closest('a')
      if (anchor) {
        const href = anchor.getAttribute('href') ?? ''
        const download = anchor.getAttribute('download')
        if (download || DOWNLOAD_RE.test(href)) {
          emit('download', download || href.split('/').pop() || href, {
            category: 'download',
            url: href.slice(0, 200),
          })
          return
        }
        if (anchor.target === '_blank' && /^https?:\/\//.test(href)) {
          emit('link_out', href.slice(0, 100), { category: 'navigation', url: href.slice(0, 200) })
          return
        }
      }
      // data-analytics 标记元素
      const trackable = findTrackable(target)
      if (trackable) {
        emit('click', trackable.label, {
          category: trackable.category ?? 'ui',
          tag: target.closest('button, a, [role="button"]')?.tagName ?? 'element',
        })
      }
    }

    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement
      if (!form) return
      if (form.hasAttribute('data-analytics-form')) {
        const label = form.getAttribute('data-analytics-form') || 'form'
        // 取搜索类表单的 input 值作为关键词
        const keyword =
          form.querySelector<HTMLInputElement>('input[type="search"], input[name="q"], input[name="keyword"], input[name="search"]')
            ?.value?.trim()
        emit('form_submit', label, { category: 'form', keyword: keyword ?? undefined })
      } else if (form.closest('form[role="search"], form[class*="search"]')) {
        const keyword =
          form.querySelector<HTMLInputElement>('input[type="search"], input[name="q"], input[name="keyword"]')
            ?.value?.trim()
        if (keyword) emit('search', keyword.slice(0, 100), { category: 'search', keyword: keyword.slice(0, 100) })
      }
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)

    const onUnload = () => void flush()
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush()
    })

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
      window.removeEventListener('beforeunload', onUnload)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
  }, [pathname, userId, queue, flush])

  return null
}
