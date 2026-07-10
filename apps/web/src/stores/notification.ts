import { create } from 'zustand'

import type { WSNotification } from '@/hooks/use-websocket'
import type { NotificationItem, MessageItem } from '@/lib/user-api'

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  messages: MessageItem[]
  unreadMessageCount: number
  setNotifications: (items: NotificationItem[]) => void
  addNotification: (item: NotificationItem) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  setMessages: (messages: MessageItem[]) => void
  addMessage: (msg: MessageItem) => void
  markMessageAsRead: (id: string) => void
  clearAll: () => void
  /** 处理 useWebSocket 推送的消息，按 data.type 路由 */
  handleWsMessage: (msg: WSNotification | null) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  messages: [],
  unreadMessageCount: 0,

  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.isRead).length }),

  addNotification: (item) =>
    set((s) => ({
      notifications: [item, ...s.notifications],
      unreadCount: s.unreadCount + (item.isRead ? 0 : 1),
    })),

  markAsRead: (id) =>
    set((s) => {
      let decremented = false
      const notifications = s.notifications.map((n) => {
        if (n.id === id && !n.isRead) {
          decremented = true
          return { ...n, isRead: true }
        }
        return n
      })
      return { notifications, unreadCount: Math.max(0, s.unreadCount - (decremented ? 1 : 0)) }
    }),

  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  setMessages: (messages) =>
    set({ messages, unreadMessageCount: messages.filter((m) => !m.isRead).length }),

  addMessage: (msg) =>
    set((s) => ({
      messages: [msg, ...s.messages],
      unreadMessageCount: s.unreadMessageCount + (msg.isRead ? 0 : 1),
    })),

  markMessageAsRead: (id) =>
    set((s) => {
      let decremented = false
      const messages = s.messages.map((m) => {
        if (m.id === id && !m.isRead) {
          decremented = true
          return { ...m, isRead: true }
        }
        return m
      })
      return { messages, unreadMessageCount: Math.max(0, s.unreadMessageCount - (decremented ? 1 : 0)) }
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  handleWsMessage: (msg) => {
    if (!msg || msg.type !== 'notification' || !msg.data) return
    const data = msg.data
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

    useNotificationStore.getState().addNotification({
      id: str(data.id) ?? `${Date.now()}`,
      type: data.type,
      title: str(data.title) ?? (data.type === 'ai_response' ? 'AI 回复' : '新通知'),
      content: str(data.content) ?? str((data as { message?: { content?: string } }).message?.content) ?? '',
      isRead: false,
      createdAt: str(data.createdAt) ?? new Date().toISOString(),
    })
  },
}))
