/**
 * WebSocket 通知客户端(desktop 端)。
 *
 * 使用共享层 @ihui/api-client 的 WebSocketClient(框架无关),
 * 此处仅做 React hook 薄包装,注入 desktop 的 token 获取函数和 baseUrl。
 *
 * 注意:desktop 的 getToken() 返回 string(空串=未登录),
 * 此处归一化为 null,避免空串被当作合法 token 发给服务端。
 *
 * 用法:在已登录的组件中调用 `const { connected, lastMessage } = useNotificationWebSocket(token)`
 */
import { useEffect, useRef, useState } from 'react'
import {
  createNotificationClient,
  type WebSocketClient,
  type WSNotification,
} from '@ihui/api-client'
import { getToken } from '../lib/token'

const API_BASE_URL = 'http://127.0.0.1:3002'

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
        tokenProvider: () => getToken() || null,
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
