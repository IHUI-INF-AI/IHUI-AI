import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SecureStorageManager, setSecureItem, getSecureItem, removeSecureItem } from '../secureStorage'

describe('secureStorage.ts', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  describe('SecureStorageManager', () => {
    describe('setItem/getItem', () => {
      it('应该存储和获取普通数据', () => {
        SecureStorageManager.setItem('test-key', { name: 'test' })
        const result = SecureStorageManager.getItem<{ name: string }>('test-key')
        expect(result).toEqual({ name: 'test' })
      })

      it('应该存储和获取加密数据', () => {
        SecureStorageManager.setItem('secret-key', { token: 'abc123' }, { encrypt: true })
        const result = SecureStorageManager.getItem<{ token: string }>('secret-key')
        expect(result).toEqual({ token: 'abc123' })
      })

      it('加密数据应该无法直接读取', () => {
        SecureStorageManager.setItem('secret-key', 'sensitive-data', { encrypt: true })
        const raw = localStorage.getItem('secret-key')
        expect(raw).not.toContain('sensitive-data')
      })

      it('过期数据应该返回null', () => {
        SecureStorageManager.setItem('expiring-key', 'data', { expiresIn: -1000 })
        const result = SecureStorageManager.getItem('expiring-key')
        expect(result).toBeNull()
      })

      it('不存在的key应该返回null', () => {
        const result = SecureStorageManager.getItem('non-existent')
        expect(result).toBeNull()
      })
    })

    describe('setSessionItem/getSessionItem', () => {
      it('应该存储到sessionStorage', () => {
        SecureStorageManager.setSessionItem('session-key', { data: 'test' })
        const result = SecureStorageManager.getSessionItem<{ data: string }>('session-key')
        expect(result).toEqual({ data: 'test' })
      })

      it('应该支持加密存储', () => {
        SecureStorageManager.setSessionItem('secret-session', 'data', { encrypt: true })
        const result = SecureStorageManager.getSessionItem('secret-session')
        expect(result).toBe('data')
      })
    })

    describe('removeItem', () => {
      it('应该移除数据', () => {
        SecureStorageManager.setItem('to-remove', 'data')
        SecureStorageManager.removeItem('to-remove')
        expect(SecureStorageManager.getItem('to-remove')).toBeNull()
      })
    })

    describe('clearAll', () => {
      it('应该清除所有存储', () => {
        SecureStorageManager.setItem('key1', 'value1')
        SecureStorageManager.setSessionItem('key2', 'value2')
        SecureStorageManager.clearAll()
        expect(localStorage.length).toBe(0)
        expect(sessionStorage.length).toBe(0)
      })
    })

    describe('clearSensitiveData', () => {
      it('应该清除敏感数据', () => {
        localStorage.setItem('user_token', 'token123')
        localStorage.setItem('user_password', 'pass123')
        localStorage.setItem('normal_data', 'normal')
        SecureStorageManager.clearSensitiveData()
        expect(localStorage.getItem('user_token')).toBeNull()
        expect(localStorage.getItem('user_password')).toBeNull()
        expect(localStorage.getItem('normal_data')).toBe('normal')
      })
    })

    describe('isEncrypted', () => {
      it('应该检测加密数据', () => {
        SecureStorageManager.setItem('encrypted', 'data', { encrypt: true })
        expect(SecureStorageManager.isEncrypted('encrypted')).toBe(true)
      })

      it('应该检测非加密数据', () => {
        SecureStorageManager.setItem('plain', 'data')
        expect(SecureStorageManager.isEncrypted('plain')).toBe(false)
      })
    })
  })

  describe('便捷函数', () => {
    it('setSecureItem/getSecureItem应该正确工作', () => {
      setSecureItem('test', { secret: 'data' })
      const result = getSecureItem<{ secret: string }>('test')
      expect(result).toEqual({ secret: 'data' })
    })

    it('removeSecureItem应该正确工作', () => {
      setSecureItem('to-remove', 'data')
      removeSecureItem('to-remove')
      expect(getSecureItem('to-remove')).toBeNull()
    })
  })
})
