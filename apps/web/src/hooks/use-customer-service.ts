'use client'

import * as React from 'react'

import { createWebSocketHook } from '@/hooks/create-websocket-hook'

export type CustomerServiceMessageType = 'text' | 'image' | 'file' | 'system'

/**
 * 客服 WebSocket 实时消息格式(前端 WS 客户端用)。
 * 与 @ihui/types 的 CustomerServiceMessage(DB 持久化格式:id/sessionId/fromId/fromType/isRead/createdAt)语义不同 ——
 * 此处是 WS 网络传输格式,含 sender / timestamp / fileName / fileUrl 字段,无 sessionId / fromId / isRead 字段。
 * 命名为 CustomerServiceWSMessage 避免与 @ihui/types CustomerServiceMessage 命名冲突。
 */
export interface CustomerServiceWSMessage {
  id?: string
  type: CustomerServiceMessageType
  content: string
  sender?: 'user' | 'agent' | 'system'
  timestamp?: string
  fileName?: string
  fileUrl?: string
}

export interface UseCustomerServiceReturn {
  messages: CustomerServiceWSMessage[]
  sendMessage: (msg: Omit<CustomerServiceWSMessage, 'id' | 'timestamp'>) => void
  isConnected: boolean
  typing: boolean
}

/** 类型守卫:判断解析后的对象是否符合 CustomerServiceWSMessage 结构 */
function isCustomerServiceMessage(v: unknown): v is CustomerServiceWSMessage {
  if (typeof v !== 'object' || v === null) return false
  const t = (v as { type?: unknown }).type
  return t === 'text' || t === 'image' || t === 'file' || t === 'system'
}

function buildWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/customer-service?token=${encodeURIComponent(token)}`
}

const useCustomerServiceWS = createWebSocketHook<CustomerServiceWSMessage>({
  urlBuilder: buildWsUrl,
  messageGuard: isCustomerServiceMessage,
  heartbeatMessage: () => JSON.stringify({ type: 'ping' }),
})

/**
 * 客服 WebSocket 客户端。
 *
 * 功能:
 * - 连接客服 WS 端点 /ws/customer-service
 * - 自动附加 JWT token
 * - 心跳:30s 一次 {type:'ping'}
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 处理客服消息类型(text/image/file/system)
 * - 打字状态指示(system 消息 content='typing'/'stop_typing' 控制)
 *
 * 用法:
 *   const { messages, sendMessage, isConnected, typing } = useCustomerService()
 */
export function useCustomerService(): UseCustomerServiceReturn {
  const ws = useCustomerServiceWS()
  const [messages, setMessages] = React.useState<CustomerServiceWSMessage[]>([])
  const [typing, setTyping] = React.useState(false)
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const lastMessage = ws.lastMessage

  // 路由处理工厂推送的消息:打字状态 vs 正文消息
  React.useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'system' && lastMessage.content === 'typing') {
      setTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTyping(false), 3000)
      return
    }
    if (lastMessage.type === 'system' && lastMessage.content === 'stop_typing') {
      setTyping(false)
      if (typingTimer.current) {
        clearTimeout(typingTimer.current)
        typingTimer.current = null
      }
      return
    }
    setMessages((prev) => [...prev, lastMessage])
  }, [lastMessage])

  // 卸载时清理打字定时器(重连/心跳定时器由工厂管理)
  React.useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current)
        typingTimer.current = null
      }
    }
  }, [])

  const sendMessage = React.useCallback(
    (msg: Omit<CustomerServiceWSMessage, 'id' | 'timestamp'>) => {
      const payload: CustomerServiceWSMessage = {
        ...msg,
        timestamp: new Date().toISOString(),
      }
      ws.send(JSON.stringify(payload))
      setMessages((prev) => [...prev, payload])
    },
    [ws.send],
  )

  return {
    messages,
    sendMessage,
    isConnected: ws.isConnected,
    typing,
  }
}
