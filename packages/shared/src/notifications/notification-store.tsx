import { createContext, useContext, useState, type ReactNode } from 'react'
import type { WSNotification } from '@ihui/api-client'
import {
  transformWsNotification,
  type BaseNotificationEntry,
  type WsNotificationLike,
} from './ws-notification-adapter'

export type NotificationEntry = BaseNotificationEntry

/**
 * 桌面通知权限状态(SSR 安全:server 端恒为 'unsupported')。
 * 与浏览器 `Notification.permission` 联合类型对齐。
 */
export type DesktopPermission = NotificationPermission | 'unsupported'

export interface NotificationState {
  connected: boolean
  notifications: NotificationEntry[]
  unreadCount: number
  visible: boolean
  /** 桌面通知权限状态(SSR 安全) */
  desktopPermission: DesktopPermission
  /** 声音通知开关(持久化到 localStorage) */
  soundEnabled: boolean
  setConnected: (v: boolean) => void
  addFromWs: (msg: WSNotification | null) => void
  markAllRead: () => void
  /** 按 ID 标记单条通知已读(2026-07-25 新增,扩展能力) */
  markAsRead: (id: string) => void
  setVisible: (v: boolean) => void
  clearAll: () => void
  /** 设置声音通知开关(同步持久化) */
  setSoundEnabled: (v: boolean) => void
  /** 请求桌面通知权限,返回是否授权成功 */
  requestDesktopPermission: () => Promise<boolean>
  /** 触发一条桌面通知(SSR + 权限 + 开关三重检查后发送) */
  triggerDesktopNotification: (title: string, body?: string, icon?: string) => void
  /** 播放通知提示音(SSR + 开关检查;内部用 AudioContext 合成短音) */
  playSound: () => void
}

const NotificationContext = createContext<NotificationState | null>(null)

/* -------------------------------------------------------------------------- */
/* 独立纯函数(非 Context 场景可用,SSR 安全)— 2026-07-25 抽出供各端复用        */
/* -------------------------------------------------------------------------- */

const DESKTOP_NOTIFICATION_KEY = 'ihui-desktop-notification-enabled'
const SOUND_NOTIFICATION_KEY = 'ihui-notification-sound-enabled'

/** SSR 安全的 localStorage 读取 */
function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** SSR 安全的 localStorage 写入 */
function writeLocalStorage(key: string, value: '1' | null): void {
  if (typeof window === 'undefined') return
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // 隐私模式或配额满,静默
  }
}

/** 桌面通知开关是否开启(持久化在 localStorage) */
export function isDesktopNotificationEnabled(): boolean {
  return readLocalStorage(DESKTOP_NOTIFICATION_KEY) === '1'
}

/** 设置桌面通知开关(持久化) */
export function setDesktopNotificationEnabled(enabled: boolean): void {
  writeLocalStorage(DESKTOP_NOTIFICATION_KEY, enabled ? '1' : null)
}

/** 声音通知开关是否开启(持久化在 localStorage) */
export function isSoundNotificationEnabled(): boolean {
  return readLocalStorage(SOUND_NOTIFICATION_KEY) === '1'
}

/** 设置声音通知开关(持久化) */
export function setSoundNotificationEnabled(enabled: boolean): void {
  writeLocalStorage(SOUND_NOTIFICATION_KEY, enabled ? '1' : null)
}

/** 当前桌面通知权限(SSR 安全:server 端返回 'unsupported') */
export function getDesktopPermission(): DesktopPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** 请求桌面通知权限(SSR 安全);授权成功时同步打开开关,失败时关闭 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  try {
    const perm = await Notification.requestPermission()
    setDesktopNotificationEnabled(perm === 'granted')
    return perm === 'granted'
  } catch {
    return false
  }
}

type AudioContextCtor = typeof AudioContext
interface WindowWithAudioContext {
  AudioContext?: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as WindowWithAudioContext
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/**
 * 播放通知提示音(SSR + 浏览器自动播放策略安全)。
 * 用 AudioContext 合成 880Hz 正弦波 150ms,避免依赖音频文件。
 * 自动播放策略拦截或 AudioContext 不可用时静默。
 */
export function playNotificationSound(): void {
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

/**
 * 触发一条桌面通知。
 * SSR + 权限 + 开关三重检查;页面可见时(document.visibilityState === 'visible')不弹,
 * 避免重复打扰用户(只在后台标签页时弹)。
 */
export function showDesktopNotification(title: string, body?: string, icon = '/favicon.ico'): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (!isDesktopNotificationEnabled()) return
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
  try {
    new Notification(title, {
      body: body ?? '',
      icon,
    })
  } catch {
    // 通知 API 失败静默(部分浏览器在 iframe 中受限)
  }
}

/* -------------------------------------------------------------------------- */
/* Context Provider                                                           */
/* -------------------------------------------------------------------------- */

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [visible, setVisible] = useState(false)
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermission>(() =>
    getDesktopPermission(),
  )
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isSoundNotificationEnabled())

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const addFromWs = (msg: WSNotification | null) => {
    const entry = transformWsNotification(msg as unknown as WsNotificationLike)
    if (entry) {
      setNotifications((prev) => [entry, ...prev].slice(0, 100))
    }
  }

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))

  const markAsRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))

  const clearAll = () => setNotifications([])

  const setSoundEnabled = (v: boolean) => {
    setSoundNotificationEnabled(v)
    setSoundEnabledState(v)
  }

  const requestDesktopPermission = async (): Promise<boolean> => {
    const ok = await requestDesktopNotificationPermission()
    setDesktopPermission(getDesktopPermission())
    return ok
  }

  const triggerDesktopNotification = (title: string, body?: string, icon?: string) => {
    showDesktopNotification(title, body, icon)
  }

  const playSound = () => {
    if (isSoundNotificationEnabled()) playNotificationSound()
  }

  return (
    <NotificationContext.Provider
      value={{
        connected,
        notifications,
        unreadCount,
        visible,
        desktopPermission,
        soundEnabled,
        setConnected,
        addFromWs,
        markAllRead,
        markAsRead,
        setVisible,
        clearAll,
        setSoundEnabled,
        requestDesktopPermission,
        triggerDesktopNotification,
        playSound,
      }}
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
