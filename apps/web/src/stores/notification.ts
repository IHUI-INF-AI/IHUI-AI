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
  /**
   * D195(2026-09-30 立,对标竞品 user.notifications hide→archive→restore):
   * 已隐藏(归档)的动态。隐藏=从动态流移入本分区,恢复=移回;随 localStorage
   * 持久化(partialize),前端最小路径,不新增后端接口。
   */
  archived: NotificationItem[]
  setNotifications: (items: NotificationItem[]) => void
  addNotification: (item: NotificationItem) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  /** D195:单条隐藏 → 「已归档」分区 */
  hideNotification: (id: string) => void
  /** D195:从「已归档」分区恢复回动态流 */
  restoreNotification: (id: string) => void
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
      archived: [],

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

      // D195:隐藏 = 移出动态流并进「已归档」分区;未读项随之扣减未读角标
      hideNotification: (id) =>
        set((s) => {
          const item = s.notifications.find((n) => n.id === id)
          if (!item) return s
          return {
            notifications: s.notifications.filter((n) => n.id !== id),
            archived: [item, ...s.archived],
            unreadCount: Math.max(0, s.unreadCount - (item.isRead ? 0 : 1)),
          }
        }),

      // D195:恢复 = 从「已归档」分区移回动态流(未读态保留原样)
      restoreNotification: (id) =>
        set((s) => {
          const item = s.archived.find((n) => n.id === id)
          if (!item) return s
          return {
            archived: s.archived.filter((n) => n.id !== id),
            notifications: [item, ...s.notifications],
            unreadCount: s.unreadCount + (item.isRead ? 0 : 1),
          }
        }),

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

      clearAll: () => set({ notifications: [], unreadCount: 0, archived: [] }),

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
      // D195:archived 一并持久化 —— 隐藏/恢复状态最小持久化路径(刷新后归档分区不丢)
      partialize: (s) => ({
        unreadCount: s.unreadCount,
        unreadMessageCount: s.unreadMessageCount,
        archived: s.archived,
      }),
    },
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
