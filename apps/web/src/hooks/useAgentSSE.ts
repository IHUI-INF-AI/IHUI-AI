// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshAccessTokenOnce } from '@ihui/api-client'
import type { AgentSSEEvent } from '@ihui/types'

export interface UseAgentSSEReturn {
  connected: boolean
  lastEvent: AgentSSEEvent | null
  error: Event | null
}

/**
 * 流地址供给器:每次**建连/重连**时现取(而不是 mount 时算好一枚固定字符串)。
 * 传字符串仍受支持(等价于 `() => url`),但那样浏览器/自写重连会复用同一枚凭据。
 */
export type AgentSSEUrlSource = string | null | (() => string | null)

const MAX_RETRY_DELAY = 30_000
const INITIAL_RETRY_DELAY = 1_000

export function useAgentSSE(source: AgentSSEUrlSource): UseAgentSSEReturn {
  const queryClient = useQueryClient()
  const [connected, setConnected] = React.useState(false)
  const [lastEvent, setLastEvent] = React.useState<AgentSSEEvent | null>(null)
  const [error, setError] = React.useState<Event | null>(null)

  const eventSourceRef = React.useRef<EventSource | null>(null)
  const retryCountRef = React.useRef(0)
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = React.useRef(true)
  /** 供给器存 ref:调用方传内联函数也不该让 connect/重连阶梯被反复重置 */
  const sourceRef = React.useRef(source)
  sourceRef.current = source
  /** 一次挂载只续期+重建一次:新凭据仍被拒 = 会话真死,继续重建只会刷同一枚过期 token */
  const authRetriedRef = React.useRef(false)

  const invalidateOnEvent = React.useCallback(
    (evt: AgentSSEEvent) => {
      if (
        evt.type === 'task_created' ||
        evt.type === 'task_status_changed' ||
        evt.type === 'task_completed' ||
        evt.type === 'task_failed' ||
        // 2-2 工作区锁事件:锁徽标(lockedBy/lockedAt)需随流转刷新
        evt.type === 'workspace_lock_acquired' ||
        evt.type === 'workspace_lock_released'
      ) {
        queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      }
    },
    [queryClient],
  )

  const connect = React.useCallback(() => {
    if (!mountedRef.current) return
    // 凭据每次建连现取:旧实现把带 ?token= 的 URL 在 mount 时算死并由浏览器/自写重连
    // 反复复用 ⇒ access(15 分钟)一过期,重连必然继续 401,且没人报一句。
    const s = sourceRef.current
    const url = typeof s === 'function' ? s() : s
    if (!url) return

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      if (!mountedRef.current) return
      retryCountRef.current = 0
      setConnected(true)
      setError(null)
    }

    es.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const parsed = JSON.parse(e.data) as AgentSSEEvent
        setLastEvent(parsed)
        invalidateOnEvent(parsed)
      } catch {
        // 忽略无法解析的事件
      }
    }

    /**
     * 2026-10-26 分档(EventSource 的 onerror 有两种互斥成因,旧实现混成一桶):
     *   - CONNECTING ⇒ 瞬态抖动,浏览器**正在**自动重连 ⇒ 不许在这里续期/报错;
     *   - CLOSED     ⇒ 致命失败(HTTP 401/403/410、内容类型不符),浏览器**不再**重连。
     * 致命档 ⇒ 续期一次(新 cookie/token 随之落定)后重建一次;续期失败或重建仍致命
     * ⇒ 置 error + 大声记一行并**停手**(不再排重连定时器)。
     * 同一条分档口径另见 use-admin-insights-stream.ts / use-agent-runtime.ts /
     * tool-approval-dialog.tsx。
     */
    es.onerror = (e) => {
      if (!mountedRef.current) return
      setConnected(false)
      setError(e)
      const fatal = es.readyState === EventSource.CLOSED
      es.close()
      eventSourceRef.current = null

      if (!fatal) {
        const attempt = retryCountRef.current
        const delay = Math.min(INITIAL_RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(connect, delay)
        return
      }

      void (async () => {
        if (authRetriedRef.current) {
          console.error('[useAgentSSE] stream dead: unauthorized-after-refresh', url)
          return
        }
        authRetriedRef.current = true
        const fresh = await refreshAccessTokenOnce()
        if (!mountedRef.current) return
        if (fresh) {
          connect()
          return
        }
        console.error('[useAgentSSE] stream dead: refresh-failed', url)
      })()
    }
  }, [invalidateOnEvent])

  React.useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  return { connected, lastEvent, error }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
