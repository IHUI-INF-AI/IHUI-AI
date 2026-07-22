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
  error: string | null
  subscribe: (taskId: string) => void
  unsubscribe: (taskId: string) => void
  clear: () => void
}

// 2026-07-22 P0 Round 4 鲁棒性加固:重连 + 心跳配置
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_RECONNECT_DELAY_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 10

/** 任务 WebSocket Hook，订阅后端任务进度推送(带重连 + 心跳) */
export function useTaskWebsocket(): UseTaskWebsocketReturn {
  const [connected, setConnected] = React.useState(false)
  const [messages, setMessages] = React.useState<TaskWsMessage[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [subscribedTask, setSubscribedTask] = React.useState<string | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const token = useAuthStore((s) => s.token)

  // 重连 + 心跳 refs
  const reconnectAttemptRef = React.useRef(0)
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const closedByUnmountRef = React.useRef(false)
  const currentTaskIdRef = React.useRef<string | null>(null)

  const clearTimers = React.useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const startHeartbeat = React.useCallback((ws: WebSocket) => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send('ping')
        } catch {
          /* 心跳发送失败,等待 onclose 触发重连 */
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }, [])

  const connect = React.useCallback(
    (taskId: string) => {
      if (typeof window === 'undefined' || !token) return
      if (closedByUnmountRef.current) return
      wsRef.current?.close()
      clearTimers()

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      let ws: WebSocket
      try {
        ws = new WebSocket(
          `${proto}//${window.location.host}/ws/tasks/${taskId}?token=${encodeURIComponent(token)}`,
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'WebSocket 连接失败')
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        setConnected(true)
        setError(null)
        startHeartbeat(ws)
      }

      ws.onmessage = (e) => {
        const raw = e.data
        // 心跳响应忽略
        if (raw === 'pong' || raw === '"pong"') return
        try {
          const msg = JSON.parse(raw as string) as TaskWsMessage
          setMessages((prev) => [...prev, msg])
        } catch {
          /* 忽略非 JSON */
        }
      }

      ws.onclose = () => {
        setConnected(false)
        clearTimers()
        // 2026-07-22 P0 Round 4:断线指数退避重连,达 MAX_RECONNECT_ATTEMPTS 停止
        if (!closedByUnmountRef.current && token && currentTaskIdRef.current === taskId) {
          if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
              1000 * 2 ** reconnectAttemptRef.current,
              MAX_RECONNECT_DELAY_MS,
            )
            reconnectAttemptRef.current += 1
            reconnectTimerRef.current = setTimeout(() => connect(taskId), delay)
          } else {
            setError(`WebSocket 重连失败(已达最大次数 ${MAX_RECONNECT_ATTEMPTS})`)
          }
        }
      }

      ws.onerror = () => {
        setError('WebSocket 连接错误')
      }
    },
    [token, clearTimers, startHeartbeat],
  )

  const subscribe = React.useCallback(
    (taskId: string) => {
      setSubscribedTask(taskId)
      currentTaskIdRef.current = taskId
      reconnectAttemptRef.current = 0
      setMessages([])
      setError(null)
      connect(taskId)
    },
    [connect],
  )

  const unsubscribe = React.useCallback(
    (taskId: string) => {
      if (subscribedTask === taskId) {
        currentTaskIdRef.current = null
        clearTimers()
        wsRef.current?.close()
        wsRef.current = null
        setSubscribedTask(null)
        setConnected(false)
      }
    },
    [subscribedTask, clearTimers],
  )

  const clear = React.useCallback(() => setMessages([]), [])

  React.useEffect(() => {
    return () => {
      closedByUnmountRef.current = true
      clearTimers()
      wsRef.current?.close()
    }
  }, [clearTimers])

  const latest = messages.length > 0 ? (messages[messages.length - 1] ?? null) : null

  return { connected, messages, latest, error, subscribe, unsubscribe, clear }
}
