import { logger } from './logger'
import type { SecurityEventType } from './securityLogService'

export interface SecurityNotification {
  id: string
  type: SecurityEventType | 'warning' | 'info'
  title: string
  message: string
  timestamp: number
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  data?: Record<string, unknown>
}

export interface NotificationConfig {
  enabled: boolean
  sound: boolean
  desktop: boolean
  email: boolean
}

type NotificationCallback = (notification: SecurityNotification) => void

const NOTIFICATIONS_KEY = 'security_notifications'
const CONFIG_KEY = 'notification_config'
const MAX_NOTIFICATIONS = 50

class NotificationManager {
  private callbacks: Set<NotificationCallback> = new Set()
  private permissionGranted: boolean = false

  constructor() {
    void this.checkPermission()
  }

  private async checkPermission(): Promise<void> {
    if (typeof window === 'undefined') return

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.permissionGranted = true
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        this.permissionGranted = permission === 'granted'
      }
    }
  }

  getConfig(): NotificationConfig {
    if (typeof window === 'undefined') {
      return { enabled: true, sound: false, desktop: true, email: false }
    }

    const stored = localStorage.getItem(CONFIG_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return { enabled: true, sound: false, desktop: true, email: false }
      }
    }
    return { enabled: true, sound: false, desktop: true, email: false }
  }

  updateConfig(config: Partial<NotificationConfig>): void {
    if (typeof window === 'undefined') return

    const current = this.getConfig()
    const updated = { ...current, ...config }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated))

    if (config.desktop) {
      void this.checkPermission()
    }
  }

  getNotifications(): SecurityNotification[] {
    if (typeof window === 'undefined') return []

    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    if (!stored) return []

    try {
      return JSON.parse(stored) as SecurityNotification[]
    } catch {
      return []
    }
  }

  getUnreadCount(): number {
    return this.getNotifications().filter(n => !n.read).length
  }

  addNotification(notification: Omit<SecurityNotification, 'id' | 'timestamp' | 'read'>): SecurityNotification {
    const fullNotification: SecurityNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      read: false,
    }

    const notifications = this.getNotifications()
    notifications.unshift(fullNotification)

    const trimmed = notifications.slice(0, MAX_NOTIFICATIONS)
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed))

    this.callbacks.forEach(cb => cb(fullNotification))

    const config = this.getConfig()
    if (config.enabled) {
      if (config.desktop && this.permissionGranted) {
        this.showDesktopNotification(fullNotification)
      }
      if (config.sound) {
        this.playNotificationSound()
      }
    }

    logger.info('[SecurityNotification] New notification', { type: notification.type, title: notification.title })
    return fullNotification
  }

  markAsRead(notificationId: string): void {
    if (typeof window === 'undefined') return

    const notifications = this.getNotifications()
    const notification = notifications.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
    }
  }

  markAllAsRead(): void {
    if (typeof window === 'undefined') return

    const notifications = this.getNotifications()
    notifications.forEach(n => n.read = true)
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
  }

  clearNotifications(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(NOTIFICATIONS_KEY)
  }

  subscribe(callback: NotificationCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  private showDesktopNotification(notification: SecurityNotification): void {
    if (!this.permissionGranted) return

    const desktopNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.priority === 'critical',
    })

    desktopNotif.onclick = () => {
      window.focus()
      desktopNotif.close()
    }
  }

  private playNotificationSound(): void {
    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // 静默处理播放失败
      })
    } catch {
      // 静默处理
    }
  }

  notifyLogin(deviceName: string, location: string): void {
    this.addNotification({
      type: 'login',
      title: '新设备登录',
      message: `您的账号在 ${deviceName} 上登录，位置：${location}`,
      priority: 'medium',
      data: { deviceName, location },
    })
  }

  notifySuspiciousLogin(reason: string): void {
    this.addNotification({
      type: 'suspicious_login',
      title: '⚠️ 可疑登录警告',
      message: reason,
      priority: 'critical',
      data: { reason },
    })
  }

  notifyPasswordChange(): void {
    this.addNotification({
      type: 'password_change',
      title: '密码已修改',
      message: '您的密码已成功修改，如非本人操作请立即联系客服',
      priority: 'high',
    })
  }

  notifyDeviceRemoved(deviceName: string): void {
    this.addNotification({
      type: 'device_remove',
      title: '设备已移除',
      message: `设备 ${deviceName} 已从您的账户中移除`,
      priority: 'medium',
      data: { deviceName },
    })
  }

  notifySecurityAlert(message: string): void {
    this.addNotification({
      type: 'warning',
      title: '安全警告',
      message,
      priority: 'high',
    })
  }
}

export const SecurityNotificationService = new NotificationManager()
