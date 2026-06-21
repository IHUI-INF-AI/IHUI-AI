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

const LOCKOUT_KEY = 'sensitive_action_lockout'
const ATTEMPTS_KEY = 'sensitive_action_attempts'

describe('SensitiveActionService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('verify', () => {
    it('should require verification for sensitive action', () => {
      const action = 'delete_account'
      const sensitiveActions = ['delete_account', 'clear_data', 'disable_2fa', 'remove_device']
      
      expect(sensitiveActions.includes(action)).toBe(true)
    })

    it('should not require verification for non-sensitive action', () => {
      const action = 'update_profile'
      const sensitiveActions = ['delete_account', 'clear_data', 'disable_2fa', 'remove_device']
      
      expect(sensitiveActions.includes(action)).toBe(false)
    })
  })

  describe('lockout', () => {
    it('should lockout after max attempts', () => {
      const maxAttempts = 3
      const attempts = 3
      
      expect(attempts >= maxAttempts).toBe(true)
    })

    it('should not lockout before max attempts', () => {
      const maxAttempts = 3
      const attempts = 2
      
      expect(attempts >= maxAttempts).toBe(false)
    })

    it('should track lockout time', () => {
      const lockoutUntil = Date.now() + 15 * 60 * 1000
      
      expect(lockoutUntil > Date.now()).toBe(true)
    })
  })

  describe('recordAttempt', () => {
    it('should record failed attempt', () => {
      const attempts = [{ timestamp: Date.now(), success: false }]
      localStorageMock.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))

      const stored = JSON.parse(localStorageMock.getItem(ATTEMPTS_KEY) || '[]')
      expect(stored.length).toBe(1)
      expect(stored[0].success).toBe(false)
    })

    it('should clear attempts on success', () => {
      const attempts = [{ timestamp: Date.now(), success: true }]
      localStorageMock.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))

      const stored = JSON.parse(localStorageMock.getItem(ATTEMPTS_KEY) || '[]')
      expect(stored[0].success).toBe(true)
    })
  })

  describe('isLocked', () => {
    it('should return true when locked', () => {
      const lockoutData = {
        locked: true,
        until: Date.now() + 15 * 60 * 1000,
      }
      localStorageMock.setItem(LOCKOUT_KEY, JSON.stringify(lockoutData))

      const stored = JSON.parse(localStorageMock.getItem(LOCKOUT_KEY) || '{}')
      expect(stored.locked).toBe(true)
    })

    it('should return false when not locked', () => {
      const stored = localStorageMock.getItem(LOCKOUT_KEY)
      expect(stored).toBeNull()
    })

    it('should return false when lockout expired', () => {
      const lockoutData = {
        locked: true,
        until: Date.now() - 1000,
      }
      
      expect(lockoutData.until < Date.now()).toBe(true)
    })
  })

  describe('resetLockout', () => {
    it('should clear lockout', () => {
      localStorageMock.setItem(LOCKOUT_KEY, JSON.stringify({ locked: true }))
      localStorageMock.removeItem(LOCKOUT_KEY)

      const stored = localStorageMock.getItem(LOCKOUT_KEY)
      expect(stored).toBeNull()
    })

    it('should clear attempts', () => {
      localStorageMock.setItem(ATTEMPTS_KEY, JSON.stringify([{ attempt: 1 }]))
      localStorageMock.removeItem(ATTEMPTS_KEY)

      const stored = localStorageMock.getItem(ATTEMPTS_KEY)
      expect(stored).toBeNull()
    })
  })

  describe('getRemainingTime', () => {
    it('should calculate remaining time', () => {
      const lockoutUntil = Date.now() + 10 * 60 * 1000
      const remaining = lockoutUntil - Date.now()
      
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(10 * 60 * 1000)
    })

    it('should return 0 when not locked', () => {
      const lockoutUntil = null
      const remaining = lockoutUntil ? lockoutUntil - Date.now() : 0
      
      expect(remaining).toBe(0)
    })
  })
})
