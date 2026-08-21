// Stub for @ihui/shared/notifications/notification-store - vitest mock
// Provides NotificationProvider and useNotificationStore using proper React context.
// Aligned with packages/shared/src/notifications/notification-store.tsx source.

import { createContext, useContext, useState, type ReactNode } from 'react'

export interface NotificationEntry {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

export interface NotificationState {
  connected: boolean
  notifications: NotificationEntry[]
  unreadCount: number
  visible: boolean
  setConnected: (v: boolean) => void
  addFromWs: (msg: unknown) => void
  markAllRead: () => void
  markAsRead: (id: string) => void
  setVisible: (v: boolean) => void
  clearAll: () => void
  setSoundEnabled: (v: boolean) => void
  requestDesktopPermission: () => Promise<boolean>
  triggerDesktopNotification: (title: string, body?: string, icon?: string) => void
  playSound: () => void
}

const NotificationContext = createContext<NotificationState | null>(null)

/**
 * Transform a WS notification message into a unified entry.
 * Source: packages/shared/src/notifications/ws-notification-adapter.ts
 */
function transformWsNotification(msg: unknown): NotificationEntry | null {
  if (!msg || typeof msg !== 'object') return null
  const m = msg as Record<string, unknown>
  if (m.type !== 'notification' || !m.data || typeof m.data !== 'object') return null
  const data = m.data as Record<string, unknown>
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  return {
    id: str(data.id) ?? `${Date.now()}`,
    type: typeof data.type === 'string' ? data.type : '',
    title: str(data.title) ?? (data.type === 'ai_response' ? 'AI 回复' : '新通知'),
    content:
      str(data.content) ??
      str((data.message as Record<string, unknown> | undefined)?.content) ??
      '',
    isRead: false,
    createdAt: str(data.createdAt) ?? new Date().toISOString(),
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [visible, setVisible] = useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const addFromWs = (msg: unknown) => {
    const entry = transformWsNotification(msg)
    if (entry) {
      setNotifications((prev) => [entry, ...prev].slice(0, 100))
    }
  }

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))

  const markAsRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))

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
        markAsRead,
        setVisible,
        clearAll,
        setSoundEnabled: () => {},
        requestDesktopPermission: async () => false,
        triggerDesktopNotification: () => {},
        playSound: () => {},
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
