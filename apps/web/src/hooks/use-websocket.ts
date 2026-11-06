// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useEffect, useMemo, useState } from 'react'
import { createNotificationClient, type WebSocketClient } from '@ihui/api-client'
import type { UseWebSocketReturn } from '@ihui/shared/notifications/use-notification-websocket'
import { useAuthStore } from '@/stores/auth'
import { useConversationBroadcastSync } from '@/hooks/use-conversation-broadcast-sync'
import { resolveWsApiBaseUrl } from '@/lib/api-base-url'
import type {
  WSNotification,
  AIResponseNotification,
  AIQuestionNotification,
  AIQuestionAnsweredNotification,
  ChatMessageNotification,
} from '@ihui/types'

export type {
  WSNotification,
  AIResponseNotification,
  AIQuestionNotification,
  AIQuestionAnsweredNotification,
  ChatMessageNotification,
}
export { isAIResponse, isAIQuestion, isAIQuestionAnswered, isChatMessage } from '@ihui/types'
export type { UseWebSocketReturn }

// 2026-11-07(P1 深挖修复):此前每个使用方各自调用 shared 的 useNotificationWebSocket,
// 而 createNotificationClient 每次都是 `new WebSocketClient` ⇒ 全局通知 / AI 侧栏 /
// 任务接收 / 通知设置页各开一条 /ws/notifications 长连(连票据也重复换)。
// 这里把连接收敛为模块级引用计数单例,消费方仍按 hook 形态订阅;零消费方时断开。
type MessageListener = (message: WSNotification) => void
type ConnectionListener = (connected: boolean) => void

let sharedClient: WebSocketClient<WSNotification> | null = null
let sharedToken: string | null = null
let sharedConnected = false
let consumerCount = 0

const messageListeners = new Set<MessageListener>()
const connectionListeners = new Set<ConnectionListener>()

function publishConnection(next: boolean): void {
  if (sharedConnected === next) return
  sharedConnected = next
  for (const listener of connectionListeners) listener(next)
}

function acquireClient(token: string, baseUrl: string): void {
  if (sharedClient && sharedToken === token) return
  releaseClient()
  sharedClient = createNotificationClient(
    {
      baseUrl,
      tokenProvider: () => useAuthStore.getState().token,
    },
    {
      onOpen: () => publishConnection(true),
      onClose: () => publishConnection(false),
      onMessage: (message) => {
        for (const listener of messageListeners) listener(message)
      },
    },
  )
  sharedToken = token
  sharedClient.connect()
}

function releaseClient(): void {
  if (!sharedClient) return
  sharedClient.disconnect()
  sharedClient = null
  sharedToken = null
  publishConnection(false)
}

export function useWebSocket(): UseWebSocketReturn {
  const token = useAuthStore((s) => s.token)
  const baseUrl = useMemo(() => resolveWsApiBaseUrl(), [])
  const [connected, setConnected] = useState(() => sharedConnected)
  const [lastMessage, setLastMessage] = useState<WSNotification | null>(null)

  // D153(2026-09-29 立)会话元数据的 per-user 广播消费面挂在这里,而不是新加一个
  // 组件级挂载点:本入口已被全局通知/任务接收/侧栏消费者挂载,而订阅走 api-client 的
  // 引用计数单例 ⇒ 多个消费者仍只对应**一条**设备级广播连接(票面禁止"每人一条常连")。
  useConversationBroadcastSync()

  useEffect(() => {
    if (!token) return
    consumerCount += 1
    acquireClient(token, baseUrl)

    const onMessage: MessageListener = (message) => setLastMessage(message)
    const onConnection: ConnectionListener = (next) => setConnected(next)
    messageListeners.add(onMessage)
    connectionListeners.add(onConnection)
    setConnected(sharedConnected)

    return () => {
      messageListeners.delete(onMessage)
      connectionListeners.delete(onConnection)
      consumerCount -= 1
      if (consumerCount <= 0) {
        consumerCount = 0
        releaseClient()
      }
    }
  }, [token, baseUrl])

  return { connected, lastMessage }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
