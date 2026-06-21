import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  InputValidator,
  getDefaultLoginDuration,
  createAbortController,
  cancelRequest,
  getCachedData,
  setCachedData,
  clearCachedData,
  isLoginExpired,
  isDemoMode,
  registerCleanup,
} from '../api-helpers'
import { setTimeout as customSetTimeout, clearTimeout as customClearTimeout } from '../api-helpers'

describe('api-helpers', () => {
  describe('InputValidator', () => {
    it('isEmail - 应该验证邮箱', () => {
      expect(InputValidator.isEmail('test@example.com')).toBe(true)
      expect(InputValidator.isEmail('user.name@domain.org')).toBe(true)
      expect(InputValidator.isEmail('invalid')).toBe(false)
      expect(InputValidator.isEmail('test@')).toBe(false)
      expect(InputValidator.isEmail('@example.com')).toBe(false)
      expect(InputValidator.isEmail('')).toBe(false)
    })

    it('isPhone - 应该验证手机号', () => {
      expect(InputValidator.isPhone('13800138000')).toBe(true)
      expect(InputValidator.isPhone('19900199000')).toBe(true)
      expect(InputValidator.isPhone('11000000000')).toBe(false)
      expect(InputValidator.isPhone('12345')).toBe(false)
      expect(InputValidator.isPhone('')).toBe(false)
    })

    it('isRequired - 应该验证必填', () => {
      expect(InputValidator.isRequired('test')).toBe(true)
      expect(InputValidator.isRequired('  ')).toBe(false)
      expect(InputValidator.isRequired('')).toBe(false)
      expect(InputValidator.isRequired(0)).toBe(true)
      expect(InputValidator.isRequired(null)).toBe(false)
      expect(InputValidator.isRequired(undefined)).toBe(false)
      expect(InputValidator.isRequired(false)).toBe(true)
    })

    it('minLength - 应该验证最小长度', () => {
      expect(InputValidator.minLength('12345', 3)).toBe(true)
      expect(InputValidator.minLength('12', 3)).toBe(false)
      expect(InputValidator.minLength('123', 3)).toBe(true)
    })

    it('maxLength - 应该验证最大长度', () => {
      expect(InputValidator.maxLength('12', 3)).toBe(true)
      expect(InputValidator.maxLength('123', 3)).toBe(true)
      expect(InputValidator.maxLength('1234', 3)).toBe(false)
    })
  })

  describe('getDefaultLoginDuration', () => {
    it('应该返回7天的毫秒数', () => {
      expect(getDefaultLoginDuration()).toBe(7 * 24 * 60 * 60 * 1000)
      expect(getDefaultLoginDuration()).toBe(604800000)
    })
  })

  describe('createAbortController', () => {
    it('应该创建AbortController实例', () => {
      const controller = createAbortController()
      expect(controller).toBeInstanceOf(AbortController)
      expect(controller.signal).toBeDefined()
      expect(controller.signal.aborted).toBe(false)
    })
  })

  describe('cancelRequest', () => {
    it('应该中止控制器', () => {
      const controller = createAbortController()
      expect(controller.signal.aborted).toBe(false)
      cancelRequest(controller)
      expect(controller.signal.aborted).toBe(true)
    })
  })

  describe('缓存功能', () => {
    beforeEach(() => {
      clearCachedData()
    })

    it('setCachedData/getCachedData - 应该存取数据', () => {
      setCachedData('key1', { value: 123 })
      const data = getCachedData('key1')
      expect(data).toEqual({ value: 123 })
    })

    it('getCachedData - 应该对不存在的key返回null', () => {
      expect(getCachedData('nonexistent')).toBeNull()
    })

    it('clearCachedData - 应该清除指定key', () => {
      setCachedData('key1', 'value1')
      setCachedData('key2', 'value2')
      clearCachedData('key1')
      expect(getCachedData('key1')).toBeNull()
      expect(getCachedData('key2')).toBe('value2')
    })

    it('clearCachedData - 无参数应该清除所有', () => {
      setCachedData('key1', 'value1')
      setCachedData('key2', 'value2')
      clearCachedData()
      expect(getCachedData('key1')).toBeNull()
      expect(getCachedData('key2')).toBeNull()
    })
  })

  describe('isLoginExpired', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('没有login_time应该返回true', () => {
      expect(isLoginExpired()).toBe(true)
    })

    it('未过期的登录应该返回false', () => {
      localStorage.setItem('login_time', String(Date.now()))
      expect(isLoginExpired()).toBe(false)
    })

    it('已过期的登录应该返回true', () => {
      const expired = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8天前
      localStorage.setItem('login_time', String(expired))
      expect(isLoginExpired()).toBe(true)
    })
  })

  describe('isDemoMode', () => {
    it('应该返回布尔值', () => {
      expect(typeof isDemoMode()).toBe('boolean')
    })
  })

  describe('registerCleanup', () => {
    it('应该注册beforeunload事件监听器', () => {
      const fn = vi.fn()
      const cleanup = registerCleanup(fn)
      expect(typeof cleanup).toBe('function')
      // 触发清理函数应该移除监听器
      cleanup()
    })
  })

  describe('setTimeout/clearTimeout', () => {
    it('应该设置和清除超时', () => {
      const fn = vi.fn()
      const id = customSetTimeout(fn, 100)
      expect(id).toBeDefined()
      customClearTimeout(id)
    })
  })
})
