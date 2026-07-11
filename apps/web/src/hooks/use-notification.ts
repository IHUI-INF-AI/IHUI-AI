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

const NON_NOTIFICATION_TYPES = ['ai_response', 'chat_message']

export function useNotification(): UseNotificationReturn {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const notificationsRef = React.useRef(notifications)
  notificationsRef.current = notifications
  const { lastMessage } = useWebSocket()

  React.useEffect(() => {
    if (!lastMessage) return
    const data: WSNotification['data'] = lastMessage.data
    if (NON_NOTIFICATION_TYPES.includes(data.type)) return
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
  }, [lastMessage])

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const markAsRead = React.useCallback(async (id: string) => {
    const prev = notificationsRef.current
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)))
    const res = await fetchApi(`/api/notifications/${id}/read`, { method: 'POST' })
    if (!res.success) setNotifications(prev)
  }, [])

  const clearAll = React.useCallback(async () => {
    const prev = notificationsRef.current
    setNotifications([])
    const res = await fetchApi('/api/notifications', { method: 'DELETE' })
    if (!res.success) setNotifications(prev)
  }, [])

  return { notifications, unreadCount, markAsRead, clearAll }
}
