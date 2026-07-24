/**
 * WebSocket 通知客户端(共享 hook,各端通用)。
 *
 * 使用共享层 @ihui/api-client 的 WebSocketClient(框架无关),
 * 此处仅做 React hook 薄包装,由各端注入自己的 token 获取函数和 baseUrl。
 *
 * 功能:
 * - 登录后自动连接 ws://host/ws/notifications?token=<access_token>
 * - 心跳:30s ping,服务端回 pong
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 组件卸载时关闭连接
 * - token 变化(登录/登出)自动重连
 *
 * 用法:在已登录的组件中调用
 * `const { connected, lastMessage } = useNotificationWebSocket(token, config)`
 */
import { useEffect, useRef, useState } from 'react'
import {
  createNotificationClient,
  type WebSocketClient,
  type WSNotification,
} from '@ihui/api-client'

export interface UseWebSocketReturn {
  /** 当前连接状态 */
  connected: boolean
  /** 最近收到的通知(每次更新触发依赖重渲染) */
  lastMessage: WSNotification | null
}

export interface NotificationWebSocketConfig {
  baseUrl: string
  tokenProvider: () => string | null
}

export function useNotificationWebSocket(
  token: string | null,
  config: NotificationWebSocketConfig,
): UseWebSocketReturn {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WSNotification | null>(null)
  const clientRef = useRef<WebSocketClient<WSNotification> | null>(null)

  useEffect(() => {
    if (!token) return

    const client = createNotificationClient(
      {
        baseUrl: config.baseUrl,
        tokenProvider: config.tokenProvider,
      },
      {
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
        onMessage: (msg) => setLastMessage(msg),
      },
    )
    clientRef.current = client
    client.connect()

    return () => {
      client.disconnect()
      clientRef.current = null
    }
  }, [token, config.baseUrl, config.tokenProvider])

  return { connected, lastMessage }
}
