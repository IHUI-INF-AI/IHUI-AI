/**
 * WebSocket 通知客户端(extension 端,popup/sidepanel 共享)。
 *
 * 使用共享层 @ihui/api-client 的 WebSocketClient(框架无关),
 * 此处仅做 React hook 薄包装,注入 extension 的 token 获取函数和 baseUrl。
 *
 * MV3 注意:background service worker 会被休眠,长连接 WS 不可靠。
 * 此 hook 应在 sidepanel/popup 页面内使用(页面存活期间 WS 有效)。
 * background 如需通知,用 chrome.alarms 轮询 getUnreadCount HTTP API 兜底。
 *
 * 用法:在已登录的组件中调用 `const { connected, lastMessage } = useNotificationWebSocket(token)`
 */
import { useEffect, useRef, useState } from 'react'
import {
  createNotificationClient,
  type WebSocketClient,
  type WSNotification,
} from '@ihui/api-client'
import { getToken } from './token'
import { API_BASE_URL } from './config'

export interface UseWebSocketReturn {
  /** 当前连接状态 */
  connected: boolean
  /** 最近收到的通知(每次更新触发依赖重渲染) */
  lastMessage: WSNotification | null
}

export function useNotificationWebSocket(token: string | null): UseWebSocketReturn {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WSNotification | null>(null)
  const clientRef = useRef<WebSocketClient<WSNotification> | null>(null)

  useEffect(() => {
    if (!token) return

    const client = createNotificationClient(
      {
        baseUrl: API_BASE_URL,
        tokenProvider: () => getToken(),
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
  }, [token])

  return { connected, lastMessage }
}
