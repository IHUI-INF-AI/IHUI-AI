'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface AnalyticsEvent {
  name: string
  category?: string
  label?: string
  value?: number
  props?: Record<string, unknown>
}

export interface UseAnalyticsReturn {
  track: (event: AnalyticsEvent) => void
  trackPageView: (path: string, title?: string) => void
  trackClick: (label: string, category?: string) => void
  flush: () => Promise<void>
  /** 使用 sendBeacon 同步发送(页面卸载场景,fetch 不可靠) */
  flushBeacon: () => void
}

/** 分析追踪 Hook，本地缓冲事件批量上报，卸载时自动 flush */
export function useAnalytics(): UseAnalyticsReturn {
  const bufferRef = React.useRef<AnalyticsEvent[]>([])
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(async () => {
    if (bufferRef.current.length === 0) return
    const batch = bufferRef.current.splice(0, bufferRef.current.length)
    const res = await fetchApi('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ events: batch }),
    })
    // 2026-08-02 修复:fetch 失败时把事件放回 buffer 头部,下次 flush 重试
    if (!res.success) {
      bufferRef.current.unshift(...batch)
    }
  }, [])

  const scheduleFlush = React.useCallback(() => {
    // 2026-08-02 修复:已有 timer 时不重置,保证持续事件流最终会 flush
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      void flush()
    }, 5000)
  }, [flush])

  const track = React.useCallback(
    (event: AnalyticsEvent) => {
      bufferRef.current.push({ ...event, props: { ...event.props, ts: Date.now() } })
      if (bufferRef.current.length >= 20) {
        void flush()
      } else {
        scheduleFlush()
      }
    },
    [flush, scheduleFlush],
  )

  const trackPageView = React.useCallback(
    (path: string, title?: string) => {
      track({ name: 'page_view', category: 'navigation', label: title ?? path, props: { path } })
    },
    [track],
  )

  const trackClick = React.useCallback(
    (label: string, category = 'ui') => {
      track({ name: 'click', category, label })
    },
    [track],
  )

  React.useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      void flush()
    }
  }, [flush])

  // 2026-08-02 修复:beforeunload 中 async fetch 不可靠,用 sendBeacon 同步发送
  const flushBeacon = React.useCallback(() => {
    if (bufferRef.current.length === 0) return
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      void flush()
      return
    }
    const batch = bufferRef.current.splice(0, bufferRef.current.length)
    const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' })
    const ok = navigator.sendBeacon('/api/analytics/track', blob)
    // sendBeacon 失败(队列满),放回 buffer
    if (!ok) bufferRef.current.unshift(...batch)
  }, [flush])

  return { track, trackPageView, trackClick, flush, flushBeacon }
}
