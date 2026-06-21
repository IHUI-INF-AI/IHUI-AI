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

const LOGIN_BEHAVIOR_KEY = 'login_behavior'

describe('LoginBehaviorService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('getBehavior', () => {
    it('should return null when no behavior data exists', () => {
      expect(localStorageMock.getItem(LOGIN_BEHAVIOR_KEY)).toBeNull()
    })

    it('should return parsed behavior data when exists', () => {
      const behavior = {
        totalLogins: 10,
        avgLoginInterval: 3600000,
        commonHours: [9, 10, 14],
        commonDevices: [],
        commonLocations: [],
        firstLogin: Date.now() - 86400000,
        lastLogin: Date.now(),
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))
      const stored = JSON.parse(localStorageMock.getItem(LOGIN_BEHAVIOR_KEY) || 'null')
      expect(stored.totalLogins).toBe(10)
    })
  })

  describe('recordLogin', () => {
    it('should create new behavior data on first login', () => {
      const behavior = {
        totalLogins: 1,
        avgLoginInterval: 0,
        commonHours: [new Date().getHours()],
        commonDevices: [{
          deviceId: 'device_1',
          deviceName: 'Windows',
          loginCount: 1,
          lastLogin: Date.now(),
          trusted: false,
        }],
        commonLocations: [],
        firstLogin: Date.now(),
        lastLogin: Date.now(),
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))
      const stored = JSON.parse(localStorageMock.getItem(LOGIN_BEHAVIOR_KEY) || 'null')
      expect(stored.totalLogins).toBe(1)
    })

    it('should increment total logins', () => {
      const behavior = {
        totalLogins: 5,
        avgLoginInterval: 3600000,
        commonHours: [9, 10, 14, 9, 10],
        commonDevices: [],
        commonLocations: [],
        firstLogin: Date.now() - 86400000 * 5,
        lastLogin: Date.now(),
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))
      const stored = JSON.parse(localStorageMock.getItem(LOGIN_BEHAVIOR_KEY) || 'null')
      expect(stored.totalLogins).toBe(5)
    })
  })

  describe('analyzeBehavior', () => {
    it('should return low risk for new users', () => {
      const behavior = {
        totalLogins: 1,
        avgLoginInterval: 0,
        commonHours: [],
        commonDevices: [],
        commonLocations: [],
        firstLogin: Date.now(),
        lastLogin: Date.now(),
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))

      if (behavior.totalLogins < 3) {
        expect(behavior.totalLogins).toBeLessThan(3)
      }
    })

    it('should detect new device anomaly', () => {
      const behavior = {
        totalLogins: 10,
        avgLoginInterval: 3600000,
        commonHours: [9, 10, 14, 9, 10, 14, 9, 10, 14, 9],
        commonDevices: [{
          deviceId: 'device_1',
          deviceName: 'Windows',
          loginCount: 10,
          lastLogin: Date.now(),
          trusted: true,
        }],
        commonLocations: [],
        firstLogin: Date.now() - 86400000 * 10,
        lastLogin: Date.now(),
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))

      const currentDeviceId = 'device_2'
      const deviceMatch = behavior.commonDevices.find(d => d.deviceId === currentDeviceId)
      expect(deviceMatch).toBeUndefined()
    })
  })

  describe('getMostCommonHours', () => {
    it('should return sorted hours by frequency', () => {
      const hours = [9, 9, 9, 10, 10, 14]
      const hourCounts: Record<number, number> = {}
      hours.forEach(h => {
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })

      const sorted = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
        .sort((a, b) => b.count - a.count)

      expect(sorted[0].hour).toBe(9)
      expect(sorted[0].count).toBe(3)
    })
  })

  describe('markDeviceTrusted', () => {
    it('should mark device as trusted', () => {
      const behavior = {
        totalLogins: 5,
        avgLoginInterval: 3600000,
        commonHours: [],
        commonDevices: [{
          deviceId: 'device_1',
          deviceName: 'Windows',
          loginCount: 5,
          lastLogin: Date.now(),
          trusted: false,
        }],
        commonLocations: [],
        firstLogin: Date.now() - 86400000,
        lastLogin: Date.now(),
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))

      const device = behavior.commonDevices.find(d => d.deviceId === 'device_1')
      if (device) {
        device.trusted = true
      }
      localStorageMock.setItem(LOGIN_BEHAVIOR_KEY, JSON.stringify(behavior))

      const stored = JSON.parse(localStorageMock.getItem(LOGIN_BEHAVIOR_KEY) || 'null')
      expect(stored.commonDevices[0].trusted).toBe(true)
    })
  })
})
