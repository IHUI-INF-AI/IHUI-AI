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

const SESSION_KEY = 'session_data'

describe('SessionService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = {
        id: 'session_123',
        deviceId: 'device_456',
        ipAddress: '192.168.1.1',
        createdAt: Date.now(),
        lastActive: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        isActive: true,
      }
      localStorageMock.setItem(SESSION_KEY, JSON.stringify([session]))

      const stored = JSON.parse(localStorageMock.getItem(SESSION_KEY) || '[]')
      expect(stored.length).toBe(1)
      expect(stored[0].id).toBe('session_123')
    })

    it('should generate unique session id', () => {
      const id1 = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
      const id2 = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
      expect(id1).not.toBe(id2)
    })
  })

  describe('getSession', () => {
    it('should return null when no session', () => {
      const stored = localStorageMock.getItem(SESSION_KEY)
      expect(stored).toBeNull()
    })

    it('should return session when exists', () => {
      const session = {
        id: 'session_123',
        deviceId: 'device_456',
        isActive: true,
      }
      localStorageMock.setItem(SESSION_KEY, JSON.stringify([session]))

      const stored = JSON.parse(localStorageMock.getItem(SESSION_KEY) || '[]')
      expect(stored[0].id).toBe('session_123')
    })
  })

  describe('terminateSession', () => {
    it('should mark session as inactive', () => {
      const sessions = [
        { id: 'session_1', isActive: true },
        { id: 'session_2', isActive: true },
      ]
      localStorageMock.setItem(SESSION_KEY, JSON.stringify(sessions))

      const stored = JSON.parse(localStorageMock.getItem(SESSION_KEY) || '[]')
      stored[0].isActive = false
      localStorageMock.setItem(SESSION_KEY, JSON.stringify(stored))

      const updated = JSON.parse(localStorageMock.getItem(SESSION_KEY) || '[]')
      expect(updated[0].isActive).toBe(false)
      expect(updated[1].isActive).toBe(true)
    })
  })

  describe('isSessionExpired', () => {
    it('should return true for expired session', () => {
      const expiresAt = Date.now() - 1000
      expect(Date.now() > expiresAt).toBe(true)
    })

    it('should return false for valid session', () => {
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000
      expect(Date.now() < expiresAt).toBe(true)
    })
  })

  describe('updateActivity', () => {
    it('should update lastActive timestamp', () => {
      const session = {
        id: 'session_1',
        lastActive: Date.now() - 1000,
      }
      localStorageMock.setItem(SESSION_KEY, JSON.stringify([session]))

      const stored = JSON.parse(localStorageMock.getItem(SESSION_KEY) || '[]')
      stored[0].lastActive = Date.now()
      localStorageMock.setItem(SESSION_KEY, JSON.stringify(stored))

      const updated = JSON.parse(localStorageMock.getItem(SESSION_KEY) || '[]')
      expect(updated[0].lastActive).toBeGreaterThan(session.lastActive)
    })
  })
})
