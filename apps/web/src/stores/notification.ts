// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { WSNotification } from '@/hooks/use-websocket'
import type { NotificationItem, MessageItem } from '@ihui/api-client'
import { transformWsNotification } from '@ihui/shared/notifications/ws-notification-adapter'
import type { WsNotificationLike } from '@ihui/shared/notifications/ws-notification-adapter'

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  messages: MessageItem[]
  unreadMessageCount: number
  setNotifications: (items: NotificationItem[]) => void
  /**
   * 列表缓存填充(2026-11-11,侧栏消息二级菜单需要真实内容)。
   * 与 setNotifications 的差别:不按分页条目重算 unreadCount ——
   * 角标真相源是服务端 unread-count(use-global-notification 初始化),
   * 首页分页只提供"看得见的条目",不能把角标截断成单页未读数。
   */
  hydrateNotifications: (items: NotificationItem[]) => void
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

      hydrateNotifications: (items) =>
        set((s) => {
          // WS 先到但还没进分页快照的条目保留下来,按时间倒序合并去重
          const seen = new Set(items.map((n) => n.id))
          const extra = s.notifications.filter((n) => !seen.has(n.id))
          const merged = [...extra, ...items].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          return { notifications: merged }
        }),

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
