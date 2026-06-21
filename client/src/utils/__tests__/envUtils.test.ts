import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isDemoMode, getEnv, isDev, isProd, getMode, isMockEnabled } from '../envUtils'

describe('envUtils', () => {
  describe('isDemoMode', () => {
    it('应该在服务端返回false', () => {
      const originalWindow = global.window
      // @ts-expect-error testing server-side
      delete global.window

      expect(isDemoMode()).toBe(false)

      global.window = originalWindow
    })

    it('应该检测URL参数', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?demo=true' },
        writable: true,
      })

      expect(isDemoMode()).toBe(true)
    })
  })

  describe('getEnv', () => {
    it('应该返回环境变量', () => {
      import.meta.env.TEST_VAR = 'test_value'
      expect(getEnv('TEST_VAR')).toBe('test_value')
    })

    it('应该返回默认值', () => {
      expect(getEnv('NON_EXISTENT', 'default')).toBe('default')
    })
  })

  describe('isDev', () => {
    it('应该返回开发环境状态', () => {
      const result = isDev()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isProd', () => {
    it('应该返回生产环境状态', () => {
      const result = isProd()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('getMode', () => {
    it('应该返回当前模式', () => {
      const mode = getMode()
      expect(typeof mode).toBe('string')
    })
  })

  describe('isMockEnabled', () => {
    it('应该在服务端返回false', () => {
      const originalWindow = global.window
      // @ts-expect-error testing server-side
      delete global.window

      expect(isMockEnabled()).toBe(false)

      global.window = originalWindow
    })
  })
})
