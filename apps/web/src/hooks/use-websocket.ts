'use client'

import { createWebSocketHook } from '@/hooks/create-websocket-hook'

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

/** 构造 WebSocket URL(自动 ws/wss 切换,SSR 安全) */
function buildWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/notifications?token=${encodeURIComponent(token)}`
}

/** 类型守卫:判断解析后的对象是否符合 WSNotification 结构 */
function isWSNotification(data: unknown): data is WSNotification {
  if (typeof data !== 'object' || data === null) return false
  const d = data as WSNotification
  return d.type === 'notification' && !!d.data
}

const useNotificationWS = createWebSocketHook<WSNotification>({
  urlBuilder: buildWsUrl,
  messageGuard: isWSNotification,
})

export function useWebSocket(): UseWebSocketReturn {
  const ws = useNotificationWS()
  return { connected: ws.isConnected, lastMessage: ws.lastMessage }
}
