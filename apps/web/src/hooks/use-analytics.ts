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
}

/** 分析追踪 Hook，本地缓冲事件批量上报，卸载时自动 flush */
export function useAnalytics(): UseAnalyticsReturn {
  const bufferRef = React.useRef<AnalyticsEvent[]>([])
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(async () => {
    if (bufferRef.current.length === 0) return
    const batch = bufferRef.current.splice(0, bufferRef.current.length)
    await fetchApi('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ events: batch }),
    })
  }, [])

  const scheduleFlush = React.useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flush, 5000)
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

  return { track, trackPageView, trackClick, flush }
}
