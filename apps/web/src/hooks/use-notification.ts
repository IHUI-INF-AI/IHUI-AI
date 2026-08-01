'use client'

/**
 * Web 端通知 hook(2026-07-25 迁移到 shared notification-store)。
 *
 * 架构:
 * - 状态管理(notifications + unreadCount + markAsRead + clearAll):本地 useState,
 *   因 web 端未集成 NotificationProvider(Provider 在 layout 中包裹属后续工作,不在本任务范围)。
 * - 桌面通知 + 声音播放 + 权限请求:全部委托给 shared 纯函数
 *   (@ihui/shared/notifications/notification-store 的 SSR 安全 utils),
 *   实现单一事实源 + 跨端复用。
 * - WS 订阅 + AudioContext 解锁:web 独占逻辑,保留在本 hook 中。
 */

import * as React from 'react'

import { useWebSocket, type WSNotification } from '@/hooks/use-websocket'
import { fetchApi } from '@/lib/api'
import type { NotificationItem } from '@ihui/types'
import {
  getDesktopPermission,
  isSoundNotificationEnabled,
  playNotificationSound,
  requestDesktopNotificationPermission,
  setSoundNotificationEnabled,
  showDesktopNotification,
  type DesktopPermission,
} from '@ihui/shared/notifications/notification-store'

export type { NotificationItem }

export interface UseNotificationReturn {
  notifications: NotificationItem[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  requestDesktopPermission: () => Promise<boolean>
  desktopPermission: DesktopPermission
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
}

const NON_NOTIFICATION_TYPES = ['ai_response', 'chat_message']

type AudioContextCtor = typeof AudioContext
type WindowWithAudioContext = {
  AudioContext?: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as WindowWithAudioContext
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function useNotification(): UseNotificationReturn {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [desktopPermission, setDesktopPermission] = React.useState<DesktopPermission>(() =>
    getDesktopPermission(),
  )
  const [soundEnabled, setSoundEnabledState] = React.useState<boolean>(() =>
    isSoundNotificationEnabled(),
  )
  const notificationsRef = React.useRef(notifications)
  notificationsRef.current = notifications
  const mountedRef = React.useRef(true)
  const { lastMessage } = useWebSocket()

  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setSoundEnabled = React.useCallback((enabled: boolean) => {
    setSoundNotificationEnabled(enabled)
    setSoundEnabledState(enabled)
  }, [])

  // AudioContext 解锁:首次用户交互(click/touchstart)后 resume suspended context,
  // 避免后续播放提示音被浏览器自动播放策略拦截。web 独占,不迁移到 shared。
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const unlock = (): void => {
      const AudioContextCtor = getAudioContextCtor()
      if (!AudioContextCtor) return
      try {
        const ctx = new AudioContextCtor()
        if (ctx.state === 'suspended') ctx.resume().catch(() => {})
        ctx.close().catch(() => {})
      } catch {
        // 忽略解锁失败
      }
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  const requestDesktopPermission = React.useCallback(async (): Promise<boolean> => {
    const ok = await requestDesktopNotificationPermission()
    if (!mountedRef.current) return ok
    setDesktopPermission(getDesktopPermission())
    return ok
  }, [])

  React.useEffect(() => {
    if (!lastMessage) return
    const data: WSNotification['data'] = lastMessage.data
    if (NON_NOTIFICATION_TYPES.includes(data.type)) return

    const title = String(data.title ?? '新通知')
    const content = data.content ? String(data.content) : undefined

    // 桌面通知 + 声音播放委托给 shared SSR 安全纯函数
    showDesktopNotification(title, content)
    if (isSoundNotificationEnabled()) playNotificationSound()

    setNotifications((prev) => [
      {
        id: String(data.id ?? Date.now()),
        type: data.type,
        title,
        content,
        isRead: false,
        createdAt: String(data.createdAt ?? new Date().toISOString()),
      },
      ...prev,
    ])
  }, [lastMessage])

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  )

  const markAsRead = React.useCallback(async (id: string) => {
    // 2026-08-02 修复:用 ref 同步读取快照,回滚时只撤销该 id 的 isRead,
    // 不覆盖整个数组(避免丢失乐观更新与回滚之间到达的新 WS 通知)
    const snapshot = notificationsRef.current
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    // 后端 PATCH /api/notifications/:id/read (notifications.ts:176)
    const res = await fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' })
    if (!mountedRef.current) return
    if (!res.success) {
      const original = snapshot.find((s) => s.id === id)
      if (original) {
        setNotifications((current) =>
          current.map((n) => (n.id === id ? { ...n, isRead: original.isRead } : n)),
        )
      }
    }
  }, [])

  const clearAll = React.useCallback(async () => {
    // 2026-08-02 修复:回滚时把被清空的通知 prepend 回来,按 id 去重避免覆盖新通知
    const snapshot = notificationsRef.current
    setNotifications([])
    const res = await fetchApi('/api/notifications', { method: 'DELETE' })
    if (!mountedRef.current) return
    if (!res.success) {
      setNotifications((current) => {
        const existingIds = new Set(current.map((n) => n.id))
        const restored = snapshot.filter((n) => !existingIds.has(n.id))
        return [...restored, ...current]
      })
    }
  }, [])

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    requestDesktopPermission,
    desktopPermission,
    soundEnabled,
    setSoundEnabled,
  }
}
