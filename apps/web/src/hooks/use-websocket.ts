'use client'

import { createWebSocketHook } from '@/hooks/create-websocket-hook'
import { isWSNotification } from '@ihui/api-client'
import type { WSNotification, AIResponseNotification } from '@ihui/types'

// 类型 re-export(向后兼容:web 内部组件已从 @/hooks/use-websocket 导入这些类型)
export type { WSNotification, AIResponseNotification }
export { isAIResponse } from '@ihui/types'

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

const useNotificationWS = createWebSocketHook<WSNotification>({
  urlBuilder: buildWsUrl,
  messageGuard: isWSNotification,
})

export function useWebSocket(): UseWebSocketReturn {
  const ws = useNotificationWS()
  return { connected: ws.isConnected, lastMessage: ws.lastMessage }
}
