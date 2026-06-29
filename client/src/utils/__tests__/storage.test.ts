import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StorageManager,
  SecureStorageManager,
  safeParseJson,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearStorage,
  hasStorageItem,
  STORAGE_KEYS,
} from '../storage'

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('STORAGE_KEYS', () => {
    it('应该定义存储键常量', () => {
      expect(STORAGE_KEYS.TOKEN).toBe('token')
      expect(STORAGE_KEYS.USER_TOKEN).toBe('user_token')
      expect(STORAGE_KEYS.USER_DATA).toBe('user_data')
      expect(STORAGE_KEYS.LANGUAGE).toBe('language')
      expect(STORAGE_KEYS.DARK_MODE).toBe('darkMode')
    })
  })

  describe('StorageManager', () => {
    describe('getItem', () => {
      it('应该获取字符串值', () => {
        localStorage.setItem('test', 'value')
        expect(StorageManager.getItem('test')).toBe('value')
      })

      it('应该获取并解析JSON值', () => {
        localStorage.setItem('test', JSON.stringify({ a: 1 }))
        expect(StorageManager.getItem('test')).toEqual({ a: 1 })
      })

      it('应该返回null当键不存在', () => {
        expect(StorageManager.getItem('nonexistent')).toBeNull()
      })
    })

    describe('setItem', () => {
      it('应该设置字符串值', () => {
        expect(StorageManager.setItem('test', 'value')).toBe(true)
        expect(localStorage.getItem('test')).toBe('value')
      })

      it('应该序列化并设置对象值', () => {
        expect(StorageManager.setItem('test', { a: 1 })).toBe(true)
        expect(JSON.parse(localStorage.getItem('test') || '')).toEqual({ a: 1 })
      })
    })

    describe('removeItem', () => {
      it('应该删除存储项', () => {
        localStorage.setItem('test', 'value')
        expect(StorageManager.removeItem('test')).toBe(true)
        expect(localStorage.getItem('test')).toBeNull()
      })
    })

    describe('clear', () => {
      it('应该清空所有存储', () => {
        localStorage.setItem('test1', 'value1')
        localStorage.setItem('test2', 'value2')
        expect(StorageManager.clear()).toBe(true)
        expect(localStorage.length).toBe(0)
      })
    })

    describe('hasItem', () => {
      it('应该返回true当键存在', () => {
        localStorage.setItem('test', 'value')
        expect(StorageManager.hasItem('test')).toBe(true)
      })

      it('应该返回false当键不存在', () => {
        expect(StorageManager.hasItem('nonexistent')).toBe(false)
      })
    })

    describe('getAllKeys', () => {
      it('应该返回所有键', () => {
        localStorage.setItem('test1', 'value1')
        localStorage.setItem('test2', 'value2')
        const keys = StorageManager.getAllKeys()
        expect(keys).toContain('test1')
        expect(keys).toContain('test2')
      })
    })

    describe('getItems', () => {
      it('应该批量获取存储项', () => {
        localStorage.setItem('test1', JSON.stringify({ a: 1 }))
        localStorage.setItem('test2', JSON.stringify({ b: 2 }))
        const result = StorageManager.getItems(['test1', 'test2'])
        expect(result.test1).toEqual({ a: 1 })
        expect(result.test2).toEqual({ b: 2 })
      })
    })

    describe('setItems', () => {
      it('应该批量设置存储项', () => {
        const result = StorageManager.setItems({ test1: 'value1', test2: 'value2' })
        expect(result).toBe(true)
      })

      it('应该返回false当批量设置中某项失败', () => {
        // 模拟某个 setItem 失败
        const spy = vi.spyOn(StorageManager, 'setItem').mockImplementation((key: string) => {
          if (key === 'fail') return false
          localStorage.setItem(key, 'value')
          return true
        })
        const result = StorageManager.setItems({ good: 'value', fail: 'value' })
        expect(result).toBe(false)
        spy.mockRestore()
      })
    })

    describe('错误处理', () => {
      it('getItem 在 localStorage 抛出错误时应返回 null', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = StorageManager.getItem('test')
        expect(result).toBeNull()
        spy.mockRestore()
      })

      it('setItem 在 localStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = StorageManager.setItem('test', 'value')
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('removeItem 在 localStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = StorageManager.removeItem('test')
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('clear 在 localStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = StorageManager.clear()
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('hasItem 在 localStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = StorageManager.hasItem('test')
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('getAllKeys 在 localStorage 抛出错误时应返回空数组', () => {
        const spy = vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = StorageManager.getAllKeys()
        expect(result).toEqual([])
        spy.mockRestore()
      })
    })
  })

  describe('safeParseJson', () => {
    it('应该解析有效的JSON', () => {
      expect(safeParseJson('{"a":1}', {})).toEqual({ a: 1 })
    })

    it('应该返回fallback当JSON无效', () => {
      expect(safeParseJson('invalid', { default: true })).toEqual({ default: true })
    })

    it('应该返回fallback当输入为空', () => {
      expect(safeParseJson(null, 'fallback')).toBe('fallback')
      expect(safeParseJson(undefined, 'fallback')).toBe('fallback')
      expect(safeParseJson('', 'fallback')).toBe('fallback')
    })

    it('当 forbidFunction=true 且包含function关键字时应返回fallback', () => {
      const fallback = { safe: true }
      expect(safeParseJson('function(){}', fallback, { forbidFunction: true })).toEqual(fallback)
      expect(safeParseJson('{"code":"function test(){}"}', fallback, { forbidFunction: true })).toEqual(fallback)
    })

    it('当 forbidFunction=true 但不包含function时应正常解析', () => {
      expect(safeParseJson('{"a":1}', {}, { forbidFunction: true })).toEqual({ a: 1 })
    })
  })

  describe('便捷函数', () => {
    it('getStorageItem应该工作', () => {
      localStorage.setItem('test', 'value')
      expect(getStorageItem('test')).toBe('value')
    })

    it('setStorageItem应该工作', () => {
      expect(setStorageItem('test', 'value')).toBe(true)
      expect(localStorage.getItem('test')).toBe('value')
    })

    it('removeStorageItem应该工作', () => {
      localStorage.setItem('test', 'value')
      expect(removeStorageItem('test')).toBe(true)
      expect(localStorage.getItem('test')).toBeNull()
    })

    it('clearStorage应该工作', () => {
      localStorage.setItem('test', 'value')
      expect(clearStorage()).toBe(true)
      expect(localStorage.length).toBe(0)
    })

    it('hasStorageItem应该工作', () => {
      localStorage.setItem('test', 'value')
      expect(hasStorageItem('test')).toBe(true)
      expect(hasStorageItem('nonexistent')).toBe(false)
    })
  })

  describe('SecureStorageManager', () => {
    describe('getItem', () => {
      it('应该从sessionStorage获取值', () => {
        sessionStorage.setItem('test', 'value')
        expect(SecureStorageManager.getItem('test')).toBe('value')
      })

      it('应该解析JSON值', () => {
        sessionStorage.setItem('test', JSON.stringify({ a: 1 }))
        expect(SecureStorageManager.getItem('test')).toEqual({ a: 1 })
      })

      it('应该返回null当键不存在', () => {
        expect(SecureStorageManager.getItem('nonexistent')).toBeNull()
      })
    })

    describe('setItem', () => {
      it('应该设置值到sessionStorage', () => {
        expect(SecureStorageManager.setItem('test', 'value')).toBe(true)
        expect(sessionStorage.getItem('test')).toBe('value')
      })

      it('sessionStorage.setItem 抛错时应返回 false 并进入 catch', () => {
        // 只让特定 key 抛错，避开 isAvailable 内部测试 key
        const originalSetItem = Storage.prototype.setItem
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key: string, value: string) {
          if (this === sessionStorage && key !== '__secure_storage_test__') {
            throw new Error('session setItem error')
          }
          return originalSetItem.call(this, key, value)
        })
        const result = SecureStorageManager.setItem('test', 'value')
        expect(result).toBe(false)
        spy.mockRestore()
      })
    })

    describe('removeItem', () => {
      it('应该删除sessionStorage中的项', () => {
        sessionStorage.setItem('test', 'value')
        expect(SecureStorageManager.removeItem('test')).toBe(true)
        expect(sessionStorage.getItem('test')).toBeNull()
      })

      it('sessionStorage.removeItem 抛错时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.removeItem('test')
        expect(result).toBe(false)
        spy.mockRestore()
      })
    })

    describe('clear', () => {
      it('应该清空sessionStorage', () => {
        sessionStorage.setItem('test', 'value')
        expect(SecureStorageManager.clear()).toBe(true)
        expect(sessionStorage.length).toBe(0)
      })
    })

    describe('hasItem', () => {
      it('应该检查sessionStorage中的项', () => {
        sessionStorage.setItem('test', 'value')
        expect(SecureStorageManager.hasItem('test')).toBe(true)
        expect(SecureStorageManager.hasItem('nonexistent')).toBe(false)
      })
    })

    describe('migrateFromLocalStorage', () => {
      it('应该从localStorage迁移到sessionStorage', () => {
        localStorage.setItem('test', 'value')
        expect(SecureStorageManager.migrateFromLocalStorage('test')).toBe(true)
        expect(sessionStorage.getItem('test')).toBe('value')
        expect(localStorage.getItem('test')).toBeNull()
      })

      it('应该返回false当localStorage中没有值', () => {
        expect(SecureStorageManager.migrateFromLocalStorage('nonexistent')).toBe(false)
      })

      it('应该在迁移过程中抛出错误时返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.migrateFromLocalStorage('test')
        expect(result).toBe(false)
        spy.mockRestore()
      })
    })

    describe('sessionStorage 不可用时回退到 localStorage', () => {
      // 模拟 sessionStorage 不可用 - 让其 setItem 抛出错误
      let setItemSpy: ReturnType<typeof vi.spyOn>
      beforeEach(() => {
        const originalSetItem = Storage.prototype.setItem
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key: string, value: string) {
          // 只在 sessionStorage 上抛出错误
          if (this === sessionStorage) throw new Error('unavailable')
          // localStorage 走原始逻辑
          return originalSetItem.call(this, key, value)
        })
      })

      afterEach(() => {
        setItemSpy.mockRestore()
      })

      it('getItem 应回退到 localStorage', () => {
        localStorage.setItem('test', 'value')
        expect(SecureStorageManager.getItem('test')).toBe('value')
      })

      it('setItem 应回退到 localStorage', () => {
        expect(SecureStorageManager.setItem('test', 'value')).toBe(true)
        expect(localStorage.getItem('test')).toBe('value')
      })

      it('removeItem 应回退到 localStorage', () => {
        localStorage.setItem('test', 'value')
        expect(SecureStorageManager.removeItem('test')).toBe(true)
        expect(localStorage.getItem('test')).toBeNull()
      })

      it('hasItem 应回退到 localStorage', () => {
        localStorage.setItem('test', 'value')
        expect(SecureStorageManager.hasItem('test')).toBe(true)
        expect(SecureStorageManager.hasItem('nonexistent')).toBe(false)
      })

      it('clear 在 sessionStorage 不可用时应返回 false', () => {
        expect(SecureStorageManager.clear()).toBe(false)
      })

      it('setItem 在回退到 localStorage 仍抛错时应返回 false', () => {
        // sessionStorage 抛错（已在 beforeEach 处理），且 localStorage 也抛错
        const localSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
          throw new Error('local error')
        })
        const result = SecureStorageManager.setItem('test', 'value')
        expect(result).toBe(false)
        localSpy.mockRestore()
      })

      it('removeItem 在回退到 localStorage 仍抛错时应返回 false', () => {
        // 额外让 sessionStorage.removeItem 也抛错，确保走回退路径
        const sRemoveSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function(this: Storage, key: string) {
          if (this === sessionStorage) throw new Error('session error')
          throw new Error('local error')
        })
        const result = SecureStorageManager.removeItem('test')
        expect(result).toBe(false)
        sRemoveSpy.mockRestore()
      })
    })

    describe('错误处理', () => {
      it('getItem 在 sessionStorage 抛出错误时应返回 null', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.getItem('test')
        expect(result).toBeNull()
        spy.mockRestore()
      })

      it('setItem 在 sessionStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.setItem('test', 'value')
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('removeItem 在 sessionStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.removeItem('test')
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('clear 在 sessionStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.clear()
        expect(result).toBe(false)
        spy.mockRestore()
      })

      it('hasItem 在 sessionStorage 抛出错误时应返回 false', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage error')
        })
        const result = SecureStorageManager.hasItem('test')
        expect(result).toBe(false)
        spy.mockRestore()
      })
    })
  })
})
