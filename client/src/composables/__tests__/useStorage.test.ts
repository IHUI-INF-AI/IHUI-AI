import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('useStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('defaultSerializer', () => {
    it('应该序列化和反序列化JSON', async () => {
      const { defaultSerializer } = await import('../useStorage')
      const obj = { a: 1, b: 'test' }
      const serialized = defaultSerializer.write(obj)
      expect(defaultSerializer.read(serialized)).toEqual(obj)
    })

    it('应该返回原始字符串当JSON解析失败', async () => {
      const { defaultSerializer } = await import('../useStorage')
      expect(defaultSerializer.read('not json')).toBe('not json')
    })
  })

  describe('useLocalStorage', () => {
    it('应该返回默认值当存储为空', async () => {
      const { useLocalStorage } = await import('../useStorage')
      const value = useLocalStorage('test-key', 'default')
      expect(value.value).toBe('default')
    })

    it('应该返回存储的值', async () => {
      localStorage.setItem('test-key', JSON.stringify('stored'))
      const { useLocalStorage } = await import('../useStorage')
      const value = useLocalStorage('test-key', 'default')
      expect(value.value).toBe('stored')
    })

    it('应该更新存储值', async () => {
      const { useLocalStorage } = await import('../useStorage')
      const value = useLocalStorage('test-key', 'default')
      value.value = 'updated'
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'))
    })
  })

  describe('useSessionStorage', () => {
    it('应该返回默认值当存储为空', async () => {
      const { useSessionStorage } = await import('../useStorage')
      const value = useSessionStorage('test-key', 'default')
      expect(value.value).toBe('default')
    })

    it('应该返回存储的值', async () => {
      sessionStorage.setItem('test-key', JSON.stringify('stored'))
      const { useSessionStorage } = await import('../useStorage')
      const value = useSessionStorage('test-key', 'default')
      expect(value.value).toBe('stored')
    })

    it('应该更新存储值', async () => {
      const { useSessionStorage } = await import('../useStorage')
      const value = useSessionStorage('test-key', 'default')
      value.value = 'updated'
      expect(sessionStorage.getItem('test-key')).toBe(JSON.stringify('updated'))
    })
  })

  describe('useStorage', () => {
    it('应该使用自定义存储', async () => {
      const customStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      const { useStorage } = await import('../useStorage')
      const value = useStorage(customStorage, 'test-key', 'default')
      expect(value.value).toBe('default')
    })

    it('应该支持防抖保存', async () => {
      vi.useFakeTimers()
      const { useStorage } = await import('../useStorage')
      const value = useStorage(localStorage, 'test-key', 'default', undefined, { watchDebounce: 100 })
      value.value = 'updated'
      vi.advanceTimersByTime(50)
      expect(localStorage.getItem('test-key')).toBe(null)
      vi.advanceTimersByTime(50)
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'))
      vi.useRealTimers()
    })
  })

  describe('removeStorageItem', () => {
    it('应该删除存储项', async () => {
      localStorage.setItem('test-key', 'value')
      const { removeStorageItem } = await import('../useStorage')
      removeStorageItem('test-key')
      expect(localStorage.getItem('test-key')).toBe(null)
    })
  })

  describe('clearStorage', () => {
    it('应该清空存储', async () => {
      localStorage.setItem('test-key1', 'value1')
      localStorage.setItem('test-key2', 'value2')
      const { clearStorage } = await import('../useStorage')
      clearStorage()
      expect(localStorage.length).toBe(0)
    })
  })

  describe('getStorageKeys', () => {
    it('应该返回所有键', async () => {
      localStorage.setItem('key1', 'value1')
      localStorage.setItem('key2', 'value2')
      const { getStorageKeys } = await import('../useStorage')
      const keys = getStorageKeys()
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
    })
  })
})
