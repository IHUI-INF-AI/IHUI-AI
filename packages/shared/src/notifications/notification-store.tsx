// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { WSNotification } from '@ihui/api-client'
import {
  transformWsNotification,
  type BaseNotificationEntry,
  type WsNotificationLike,
} from './ws-notification-adapter'
import { playRingtone, readStoredRingtoneId } from './ringtone'

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
  /**
   * 通知状态翻转(2026-11-24):按服务端下发的**确切 ids** 批量投影,与 web store 同语义。
   * 只改本地已有条目、不猜不新增,id 为空整批不动;各端 active 视图自行过滤 archivedAt。
   */
  markAsReadByIds: (ids: string[]) => void
  archiveByIds: (ids: string[]) => void
  restoreByIds: (ids: string[]) => void
  deleteByIds: (ids: string[]) => void
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
function writeLocalStorage(key: string, value: '1' | '0' | null): void {
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

/**
 * 声音通知开关是否开启(持久化在 localStorage)。
 *
 * 2026-11-26 改口径:未设置 = 开启(与微信同感 —— 登录后收到新消息就该响)。
 * 显式关闭写 `'0'` 才静音;历史上"关闭即删键"的写法在新默认下会变成"开着",
 * 所以关闭必须留值,不能 removeItem。
 */
export function isSoundNotificationEnabled(): boolean {
  return readLocalStorage(SOUND_NOTIFICATION_KEY) !== '0'
}

/** 设置声音通知开关(持久化;关闭写 '0' 而不是删键,否则会被默认开启吃掉) */
export function setSoundNotificationEnabled(enabled: boolean): void {
  writeLocalStorage(SOUND_NOTIFICATION_KEY, enabled ? '1' : '0')
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

/**
 * 播放通知提示音(SSR + 浏览器自动播放策略安全)。
 *
 * 2026-11-26:不再是写死的 880Hz 短音,统一播「当前选中的铃声」
 * (真相源 notifications/ringtone.ts,8 个自制合成音;连发 1200ms 去抖在该模块内)。
 * 非 Web 端(window 不存在)或无 AudioContext 时静默 —— RN/小程序各自走原生音频。
 */
export function playNotificationSound(): void {
  playRingtone(readStoredRingtoneId())
}

/**
 * 触发一条桌面通知。
 * SSR + 权限 + 开关三重检查;页面可见时(document.visibilityState === 'visible')不弹,
 * 避免重复打扰用户(只在后台标签页时弹)。
 *
 * silent: true(2026-11-26) —— 系统通知自身会带提示音(Windows 一定会响),与我们的
 * playRingtone 叠加就是"双响"。声音只能由 ringtone 一个出口负责,系统通知一律静默。
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
      silent: true,
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

  // XUI-022:addFromWs 必须保持引用稳定(订阅 effect 依赖它),否则"收通知→setState→重渲染→
  // addFromWs 新引用→effect 重跑→再 setState"会形成无限更新环;并做 id 去重,避免同一条 WS
  // 通知因重连重放被重复插入。
  const addFromWs = useCallback((msg: WSNotification | null) => {
    const entry = transformWsNotification(msg as unknown as WsNotificationLike)
    if (!entry) return
    setNotifications((prev) => {
      if (prev.some((n) => n.id === entry.id)) return prev
      return [entry, ...prev].slice(0, 100)
    })
  }, [])

  const markAllRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true }))),
    [],
  )

  const markAsRead = useCallback(
    (id: string) =>
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))),
    [],
  )

  // 状态翻转四档(2026-11-24):只按确切 ids 改本地已有条目,不重算角标(unreadCount
  // 由 notifications 派生,自然跟着变)、不猜不新增(本地没有的 id 可能是别的视图的行)。
  // 全部引用稳定(订阅 effect 依赖),与 addFromWs 同一纪律。
  const markAsReadByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const target = new Set(ids)
    setNotifications((prev) =>
      prev.map((n) => (target.has(n.id) && !n.isRead ? { ...n, isRead: true } : n)),
    )
  }, [])

  const archiveByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const target = new Set(ids)
    const now = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => (target.has(n.id) && !n.archivedAt ? { ...n, archivedAt: now } : n)),
    )
  }, [])

  const restoreByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const target = new Set(ids)
    setNotifications((prev) =>
      prev.map((n) => (target.has(n.id) && n.archivedAt ? { ...n, archivedAt: null } : n)),
    )
  }, [])

  const deleteByIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const target = new Set(ids)
    setNotifications((prev) => prev.filter((n) => !target.has(n.id)))
  }, [])

  const clearAll = useCallback(() => setNotifications([]), [])

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundNotificationEnabled(v)
    setSoundEnabledState(v)
  }, [])

  const requestDesktopPermission = useCallback(async (): Promise<boolean> => {
    const ok = await requestDesktopNotificationPermission()
    setDesktopPermission(getDesktopPermission())
    return ok
  }, [])

  const triggerDesktopNotification = useCallback((title: string, body?: string, icon?: string) => {
    showDesktopNotification(title, body, icon)
  }, [])

  const playSound = useCallback(() => {
    if (isSoundNotificationEnabled()) playNotificationSound()
  }, [])

  const value = useMemo(
    () => ({
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
      markAsReadByIds,
      archiveByIds,
      restoreByIds,
      deleteByIds,
      setVisible,
      clearAll,
      setSoundEnabled,
      requestDesktopPermission,
      triggerDesktopNotification,
      playSound,
    }),
    [
      connected,
      notifications,
      unreadCount,
      visible,
      desktopPermission,
      soundEnabled,
      addFromWs,
      markAllRead,
      markAsRead,
      markAsReadByIds,
      archiveByIds,
      restoreByIds,
      deleteByIds,
      clearAll,
      setSoundEnabled,
      requestDesktopPermission,
      triggerDesktopNotification,
      playSound,
    ],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotificationStore(): NotificationState {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotificationStore must be used within NotificationProvider')
  return ctx
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
