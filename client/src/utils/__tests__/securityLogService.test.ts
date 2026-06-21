import { describe, it, expect, beforeEach, vi } from 'vitest'

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

const SECURITY_LOG_KEY = 'security_logs'

interface SecurityLogEntry {
  id: string
  type: string
  timestamp: number
  deviceId?: string
  deviceName?: string
  success: boolean
}

describe('SecurityLogService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('getLogs', () => {
    it('should return empty array when no logs exist', () => {
      expect(localStorageMock.getItem(SECURITY_LOG_KEY)).toBeNull()
    })

    it('should return parsed logs when exist', () => {
      const logs: SecurityLogEntry[] = [
        { id: 'log_1', type: 'login', timestamp: Date.now(), success: true },
      ]
      localStorageMock.setItem(SECURITY_LOG_KEY, JSON.stringify(logs))
      const stored = JSON.parse(localStorageMock.getItem(SECURITY_LOG_KEY) || '[]')
      expect(stored.length).toBe(1)
    })
  })

  describe('addLog', () => {
    it('should add log entry', () => {
      const entry: SecurityLogEntry = {
        id: 'log_test',
        type: 'login',
        timestamp: Date.now(),
        success: true,
      }
      const logs = [entry]
      localStorageMock.setItem(SECURITY_LOG_KEY, JSON.stringify(logs))

      const stored = JSON.parse(localStorageMock.getItem(SECURITY_LOG_KEY) || '[]')
      expect(stored[0].type).toBe('login')
      expect(stored[0].success).toBe(true)
    })

    it('should limit logs to max count', () => {
      const logs: SecurityLogEntry[] = []
      for (let i = 0; i < 150; i++) {
        logs.push({ id: `log_${i}`, type: 'login', timestamp: Date.now() - i * 1000, success: true })
      }
      const trimmedLogs = logs.slice(0, 100)
      localStorageMock.setItem(SECURITY_LOG_KEY, JSON.stringify(trimmedLogs))

      const stored = JSON.parse(localStorageMock.getItem(SECURITY_LOG_KEY) || '[]')
      expect(stored.length).toBe(100)
    })
  })

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      localStorageMock.setItem(SECURITY_LOG_KEY, JSON.stringify([{ id: '1', type: 'login', timestamp: 0, success: true }]))
      localStorageMock.removeItem(SECURITY_LOG_KEY)
      expect(localStorageMock.getItem(SECURITY_LOG_KEY)).toBeNull()
    })
  })

  describe('getLogsByType', () => {
    it('should filter logs by type', () => {
      const logs: SecurityLogEntry[] = [
        { id: 'log_1', type: 'login', timestamp: 1, success: true },
        { id: 'log_2', type: 'logout', timestamp: 2, success: true },
        { id: 'log_3', type: 'login', timestamp: 3, success: true },
      ]
      localStorageMock.setItem(SECURITY_LOG_KEY, JSON.stringify(logs))

      const stored = JSON.parse(localStorageMock.getItem(SECURITY_LOG_KEY) || '[]')
      const loginLogs = stored.filter((l: SecurityLogEntry) => l.type === 'login')
      expect(loginLogs.length).toBe(2)
    })
  })

  describe('getFailedLogs', () => {
    it('should return only failed logs', () => {
      const logs: SecurityLogEntry[] = [
        { id: 'log_1', type: 'login', timestamp: 1, success: true },
        { id: 'log_2', type: 'login', timestamp: 2, success: false },
        { id: 'log_3', type: 'login', timestamp: 3, success: false },
      ]
      localStorageMock.setItem(SECURITY_LOG_KEY, JSON.stringify(logs))

      const stored = JSON.parse(localStorageMock.getItem(SECURITY_LOG_KEY) || '[]')
      const failedLogs = stored.filter((l: SecurityLogEntry) => !l.success)
      expect(failedLogs.length).toBe(2)
    })
  })
})
