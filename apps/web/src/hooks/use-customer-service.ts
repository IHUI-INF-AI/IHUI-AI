'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'

export type CustomerServiceMessageType = 'text' | 'image' | 'file' | 'system'

export interface CustomerServiceMessage {
  id?: string
  type: CustomerServiceMessageType
  content: string
  sender?: 'user' | 'agent' | 'system'
  timestamp?: string
  fileName?: string
  fileUrl?: string
}

export interface UseCustomerServiceReturn {
  messages: CustomerServiceMessage[]
  sendMessage: (msg: Omit<CustomerServiceMessage, 'id' | 'timestamp'>) => void
  isConnected: boolean
  typing: boolean
}

/** 类型守卫:判断解析后的对象是否符合 CustomerServiceMessage 结构 */
function isCustomerServiceMessage(v: unknown): v is CustomerServiceMessage {
  if (typeof v !== 'object' || v === null) return false
  const t = (v as { type?: unknown }).type
  return t === 'text' || t === 'image' || t === 'file' || t === 'system'
}

function buildWsUrl(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/customer-service?token=${encodeURIComponent(token)}`
}

/**
 * 客服 WebSocket 客户端。
 *
 * 功能:
 * - 连接客服 WS 端点 /ws/customer-service
 * - 自动附加 JWT token
 * - 心跳:30s 一次 ping
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 处理客服消息类型(text/image/file/system)
 * - 打字状态指示(system 消息 content='typing'/'stop_typing' 控制)
 *
 * 用法:
 *   const { messages, sendMessage, isConnected, typing } = useCustomerService()
 */
export function useCustomerService(): UseCustomerServiceReturn {
  const token = useAuthStore((s) => s.token)
  const [messages, setMessages] = React.useState<CustomerServiceMessage[]>([])
  const [isConnected, setConnected] = React.useState(false)
  const [typing, setTyping] = React.useState(false)

  const wsRef = React.useRef<WebSocket | null>(null)
  const reconnectAttempt = React.useRef(0)
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
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
    if (typingTimer.current) {
      clearTimeout(typingTimer.current)
      typingTimer.current = null
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

    const ws = new WebSocket(buildWsUrl(token))
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempt.current = 0
      setConnected(true)
      startHeartbeat(ws)
    }

    ws.onmessage = (event) => {
      if (event.data === 'pong' || event.data === '"pong"') return
      try {
        const msg = JSON.parse(event.data) as unknown
        if (!isCustomerServiceMessage(msg)) return
        // 打字状态指示
        if (msg.type === 'system' && msg.content === 'typing') {
          setTyping(true)
          if (typingTimer.current) clearTimeout(typingTimer.current)
          typingTimer.current = setTimeout(() => setTyping(false), 3000)
          return
        }
        if (msg.type === 'system' && msg.content === 'stop_typing') {
          setTyping(false)
          if (typingTimer.current) {
            clearTimeout(typingTimer.current)
            typingTimer.current = null
          }
          return
        }
        setMessages((prev) => [...prev, msg])
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

    ws.onerror = () => {
      /* 等待 onclose 触发重连 */
    }
  }, [token, clearTimers, startHeartbeat])

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

  const sendMessage = React.useCallback(
    (msg: Omit<CustomerServiceMessage, 'id' | 'timestamp'>) => {
      const payload: CustomerServiceMessage = {
        ...msg,
        timestamp: new Date().toISOString(),
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload))
      }
      setMessages((prev) => [...prev, payload])
    },
    [],
  )

  return { messages, sendMessage, isConnected, typing }
}
