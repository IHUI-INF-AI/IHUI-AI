'use client'

import * as React from 'react'

import { useWebSocket, type WSNotification } from '@/hooks/use-websocket'
import { fetchApi } from '@/lib/api'

export interface NotificationItem {
  id: string
  type: string
  title: string
  content?: string
  read: boolean
  createdAt: string
}

export interface UseNotificationReturn {
  notifications: NotificationItem[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  requestDesktopPermission: () => Promise<boolean>
  desktopPermission: NotificationPermission | 'unsupported'
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
}

const NON_NOTIFICATION_TYPES = ['ai_response', 'chat_message']

const DESKTOP_NOTIFICATION_KEY = 'ihui-desktop-notification-enabled'
const SOUND_NOTIFICATION_KEY = 'ihui-notification-sound-enabled'

function isDesktopNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DESKTOP_NOTIFICATION_KEY) === '1'
}

function setDesktopNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) localStorage.setItem(DESKTOP_NOTIFICATION_KEY, '1')
  else localStorage.removeItem(DESKTOP_NOTIFICATION_KEY)
}

function isSoundNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SOUND_NOTIFICATION_KEY) === '1'
}

function setSoundNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  if (enabled) localStorage.setItem(SOUND_NOTIFICATION_KEY, '1')
  else localStorage.removeItem(SOUND_NOTIFICATION_KEY)
}

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

function playNotificationSound(): void {
  const AudioContextCtor = getAudioContextCtor()
  if (!AudioContextCtor) return
  try {
    const ctx = new AudioContextCtor()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.15)
    oscillator.onended = () => {
      ctx.close().catch(() => {})
    }
  } catch {
    // 自动播放策略拦截或 AudioContext 不可用,静默
  }
}

export function useNotification(): UseNotificationReturn {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [desktopPermission, setDesktopPermission] = React.useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const [soundEnabled, setSoundEnabledState] = React.useState<boolean>(() =>
    isSoundNotificationEnabled(),
  )
  const notificationsRef = React.useRef(notifications)
  notificationsRef.current = notifications
  const { lastMessage } = useWebSocket()

  const setSoundEnabled = React.useCallback((enabled: boolean) => {
    setSoundNotificationEnabled(enabled)
    setSoundEnabledState(enabled)
  }, [])

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
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    try {
      const perm = await Notification.requestPermission()
      setDesktopPermission(perm)
      if (perm === 'granted') setDesktopNotificationEnabled(true)
      else setDesktopNotificationEnabled(false)
      return perm === 'granted'
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (!lastMessage) return
    const data: WSNotification['data'] = lastMessage.data
    if (NON_NOTIFICATION_TYPES.includes(data.type)) return

    const title = String(data.title ?? '新通知')
    const content = data.content ? String(data.content) : undefined

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      isDesktopNotificationEnabled() &&
      document.visibilityState === 'hidden'
    ) {
      try {
        new Notification(title, {
          body: content ?? '',
          icon: '/favicon.ico',
        })
      } catch {
        // 通知 API 失败静默(部分浏览器在 iframe 中受限)
      }
    }

    if (isSoundNotificationEnabled()) {
      playNotificationSound()
    }

    setNotifications((prev) => [
      {
        id: String(data.id ?? Date.now()),
        type: data.type,
        title,
        content,
        read: false,
        createdAt: String(data.createdAt ?? new Date().toISOString()),
      },
      ...prev,
    ])
  }, [lastMessage])

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const markAsRead = React.useCallback(async (id: string) => {
    const prev = notificationsRef.current
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)))
    // 后端 PATCH /api/notifications/:id/read (notifications.ts:176)
    const res = await fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' })
    if (!res.success) setNotifications(prev)
  }, [])

  const clearAll = React.useCallback(async () => {
    const prev = notificationsRef.current
    setNotifications([])
    const res = await fetchApi('/api/notifications', { method: 'DELETE' })
    if (!res.success) setNotifications(prev)
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
