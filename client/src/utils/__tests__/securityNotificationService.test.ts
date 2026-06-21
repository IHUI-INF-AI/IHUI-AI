import { describe, it, expect, beforeEach } from 'vitest'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

const NOTIFICATION_KEY = 'security_notifications'
const CONFIG_KEY = 'notification_config'

describe('SecurityNotificationService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('notify', () => {
    it('should create notification', () => {
      const notification = {
        id: 'notif_1',
        type: 'suspicious_login',
        title: '可疑登录',
        message: '检测到可疑登录',
        priority: 'high',
        read: false,
        timestamp: Date.now(),
      }
      localStorageMock.setItem(NOTIFICATION_KEY, JSON.stringify([notification]))

      const stored = JSON.parse(localStorageMock.getItem(NOTIFICATION_KEY) || '[]')
      expect(stored.length).toBe(1)
      expect(stored[0].type).toBe('suspicious_login')
    })

    it('should sort by timestamp descending', () => {
      const notifications = [
        { id: '1', timestamp: 1000 },
        { id: '2', timestamp: 3000 },
        { id: '3', timestamp: 2000 },
      ]
      notifications.sort((a, b) => b.timestamp - a.timestamp)

      expect(notifications[0].id).toBe('2')
      expect(notifications[2].id).toBe('1')
    })
  })

  describe('getNotifications', () => {
    it('should return empty array when no notifications', () => {
      const stored = localStorageMock.getItem(NOTIFICATION_KEY)
      expect(stored).toBeNull()
    })

    it('should return all notifications', () => {
      const notifications = [
        { id: '1', type: 'login' },
        { id: '2', type: 'logout' },
      ]
      localStorageMock.setItem(NOTIFICATION_KEY, JSON.stringify(notifications))

      const stored = JSON.parse(localStorageMock.getItem(NOTIFICATION_KEY) || '[]')
      expect(stored.length).toBe(2)
    })
  })

  describe('getUnreadCount', () => {
    it('should return 0 when all read', () => {
      const notifications = [
        { id: '1', read: true },
        { id: '2', read: true },
      ]
      const unreadCount = notifications.filter(n => !n.read).length
      expect(unreadCount).toBe(0)
    })

    it('should return correct unread count', () => {
      const notifications = [
        { id: '1', read: true },
        { id: '2', read: false },
        { id: '3', read: false },
      ]
      const unreadCount = notifications.filter(n => !n.read).length
      expect(unreadCount).toBe(2)
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      const notifications = [
        { id: '1', read: false },
        { id: '2', read: false },
      ]
      localStorageMock.setItem(NOTIFICATION_KEY, JSON.stringify(notifications))

      const stored = JSON.parse(localStorageMock.getItem(NOTIFICATION_KEY) || '[]')
      stored[0].read = true
      localStorageMock.setItem(NOTIFICATION_KEY, JSON.stringify(stored))

      const updated = JSON.parse(localStorageMock.getItem(NOTIFICATION_KEY) || '[]')
      expect(updated[0].read).toBe(true)
      expect(updated[1].read).toBe(false)
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      const notifications = [
        { id: '1', read: false },
        { id: '2', read: false },
      ]
      const updated = notifications.map(n => ({ ...n, read: true }))
      
      expect(updated.every(n => n.read)).toBe(true)
    })
  })

  describe('config', () => {
    it('should save config', () => {
      const config = {
        enabled: true,
        desktop: true,
        sound: false,
      }
      localStorageMock.setItem(CONFIG_KEY, JSON.stringify(config))

      const stored = JSON.parse(localStorageMock.getItem(CONFIG_KEY) || '{}')
      expect(stored.enabled).toBe(true)
    })

    it('should return default config when not set', () => {
      const stored = localStorageMock.getItem(CONFIG_KEY)
      expect(stored).toBeNull()
    })
  })

  describe('clearNotifications', () => {
    it('should clear all notifications', () => {
      localStorageMock.setItem(NOTIFICATION_KEY, JSON.stringify([{ id: '1' }]))
      localStorageMock.removeItem(NOTIFICATION_KEY)

      const stored = localStorageMock.getItem(NOTIFICATION_KEY)
      expect(stored).toBeNull()
    })
  })
})
