// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { useNotificationStore } from '@/stores/notification'
import { useAuthStore } from '@/stores/auth'
import { useWebSocket } from '@/hooks/use-websocket'
import { getUnreadCount } from '@ihui/api-client'
import {
  isSoundNotificationEnabled,
  playNotificationSound,
  showDesktopNotification,
} from '@ihui/shared/notifications/notification-store'
import type { WSNotification } from '@ihui/types'

/** agent.action 是 AI 控制指令;ai_response/chat_message 由各自面板消费 */
const NON_NOTIFICATION_TYPES = new Set(['ai_response', 'chat_message', 'agent.action'])

/** 去重窗口上限:只防同一条通知被多个订阅面各呈现一次,不做长期去重 */
const PRESENTED_LIMIT = 200
const presentedIds = new Set<string>()

/**
 * 通知呈现(桌面通知 + 提示音)的单一入口。
 *
 * 2026-11-07(P1 深挖修复):此前呈现逻辑只写在 `useNotification`,而该 hook 仅由通知设置页
 * 挂载 ⇒ 用户开启桌面通知/提示音后,只有停留在设置页时才会真正弹出/发声,其余页面收到的
 * WS 通知只进 store 不呈现。现在由全局 WS 消费面调用本函数,并按 id 去重,避免设置页与全局
 * 面同时挂载时重复弹窗/双声。
 */
export function presentIncomingNotification(data: WSNotification['data'] | null | undefined): void {
  if (!data || NON_NOTIFICATION_TYPES.has(data.type)) return

  const rawId = data.id
  if (rawId !== undefined && rawId !== null && String(rawId).trim()) {
    const id = String(rawId).trim()
    if (presentedIds.has(id)) return
    if (presentedIds.size >= PRESENTED_LIMIT) {
      const oldest = presentedIds.values().next().value
      if (oldest !== undefined) presentedIds.delete(oldest)
    }
    presentedIds.add(id)
  }

  showDesktopNotification(
    String(data.title ?? '新通知'),
    data.content ? String(data.content) : undefined,
  )
  if (isSoundNotificationEnabled()) playNotificationSound()
}

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [visible, setVisible] = React.useState(false)

  const { lastMessage } = useWebSocket()

  React.useEffect(() => {
    handleWsMessage(lastMessage)
    // 全局唯一呈现面:桌面通知/提示音不能在"通知设置页"才生效(此前只挂在 useNotification)
    presentIncomingNotification(lastMessage?.data)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
