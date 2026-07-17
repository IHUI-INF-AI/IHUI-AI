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
  requestDesktopPermission: () => Promise<boolean>
  desktopPermission: NotificationPermission | 'unsupported'
}

const NON_NOTIFICATION_TYPES = ['ai_response', 'chat_message']

const DESKTOP_NOTIFICATION_KEY = 'ihui-desktop-notification-enabled'

function isDesktopNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DESKTOP_NOTIFICATION_KEY) === '1'
}

function setDesktopNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) localStorage.setItem(DESKTOP_NOTIFICATION_KEY, '1')
  else localStorage.removeItem(DESKTOP_NOTIFICATION_KEY)
}

export function useNotification(): UseNotificationReturn {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [desktopPermission, setDesktopPermission] = React.useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const notificationsRef = React.useRef(notifications)
  notificationsRef.current = notifications
  const { lastMessage } = useWebSocket()

  const requestDesktopPermission = React.useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    try {
      const perm = await Notification.requestPermission()
      setDesktopPermission(perm)
      if (perm === 'granted') setDesktopNotificationEnabled(true)
      else setDesktopNotificationEnabled(false)
      return perm === 'granted'
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (!lastMessage) return
    const data: WSNotification['data'] = lastMessage.data
    if (NON_NOTIFICATION_TYPES.includes(data.type)) return

    const title = String(data.title ?? '新通知')
    const content = data.content ? String(data.content) : undefined

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      isDesktopNotificationEnabled() &&
      document.visibilityState === 'hidden'
    ) {
      try {
        new Notification(title, {
          body: content ?? '',
          icon: '/favicon.ico',
        })
      } catch {
        // 通知 API 失败静默(部分浏览器在 iframe 中受限)
      }
    }

    setNotifications((prev) => [
      {
        id: String(data.id ?? Date.now()),
        type: data.type,
        title,
        content,
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

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    requestDesktopPermission,
    desktopPermission,
  }
}
