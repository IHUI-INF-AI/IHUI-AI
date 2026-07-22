'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AgentSSEEvent } from '@ihui/types'

export interface UseAgentSSEReturn {
  connected: boolean
  lastEvent: AgentSSEEvent | null
  error: Event | null
}

const MAX_RETRY_DELAY = 30_000
const INITIAL_RETRY_DELAY = 1_000

export function useAgentSSE(url: string | null): UseAgentSSEReturn {
  const queryClient = useQueryClient()
  const [connected, setConnected] = React.useState(false)
  const [lastEvent, setLastEvent] = React.useState<AgentSSEEvent | null>(null)
  const [error, setError] = React.useState<Event | null>(null)

  const eventSourceRef = React.useRef<EventSource | null>(null)
  const retryCountRef = React.useRef(0)
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = React.useRef(true)

  const invalidateOnEvent = React.useCallback(
    (evt: AgentSSEEvent) => {
      if (
        evt.type === 'task_created' ||
        evt.type === 'task_status_changed' ||
        evt.type === 'task_completed' ||
        evt.type === 'task_failed'
      ) {
        queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      }
    },
    [queryClient],
  )

  const connect = React.useCallback(() => {
    if (!url || !mountedRef.current) return

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

    es.onerror = (e) => {
      if (!mountedRef.current) return
      setConnected(false)
      setError(e)
      es.close()
      eventSourceRef.current = null

      const attempt = retryCountRef.current
      const delay = Math.min(INITIAL_RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY)
      retryCountRef.current += 1
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [url, invalidateOnEvent])

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
