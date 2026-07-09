'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'

/**
 * WebSocket 通知客户端。
 *
 * 功能:
 * - 登录后自动连接 ws://host/ws/notifications?token=<access_token>
 * - 心跳:30s 一次 ping,服务端回 pong
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 组件卸载或登出时关闭连接
 *
 * 消息格式: { type: 'notification', data: {...} }
 * data.type 标识通知类型(ai_response / chat_message / notification 等),
 * 调用方按 data.type 路由处理。
 *
 * 用法:
 *   const { connected, lastMessage } = useWebSocket()
 *   useEffect(() => {
 *     if (lastMessage?.data?.type === 'ai_response') { ... }
 *   }, [lastMessage])
 */

export interface WSNotification {
  type: 'notification'
  data: {
    type: string // ai_response / chat_message / notification 等
    [key: string]: unknown
  }
}

/** AI 回复推送(ai_response)的具体载荷结构,由 aiCallbackWorker 推送 */
export interface AIResponseNotification {
  type: 'ai_response'
  conversationId: string
  /** 前端占位消息 UUID,前端用它匹配本地占位并替换为 DB id */
  clientMessageId?: string
  message: {
    id: string
    role: string
    content: string
    createdAt?: string
  }
}

/** 类型守卫:判断 WSNotification 是否为 ai_response 推送 */
export function isAIResponse(n: WSNotification | null): n is WSNotification & { data: AIResponseNotification } {
  return !!n && n.data?.type === 'ai_response' && !!n.data?.message
}

export interface UseWebSocketReturn {
  /** 当前连接状态 */
  connected: boolean
  /** 最近收到的通知(每次更新触发依赖重渲染) */
  lastMessage: WSNotification | null
}

/** 构造 WebSocket URL(自动 ws/wss 切换) */
function buildWsUrl(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/notifications?token=${encodeURIComponent(token)}`
}

export function useWebSocket(): UseWebSocketReturn {
  const token = useAuthStore((s) => s.token)
  const [connected, setConnected] = React.useState(false)
  const [lastMessage, setLastMessage] = React.useState<WSNotification | null>(null)

  const wsRef = React.useRef<WebSocket | null>(null)
  const reconnectAttempt = React.useRef(0)
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const closedByUnmount = React.useRef(false)

  // 清理所有定时器
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

  // 启动心跳
  const startHeartbeat = React.useCallback((ws: WebSocket) => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
    heartbeatTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send('ping')
        } catch {
          /* 心跳发送失败,等待 onclose 触发重连 */
        }
      }
    }, 30000)
  }, [])

  // 连接 WebSocket
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
      // 心跳响应
      if (event.data === 'pong') return
      try {
        const msg = JSON.parse(event.data) as WSNotification
        if (msg.type === 'notification' && msg.data) {
          setLastMessage(msg)
        }
      } catch {
        /* 非法 JSON 忽略 */
      }
    }

    ws.onclose = () => {
      setConnected(false)
      clearTimers()
      if (!closedByUnmount.current && token) {
        // 指数退避重连:1s → 2s → 4s → 8s → 16s → 30s(上限)
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000)
        reconnectAttempt.current += 1
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      // 错误后等待 onclose 触发重连,这里不额外处理
    }
  }, [token, clearTimers, startHeartbeat])

  // token 变化时建立/重建连接
  React.useEffect(() => {
    closedByUnmount.current = false
    if (token) {
      connect()
    } else {
      // 登出时关闭连接
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

  return { connected, lastMessage }
}
