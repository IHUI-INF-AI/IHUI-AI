// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { useNotificationStore } from '@/stores/notification'
import { useAuthStore } from '@/stores/auth'
import { useWebSocket } from '@/hooks/use-websocket'
import { getNotifications, getUnreadCount } from '@ihui/api-client'

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
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const unreadMessageCount = useNotificationStore((s) => s.unreadMessageCount)
  const handleWsMessage = useNotificationStore((s) => s.handleWsMessage)
  const markAllRead = useNotificationStore((s) => s.markAllAsRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const setUnreadCounts = useNotificationStore((s) => s.setUnreadCounts)
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [visible, setVisible] = React.useState(false)

  const { lastMessage, connected } = useWebSocket()
  // 首连不补:角标由下方 unread-count 初始化、列表由通知面板自己的加载负责。
  // 只有"曾经连上、断开后再次连上"才补断线窗口的通知(跨 WS 重建保持)。
  const everConnected = React.useRef(false)

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

  // 断线窗口内服务端推的通知不会重放 —— 重连时拉最新页幂等补回。
  // 去重由 store 的 hydrateNotifications 按 id 承担,本层不复制判据;角标一律取
  // 服务端 unread-count 真相,不用本地条目数重算(避免把补回误算成新未读)。
  React.useEffect(() => {
    if (!connected) return
    const reconnect = everConnected.current
    everConnected.current = true
    if (!reconnect || !isAuthenticated) return
    let cancelled = false
    void (async () => {
      try {
        const [listRes, countRes] = await Promise.all([
          getNotifications({ page: 1, pageSize: 100, partition: 'active' }),
          getUnreadCount(),
        ])
        if (cancelled) return
        if (listRes.success && listRes.data) {
          hydrateNotifications(listRes.data.list ?? [])
        }
        if (countRes.success && countRes.data) {
          setUnreadCounts({
            notifications: countRes.data.notification ?? 0,
            messages: countRes.data.message ?? 0,
          })
        }
      } catch {
        // 静默失败:补拉失败不影响 UI,下次重连再试,不把失败冒充已对齐
      }
    })()
    return () => {
      cancelled = true
    }
  }, [connected, isAuthenticated, hydrateNotifications, setUnreadCounts])

  return { unreadCount, unreadMessageCount, visible, setVisible, markAllRead, clearAll }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
