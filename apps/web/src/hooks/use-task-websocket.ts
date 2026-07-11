'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'

export interface TaskWsMessage {
  taskId: string
  type: 'progress' | 'completed' | 'failed' | 'log'
  progress?: number
  message?: string
  result?: unknown
  timestamp?: string
}

export interface UseTaskWebsocketReturn {
  connected: boolean
  messages: TaskWsMessage[]
  latest: TaskWsMessage | null
  subscribe: (taskId: string) => void
  unsubscribe: (taskId: string) => void
  clear: () => void
}

/** 任务 WebSocket Hook，订阅后端任务进度推送 */
export function useTaskWebsocket(): UseTaskWebsocketReturn {
  const [connected, setConnected] = React.useState(false)
  const [messages, setMessages] = React.useState<TaskWsMessage[]>([])
  const [subscribedTask, setSubscribedTask] = React.useState<string | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const token = useAuthStore.getState().token

  const connect = React.useCallback(
    (taskId: string) => {
      if (typeof window === 'undefined' || !token) return
      wsRef.current?.close()
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(
        `${proto}//${window.location.host}/ws/tasks/${taskId}?token=${encodeURIComponent(token)}`,
      )
      ws.onopen = () => setConnected(true)
      ws.onclose = () => setConnected(false)
      ws.onerror = () => setConnected(false)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as TaskWsMessage
          setMessages((prev) => [...prev, msg])
        } catch {
          /* 忽略非 JSON */
        }
      }
      wsRef.current = ws
    },
    [token],
  )

  const subscribe = React.useCallback(
    (taskId: string) => {
      setSubscribedTask(taskId)
      setMessages([])
      connect(taskId)
    },
    [connect],
  )

  const unsubscribe = React.useCallback(
    (taskId: string) => {
      if (subscribedTask === taskId) {
        wsRef.current?.close()
        wsRef.current = null
        setSubscribedTask(null)
      }
    },
    [subscribedTask],
  )

  const clear = React.useCallback(() => setMessages([]), [])

  React.useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  const latest = messages.length > 0 ? (messages[messages.length - 1] ?? null) : null

  return { connected, messages, latest, subscribe, unsubscribe, clear }
}
