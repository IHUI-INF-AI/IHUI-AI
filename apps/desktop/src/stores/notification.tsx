import { createContext, useContext, useState, type ReactNode } from 'react'
import type { WSNotification } from '@ihui/api-client'

interface NotificationEntry {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

interface NotificationState {
  notifications: NotificationEntry[]
  unreadCount: number
  visible: boolean
  addFromWs: (msg: WSNotification | null) => void
  markAllRead: () => void
  setVisible: (v: boolean) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationState | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [visible, setVisible] = useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const addFromWs = (msg: WSNotification | null) => {
    if (!msg || msg.type !== 'notification' || !msg.data) return
    const d = msg.data
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
    const entry: NotificationEntry = {
      id: str(d.id) ?? `${Date.now()}`,
      type: d.type,
      title: str(d.title) ?? (d.type === 'ai_response' ? 'AI 回复' : '新通知'),
      content:
        str(d.content) ?? str((d as { message?: { content?: string } }).message?.content) ?? '',
      isRead: false,
      createdAt: str(d.createdAt) ?? new Date().toISOString(),
    }
    setNotifications((prev) => [entry, ...prev].slice(0, 100))
  }

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))

  const clearAll = () => setNotifications([])

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, visible, addFromWs, markAllRead, setVisible, clearAll }}
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
