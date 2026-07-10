'use client'

import * as React from 'react'

import { useWebSocket, type WSNotification } from '@/hooks/use-websocket'
import { fetchApi } from '@/lib/api'

export interface NotificationItem {
  id: string
  type: string
  title: string
  content?: string
  read: boolean
  createdAt: string
}

export interface UseNotificationReturn {
  notifications: NotificationItem[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

/** 通知管理 Hook，集成 useWebSocket 实时推送 */
export function useNotification(): UseNotificationReturn {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const { lastMessage } = useWebSocket()

  // 接收 WebSocket 推送的通知
  React.useEffect(() => {
    if (!lastMessage) return
    const data: WSNotification['data'] = lastMessage.data
    if (data.type === 'notification') {
      setNotifications((prev) => [
        {
          id: String(data.id ?? Date.now()),
          type: data.type,
          title: String(data.title ?? '新通知'),
          content: data.content ? String(data.content) : undefined,
          read: false,
          createdAt: String(data.createdAt ?? new Date().toISOString()),
        },
        ...prev,
      ])
    }
  }, [lastMessage])

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const markAsRead = React.useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await fetchApi(`/api/notifications/${id}/read`, { method: 'POST' })
  }, [])

  const clearAll = React.useCallback(async () => {
    setNotifications([])
    await fetchApi('/api/notifications', { method: 'DELETE' })
  }, [])

  return { notifications, unreadCount, markAsRead, clearAll }
}
