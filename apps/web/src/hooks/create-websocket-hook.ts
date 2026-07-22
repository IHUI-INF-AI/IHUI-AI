'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'

export interface WebSocketHookOptions<TMessage> {
  urlBuilder: (token: string | null) => string
  messageGuard: (data: unknown) => data is TMessage
  heartbeatInterval?: number
  maxReconnectDelay?: number
  /** 心跳消息工厂，默认发送 'ping' 字符串 */
  heartbeatMessage?: () => string
  /** 2026-07-22 P0 Round 4:最大重连次数,默认 10 次,达到后停止重连 */
  maxReconnectAttempts?: number
}

export interface WebSocketHookResult<TMessage> {
  send: (data: string) => void
  close: () => void
  isConnected: boolean
  lastMessage: TMessage | null
  error: string | null
}

/**
 * WebSocket Hook 工厂函数。
 *
 * 封装通用能力：自动附加 JWT token、心跳、断线指数退避重连、消息类型守卫。
 * SSR 安全（typeof window 检查 + effect 内连接）。
 */
export function createWebSocketHook<TMessage>(options: WebSocketHookOptions<TMessage>) {
  const {
    heartbeatInterval = 30000,
    maxReconnectDelay = 30000,
    heartbeatMessage = () => 'ping',
    maxReconnectAttempts = 10,
  } = options

  return function useWS(): WebSocketHookResult<TMessage> {
    const token = useAuthStore((s) => s.token)
    const { urlBuilder, messageGuard } = options

    const [isConnected, setConnected] = React.useState(false)
    const [lastMessage, setLastMessage] = React.useState<TMessage | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const wsRef = React.useRef<WebSocket | null>(null)
    const reconnectAttempt = React.useRef(0)
    const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const heartbeatTimer = React.useRef<ReturnType<typeof setInterval> | null>(null)
    const closedByUnmount = React.useRef(false)

    const clearTimers = React.useCallback(() => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current)
        heartbeatTimer.current = null
      }
    }, [])

    const startHeartbeat = React.useCallback(
      (ws: WebSocket) => {
        if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
        heartbeatTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(heartbeatMessage())
            } catch {
              /* 心跳发送失败，等待 onclose 触发重连 */
            }
          }
        }, heartbeatInterval)
      },
      [heartbeatInterval, heartbeatMessage],
    )

    const connect = React.useCallback(() => {
      if (!token || closedByUnmount.current) return
      if (typeof window === 'undefined') return

      let ws: WebSocket
      try {
        ws = new WebSocket(urlBuilder(token))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'WebSocket 连接失败')
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttempt.current = 0
        setConnected(true)
        setError(null)
        startHeartbeat(ws)
      }

      ws.onmessage = (event) => {
        const raw = event.data
        if (raw === 'pong' || raw === '"pong"') return
        try {
          const parsed = JSON.parse(raw) as unknown
          if (!messageGuard(parsed)) return
          setLastMessage(parsed)
        } catch {
          /* 非法 JSON 忽略 */
        }
      }

      ws.onclose = () => {
        setConnected(false)
        clearTimers()
        // 2026-07-22 P0 Round 4:达到 maxReconnectAttempts 后停止重连,防无限重连
        if (!closedByUnmount.current && token && reconnectAttempt.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current, maxReconnectDelay)
          reconnectAttempt.current += 1
          reconnectTimer.current = setTimeout(connect, delay)
        } else if (reconnectAttempt.current >= maxReconnectAttempts) {
          setError(`WebSocket 重连失败(已达最大次数 ${maxReconnectAttempts})`)
        }
      }

      ws.onerror = () => {
        setError('WebSocket 连接错误')
      }
    }, [token, urlBuilder, messageGuard, startHeartbeat, clearTimers, maxReconnectDelay, maxReconnectAttempts])

    React.useEffect(() => {
      closedByUnmount.current = false
      if (token) {
        connect()
      } else {
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        setConnected(false)
      }

      return () => {
        closedByUnmount.current = true
        clearTimers()
        if (wsRef.current) {
          try {
            wsRef.current.close()
          } catch {
            /* ignore */
          }
          wsRef.current = null
        }
        setConnected(false)
      }
    }, [token, connect, clearTimers])

    const send = React.useCallback((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data)
      }
    }, [])

    const close = React.useCallback(() => {
      closedByUnmount.current = true
      clearTimers()
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          /* ignore */
        }
        wsRef.current = null
      }
      setConnected(false)
    }, [clearTimers])

    return { send, close, isConnected, lastMessage, error }
  }
}
