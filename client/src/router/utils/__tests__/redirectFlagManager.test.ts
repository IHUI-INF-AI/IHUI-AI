import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RedirectFlagManager, redirectFlagManager, setRedirectFlag, hasRedirectFlag, getRedirectFlag, clearRedirectFlag, hasAnyRedirectFlag, clearAllRedirectFlags } from '../redirectFlagManager'

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('redirectFlagManager', () => {
  let manager: RedirectFlagManager

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new RedirectFlagManager()
  })

  afterEach(() => {
    manager.destroy()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('RedirectFlagManager', () => {
    describe('setFlag', () => {
      it('应该设置标志', () => {
        manager.setFlag('test-key', 'test-value', 10000)
        expect(manager.hasFlag('test-key')).toBe(true)
      })

      it('应该使用默认值', () => {
        manager.setFlag('test-key')
        expect(manager.getFlag('test-key')).toBe('true')
      })

      it('应该使用默认TTL', () => {
        manager.setFlag('test-key', 'test-value')
        expect(manager.hasFlag('test-key')).toBe(true)
      })
    })

    describe('hasFlag', () => {
      it('应该返回true当标志存在时', () => {
        manager.setFlag('test-key', 'test-value', 10000)
        expect(manager.hasFlag('test-key')).toBe(true)
      })

      it('应该返回false当标志不存在时', () => {
        expect(manager.hasFlag('non-existent')).toBe(false)
      })

      it('应该返回false当标志已过期时', () => {
        manager.setFlag('test-key', 'test-value', 100)
        vi.advanceTimersByTime(200)
        expect(manager.hasFlag('test-key')).toBe(false)
      })
    })

    describe('getFlag', () => {
      it('应该返回标志值', () => {
        manager.setFlag('test-key', 'test-value', 10000)
        expect(manager.getFlag('test-key')).toBe('test-value')
      })

      it('应该返回null当标志不存在时', () => {
        expect(manager.getFlag('non-existent')).toBeNull()
      })

      it('应该返回null当标志已过期时', () => {
        manager.setFlag('test-key', 'test-value', 100)
        vi.advanceTimersByTime(200)
        expect(manager.getFlag('test-key')).toBeNull()
      })
    })

    describe('clearFlag', () => {
      it('应该清除标志', () => {
        manager.setFlag('test-key', 'test-value', 10000)
        manager.clearFlag('test-key')
        expect(manager.hasFlag('test-key')).toBe(false)
      })
    })

    describe('clearAllFlags', () => {
      it('应该清除所有标志', () => {
        manager.setFlag('key1', 'value1', 10000)
        manager.setFlag('key2', 'value2', 10000)
        manager.clearAllFlags()
        expect(manager.hasFlag('key1')).toBe(false)
        expect(manager.hasFlag('key2')).toBe(false)
      })
    })

    describe('clearExpiredFlags', () => {
      it('应该清除过期标志', () => {
        manager.setFlag('expired-key', 'value', 100)
        manager.setFlag('valid-key', 'value', 10000)
        vi.advanceTimersByTime(200)
        manager.clearExpiredFlags()
        expect(manager.hasFlag('expired-key')).toBe(false)
        expect(manager.hasFlag('valid-key')).toBe(true)
      })
    })

    describe('getValidFlags', () => {
      it('应该返回所有有效标志', () => {
        manager.setFlag('key1', 'value1', 10000)
        manager.setFlag('key2', 'value2', 100)
        vi.advanceTimersByTime(200)
        const validFlags = manager.getValidFlags()
        expect(validFlags.length).toBe(1)
        expect(validFlags[0].key).toBe('key1')
      })
    })

    describe('hasAnyRedirectFlag', () => {
      it('应该返回true当存在重定向标志时', () => {
        manager.setFlag('__redirecting_test', 'true', 10000)
        expect(manager.hasAnyRedirectFlag()).toBe(true)
      })

      it('应该返回false当不存在重定向标志时', () => {
        manager.setFlag('other-key', 'true', 10000)
        expect(manager.hasAnyRedirectFlag()).toBe(false)
      })

      it('应该支持自定义前缀', () => {
        manager.setFlag('custom_test', 'true', 10000)
        expect(manager.hasAnyRedirectFlag('custom_')).toBe(true)
      })
    })

    describe('getRedirectFlags', () => {
      it('应该返回所有重定向标志', () => {
        manager.setFlag('__redirecting_test1', 'true', 10000)
        manager.setFlag('__redirecting_test2', 'true', 10000)
        manager.setFlag('other-key', 'true', 10000)
        const redirectFlags = manager.getRedirectFlags()
        expect(redirectFlags.length).toBe(2)
      })
    })

    describe('clearRedirectFlags', () => {
      it('应该清除所有重定向标志', () => {
        manager.setFlag('__redirecting_test', 'true', 100)
        vi.advanceTimersByTime(200)
        manager.clearRedirectFlags()
        expect(manager.hasFlag('__redirecting_test')).toBe(false)
      })
    })

    describe('getStats', () => {
      it('应该返回正确的统计信息', () => {
        manager.setFlag('key1', 'value1', 10000)
        manager.setFlag('key2', 'value2', 100)
        manager.setFlag('__redirecting_test', 'true', 10000)
        vi.advanceTimersByTime(200)
        
        const stats = manager.getStats()
        expect(stats.totalFlags).toBe(3)
        expect(stats.validFlags).toBe(2)
        expect(stats.expiredFlags).toBe(1)
        expect(stats.redirectFlags).toBe(1)
      })
    })

    describe('stopCleanup', () => {
      it('应该停止定期清理', () => {
        manager.stopCleanup()
        manager.setFlag('test-key', 'value', 100)
        vi.advanceTimersByTime(10000)
        expect(manager.hasFlag('test-key')).toBe(false)
      })
    })

    describe('destroy', () => {
      it('应该销毁管理器', () => {
        manager.setFlag('test-key', 'value', 10000)
        manager.destroy()
        expect(manager.hasFlag('test-key')).toBe(false)
      })
    })
  })

  describe('便捷函数', () => {
    beforeEach(() => {
      redirectFlagManager.clearAllFlags()
    })

    afterEach(() => {
      redirectFlagManager.clearAllFlags()
    })

    describe('setRedirectFlag', () => {
      it('应该设置重定向标志', () => {
        setRedirectFlag('test-key', 'test-value', 10000)
        expect(hasRedirectFlag('test-key')).toBe(true)
      })
    })

    describe('hasRedirectFlag', () => {
      it('应该检查重定向标志', () => {
        setRedirectFlag('test-key', 'test-value', 10000)
        expect(hasRedirectFlag('test-key')).toBe(true)
        expect(hasRedirectFlag('non-existent')).toBe(false)
      })
    })

    describe('getRedirectFlag', () => {
      it('应该获取重定向标志值', () => {
        setRedirectFlag('test-key', 'test-value', 10000)
        expect(getRedirectFlag('test-key')).toBe('test-value')
      })
    })

    describe('clearRedirectFlag', () => {
      it('应该清除重定向标志', () => {
        setRedirectFlag('test-key', 'test-value', 10000)
        clearRedirectFlag('test-key')
        expect(hasRedirectFlag('test-key')).toBe(false)
      })
    })

    describe('hasAnyRedirectFlag', () => {
      it('应该检查是否存在任何重定向标志', () => {
        setRedirectFlag('__redirecting_test', 'true', 10000)
        expect(hasAnyRedirectFlag()).toBe(true)
      })
    })

    describe('clearAllRedirectFlags', () => {
      it('应该清除所有重定向标志', () => {
        setRedirectFlag('__redirecting_test', 'true', 100)
        vi.advanceTimersByTime(200)
        clearAllRedirectFlags()
        expect(hasAnyRedirectFlag()).toBe(false)
      })
    })
  })
})
