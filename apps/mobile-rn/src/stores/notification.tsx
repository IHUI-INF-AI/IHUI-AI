import { createContext, useContext, useState, type ReactNode } from 'react'
import type { WSNotification } from '@ihui/api-client'
import { transformWsNotification } from '@ihui/shared/notifications/ws-notification-adapter'
import type { BaseNotificationEntry, WsNotificationLike } from '@ihui/shared/notifications/ws-notification-adapter'

type NotificationEntry = BaseNotificationEntry

interface NotificationState {
  connected: boolean
  notifications: NotificationEntry[]
  unreadCount: number
  visible: boolean
  setConnected: (v: boolean) => void
  addFromWs: (msg: WSNotification | null) => void
  markAllRead: () => void
  setVisible: (v: boolean) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationState | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [visible, setVisible] = useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const addFromWs = (msg: WSNotification | null) => {
    const entry = transformWsNotification(msg as unknown as WsNotificationLike)
    if (entry) {
      setNotifications((prev) => [entry, ...prev].slice(0, 100))
    }
  }

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))

  const clearAll = () => setNotifications([])

  return (
    <NotificationContext.Provider
      value={{
        connected,
        notifications,
        unreadCount,
        visible,
        setConnected,
        addFromWs,
        markAllRead,
        setVisible,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationStore(): NotificationState {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotificationStore must be used within NotificationProvider')
  return ctx
}
