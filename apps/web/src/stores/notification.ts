import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { WSNotification } from '@/hooks/use-websocket'
import type { NotificationItem, MessageItem } from '@/lib/notification-api'
import { transformWsNotification } from '@ihui/shared/notifications/ws-notification-adapter'
import type { WsNotificationLike } from '@ihui/shared/notifications/ws-notification-adapter'

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
  /** 从 API 初始化未读计数(挂载时调用,避免角标在 WS 推送前始终为 0) */
  setUnreadCounts: (counts: { notifications: number; messages: number }) => void
  /** 处理 useWebSocket 推送的消息，按 data.type 路由 */
  handleWsMessage: (msg: WSNotification | null) => void
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
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
      return {
        messages,
        unreadMessageCount: Math.max(0, s.unreadMessageCount - (decremented ? 1 : 0)),
      }
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  setUnreadCounts: (counts) =>
    set({ unreadCount: counts.notifications, unreadMessageCount: counts.messages }),

  handleWsMessage: (msg) => {
    const entry = transformWsNotification(msg as unknown as WsNotificationLike)
    if (entry) {
      useNotificationStore.getState().addNotification(entry as NotificationItem)
    }
  },
    }),
    {
      name: 'ihui-notification',
      partialize: (s) => ({ unreadCount: s.unreadCount, unreadMessageCount: s.unreadMessageCount }),
    },
  ),
)
