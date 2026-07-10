'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'

export type AIWSProvider = 'qwen' | 'zhipu' | 'deepseek' | 'doubao' | 'generic'

const PROVIDER_PATHS: Record<AIWSProvider, string> = {
  qwen: '/cozeZhsApi/ws/qwen/stream',
  zhipu: '/cozeZhsApi/ws/zhipu/stream',
  deepseek: '/cozeZhsApi/ws/chatdeepseek/stream',
  doubao: '/cozeZhsApi/ws/doubao/streamDou',
  generic: '/api/v1/ai/capabilities/ws/stream',
}

export interface AIWSMessage {
  type: string
  data?: unknown
  [key: string]: unknown
}

export interface UseAIWebSocketReturn {
  send: (data: unknown) => void
  close: () => void
  isConnected: boolean
  lastMessage: AIWSMessage | null
  error: Event | null
}

/** 类型守卫:判断解析后的对象是否符合 AIWSMessage 结构 */
function isAIWSMessage(v: unknown): v is AIWSMessage {
  if (typeof v !== 'object' || v === null) return false
  const t = (v as { type?: unknown }).type
  return typeof t === 'string'
}

function buildWsUrl(provider: AIWSProvider, token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = PROVIDER_PATHS[provider]
  return `${proto}//${window.location.host}${path}?token=${encodeURIComponent(token)}`
}

/**
 * AI 厂商 WebSocket 客户端。
 *
 * 功能:
 * - 根据 provider 连接对应 WS 端点(qwen/zhipu/deepseek/doubao/generic)
 * - 自动附加 JWT token
 * - 心跳:30s 一次 ping
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 消息类型守卫:仅符合 AIWSMessage 结构的消息才会被推送
 *
 * 用法:
 *   const { send, isConnected, lastMessage } = useAIWebSocket('qwen')
 */
export function useAIWebSocket(provider: AIWSProvider): UseAIWebSocketReturn {
  const token = useAuthStore((s) => s.token)
  const [isConnected, setConnected] = React.useState(false)
  const [lastMessage, setLastMessage] = React.useState<AIWSMessage | null>(null)
  const [error, setError] = React.useState<Event | null>(null)

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

  const startHeartbeat = React.useCallback((ws: WebSocket) => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
    heartbeatTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }))
        } catch {
          /* 心跳发送失败,等待 onclose 触发重连 */
        }
      }
    }, 30000)
  }, [])

  const connect = React.useCallback(() => {
    if (!token || closedByUnmount.current) return

    const ws = new WebSocket(buildWsUrl(provider, token))
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempt.current = 0
      setConnected(true)
      setError(null)
      startHeartbeat(ws)
    }

    ws.onmessage = (event) => {
      if (event.data === 'pong' || event.data === '"pong"') return
      try {
        const msg = JSON.parse(event.data) as unknown
        if (!isAIWSMessage(msg)) return
        if (msg.type === 'pong') return
        setLastMessage(msg)
      } catch {
        /* 非法 JSON 忽略 */
      }
    }

    ws.onclose = () => {
      setConnected(false)
      clearTimers()
      if (!closedByUnmount.current && token) {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000)
        reconnectAttempt.current += 1
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = (e) => {
      setError(e)
    }
  }, [provider, token, clearTimers, startHeartbeat])

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
  }, [token, provider, connect, clearTimers])

  const send = React.useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
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
