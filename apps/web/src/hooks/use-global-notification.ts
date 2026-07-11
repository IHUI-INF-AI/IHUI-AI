'use client'

import * as React from 'react'

import { useNotificationStore } from '@/stores/notification'
import { useWebSocket } from '@/hooks/use-websocket'

export interface UseGlobalNotificationReturn {
  unreadCount: number
  unreadMessageCount: number
  visible: boolean
  setVisible: (v: boolean) => void
  markAllRead: () => void
  clearAll: () => void
}

/**
 * 全局通知 Hook
 *
 * 在应用层订阅 WebSocket 推送，将通知写入 notification store，
 * 并提供未读计数与通知面板开关。
 */
export function useGlobalNotification(): UseGlobalNotificationReturn {
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const unreadMessageCount = useNotificationStore((s) => s.unreadMessageCount)
  const handleWsMessage = useNotificationStore((s) => s.handleWsMessage)
  const markAllRead = useNotificationStore((s) => s.markAllAsRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const [visible, setVisible] = React.useState(false)

  const { lastMessage } = useWebSocket()

  React.useEffect(() => {
    handleWsMessage(lastMessage)
  }, [lastMessage, handleWsMessage])

  return { unreadCount, unreadMessageCount, visible, setVisible, markAllRead, clearAll }
}
