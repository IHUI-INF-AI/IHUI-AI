'use client'

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useNotificationStore } from '@/stores/notification'
import { useAuthStore } from '@/stores/auth'
import { useWebSocket } from '@/hooks/use-websocket'
import { getUnreadCount } from '@/lib/notification-api'

export interface UseGlobalNotificationReturn {
  unreadCount: number
  unreadMessageCount: number
  visible: boolean
  setVisible: (v: boolean) => void
  markAllRead: () => void
  clearAll: () => void
}

/**
 * 全局通知 Hook
 *
 * 在应用层订阅 WebSocket 推送，将通知写入 notification store，
 * 并提供未读计数与通知面板开关。
 *
 * 登录后挂载时调用 getUnreadCount() 初始化未读角标,避免 WS 推送前角标始终为 0。
 */
export function useGlobalNotification(): UseGlobalNotificationReturn {
  // 性能修复(2026-07-25):5 个 notificationStore selector 合并为 1 个 useShallow,
  // 减少订阅器数量;actions 引用稳定,useShallow 浅比较不触发重渲染
  const { unreadCount, unreadMessageCount, handleWsMessage, markAllRead, clearAll, setUnreadCounts } =
    useNotificationStore(
      useShallow((s) => ({
        unreadCount: s.unreadCount,
        unreadMessageCount: s.unreadMessageCount,
        handleWsMessage: s.handleWsMessage,
        markAllRead: s.markAllAsRead,
        clearAll: s.clearAll,
        setUnreadCounts: s.setUnreadCounts,
      })),
    )
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [visible, setVisible] = React.useState(false)

  const { lastMessage } = useWebSocket()

  React.useEffect(() => {
    handleWsMessage(lastMessage)
  }, [lastMessage, handleWsMessage])

  // 登录后从 API 初始化未读计数(仅一次,避免角标在 WS 推送前为 0)
  React.useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    getUnreadCount()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return
        setUnreadCounts({
          notifications: res.data.notification ?? 0,
          messages: res.data.message ?? 0,
        })
      })
      .catch(() => {
        // 静默失败:接口不可用时不影响 UI
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setUnreadCounts])

  return { unreadCount, unreadMessageCount, visible, setVisible, markAllRead, clearAll }
}
