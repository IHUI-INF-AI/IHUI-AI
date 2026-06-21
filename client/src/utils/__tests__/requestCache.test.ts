import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCache, defaultCache, useRequestCache } from '../requestCache'

interface MockStorage {
  store: Record<string, string>
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  get length(): number
  key(index: number): string | null
}

describe('requestCache', () => {
  let localStorageMock: MockStorage

  beforeEach(() => {
    localStorageMock = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] || null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
      removeItem(key: string) {
        delete this.store[key]
      },
      clear() {
        this.store = {} as Record<string, string>
      },
      get length() {
        return Object.keys(this.store).length
      },
      key(index: number) {
        return Object.keys(this.store)[index] || null
      },
    }

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('RequestCache', () => {
    let cache: RequestCache

    beforeEach(() => {
      cache = new RequestCache({ ttl: 1000, maxSize: 3 })
    })

    describe('set和get', () => {
      it('应该存储和获取数据', async () => {
        cache.set('/api/test', { data: 'test' })
        const result = await cache.get('/api/test')
        expect(result).toEqual({ data: 'test' })
      })

      it('应该返回null当数据不存在', async () => {
        const result = await cache.get('/api/nonexistent')
        expect(result).toBeNull()
      })

      it('应该支持带参数的请求', async () => {
        cache.set('/api/test', { data: 'test' }, { page: 1 })
        const result = await cache.get('/api/test', { page: 1 })
        expect(result).toEqual({ data: 'test' })
      })

      it('应该区分不同参数的请求', async () => {
        cache.set('/api/test', { data: 'test1' }, { page: 1 })
        cache.set('/api/test', { data: 'test2' }, { page: 2 })

        const result1 = await cache.get('/api/test', { page: 1 })
        const result2 = await cache.get('/api/test', { page: 2 })

        expect(result1).toEqual({ data: 'test1' })
        expect(result2).toEqual({ data: 'test2' })
      })
    })

    describe('has', () => {
      it('应该返回true当数据存在', () => {
        cache.set('/api/test', { data: 'test' })
        expect(cache.has('/api/test')).toBe(true)
      })

      it('应该返回false当数据不存在', () => {
        expect(cache.has('/api/nonexistent')).toBe(false)
      })
    })

    describe('delete', () => {
      it('应该删除缓存数据', async () => {
        cache.set('/api/test', { data: 'test' })
        cache.delete('/api/test')
        const result = await cache.get('/api/test')
        expect(result).toBeNull()
      })
    })

    describe('clear', () => {
      it('应该清空所有缓存', async () => {
        cache.set('/api/test1', { data: 'test1' })
        cache.set('/api/test2', { data: 'test2' })
        cache.clear()

        expect(await cache.get('/api/test1')).toBeNull()
        expect(await cache.get('/api/test2')).toBeNull()
      })
    })

    describe('wrap', () => {
      it('应该返回缓存数据当存在', async () => {
        cache.set('/api/test', { data: 'cached' })
        const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' })

        const result = await cache.wrap('/api/test', fetcher)

        expect(result).toEqual({ data: 'cached' })
        expect(fetcher).not.toHaveBeenCalled()
      })

      it('应该调用fetcher并缓存结果当不存在', async () => {
        const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' })

        const result = await cache.wrap('/api/test', fetcher)

        expect(result).toEqual({ data: 'fresh' })
        expect(fetcher).toHaveBeenCalledTimes(1)

        const cachedResult = await cache.get('/api/test')
        expect(cachedResult).toEqual({ data: 'fresh' })
      })
    })

    describe('内存缓存大小限制', () => {
      it('应该删除最旧的条目当达到最大大小', async () => {
        const memoryOnlyCache = new RequestCache({ ttl: 1000, maxSize: 3, persist: false })
        memoryOnlyCache.set('/api/test1', { data: 'test1' })
        memoryOnlyCache.set('/api/test2', { data: 'test2' })
        memoryOnlyCache.set('/api/test3', { data: 'test3' })
        memoryOnlyCache.set('/api/test4', { data: 'test4' })

        const result1 = await memoryOnlyCache.get('/api/test1')
        expect(result1).toBeNull()

        const result4 = await memoryOnlyCache.get('/api/test4')
        expect(result4).toEqual({ data: 'test4' })
      })
    })

    describe('持久化缓存', () => {
      it('应该持久化到localStorage', async () => {
        cache.set('/api/test', { data: 'test' })

        const storageKey = 'cache:api:/api/test:'
        const stored = localStorageMock.getItem(storageKey)
        expect(stored).not.toBeNull()
      })

      it('应该从localStorage恢复数据', async () => {
        const entry = {
          data: { data: 'test' },
          timestamp: Date.now(),
          ttl: 1000,
          key: 'cache:api:/api/test:',
        }
        localStorageMock.setItem('cache:api:/api/test:', JSON.stringify(entry))

        const newCache = new RequestCache({ ttl: 1000 })
        const result = await newCache.get('/api/test')
        expect(result).toEqual({ data: 'test' })
      })
    })

    describe('TTL过期', () => {
      it('应该返回null当缓存过期', async () => {
        vi.useFakeTimers()

        const shortTtlCache = new RequestCache({ ttl: 100 })
        shortTtlCache.set('/api/test', { data: 'test' })

        vi.advanceTimersByTime(200)

        const result = await shortTtlCache.get('/api/test')
        expect(result).toBeNull()

        vi.useRealTimers()
      })
    })
  })

  describe('defaultCache', () => {
    it('应该是RequestCache的实例', () => {
      expect(defaultCache).toBeInstanceOf(RequestCache)
    })
  })

  describe('useRequestCache', () => {
    it('应该返回缓存操作函数', () => {
      const { get, set, has, delete: del, clear, wrap } = useRequestCache()

      expect(typeof get).toBe('function')
      expect(typeof set).toBe('function')
      expect(typeof has).toBe('function')
      expect(typeof del).toBe('function')
      expect(typeof clear).toBe('function')
      expect(typeof wrap).toBe('function')
    })

    it('应该支持自定义选项', async () => {
      const { set, get } = useRequestCache({ ttl: 500, namespace: 'custom' })

      set('/api/test', { data: 'test' })
      const result = await get('/api/test')
      expect(result).toEqual({ data: 'test' })
    })

    it('应该支持has delete clear wrap', async () => {
      const { set, has, delete: del, clear, wrap } = useRequestCache({ persist: false })
      set('/api/a', { v: 1 })
      expect(has('/api/a')).toBe(true)
      del('/api/a')
      expect(has('/api/a')).toBe(false)
      clear()

      const fetcher = vi.fn().mockResolvedValue({ v: 2 })
      const result = await wrap('/api/b', fetcher)
      expect(result).toEqual({ v: 2 })
    })
  })

  describe('内存缓存命名空间隔离', () => {
    it('不同namespace的缓存互不干扰', async () => {
      const c1 = new RequestCache({ namespace: 'ns1', persist: false })
      const c2 = new RequestCache({ namespace: 'ns2', persist: false })

      c1.set('/api/test', { v: 1 })
      c2.set('/api/test', { v: 2 })

      expect(await c1.get('/api/test')).toEqual({ v: 1 })
      expect(await c2.get('/api/test')).toEqual({ v: 2 })
    })

    it('clear只清除当前namespace的内存', async () => {
      const c1 = new RequestCache({ namespace: 'ns1', persist: false })
      const c2 = new RequestCache({ namespace: 'ns2', persist: false })

      c1.set('/api/a', { v: 1 })
      c2.set('/api/b', { v: 2 })
      c1.clear()

      expect(await c1.get('/api/a')).toBeNull()
      expect(await c2.get('/api/b')).toEqual({ v: 2 })
    })

    it('maxSize为1时只保留最新条目', async () => {
      const c = new RequestCache({ maxSize: 1, persist: false })
      c.set('/api/a', { v: 1 })
      c.set('/api/b', { v: 2 })

      expect(await c.get('/api/a')).toBeNull()
      expect(await c.get('/api/b')).toEqual({ v: 2 })
    })
  })

  describe('内存缓存has delete', () => {
    it('has对过期数据返回false', async () => {
      vi.useFakeTimers()
      const c = new RequestCache({ ttl: 100, persist: false })
      c.set('/api/test', { v: 1 })
      vi.advanceTimersByTime(200)
      expect(c.has('/api/test')).toBe(false)
      vi.useRealTimers()
    })
  })

  describe('持久化缓存高级场景', () => {
    it('应该清除当前namespace的localStorage数据', async () => {
      const c1 = new RequestCache({ namespace: 'ns1' })
      const c2 = new RequestCache({ namespace: 'ns2' })

      c1.set('/api/a', { v: 1 })
      c2.set('/api/b', { v: 2 })

      c1.clear()

      expect(await c1.get('/api/a')).toBeNull()
      expect(await c2.get('/api/b')).toEqual({ v: 2 })
    })

    it('get遇到损坏的JSON应返回null', async () => {
      const c = new RequestCache()
      localStorageMock.setItem('cache:api:/api/bad:', '{not valid json')
      const result = await c.get('/api/bad')
      expect(result).toBeNull()
    })

    it('get遇到过期数据应自动删除', async () => {
      vi.useFakeTimers()
      const c = new RequestCache()
      c.set('/api/test', { v: 1 })
      vi.advanceTimersByTime(6 * 60 * 1000)
      const result = await c.get('/api/test')
      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it('set遇到storage满时尝试清理后重试', async () => {
      let firstCall = true
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem = vi.fn((key: string, value: string) => {
        if (firstCall) {
          firstCall = false
          throw new Error('QuotaExceeded')
        }
        return originalSetItem.call(localStorageMock, key, value)
      })

      const c = new RequestCache()
      expect(() => c.set('/api/test', { v: 1 })).not.toThrow()

      localStorageMock.setItem = originalSetItem
    })

    it('清理后仍写入失败应静默忽略', async () => {
      localStorageMock.setItem = vi.fn(() => {
        throw new Error('QuotaExceeded')
      })

      const c = new RequestCache()
      expect(() => c.set('/api/test', { v: 1 })).not.toThrow()
    })

    it('has对持久化缓存中数据返回true', () => {
      const entry = {
        data: { v: 1 },
        timestamp: Date.now(),
        ttl: 1000,
        key: 'cache:api:/api/test:',
      }
      localStorageMock.setItem('cache:api:/api/test:', JSON.stringify(entry))

      const c = new RequestCache()
      expect(c.has('/api/test')).toBe(true)
    })

    it('has对持久化缓存中过期数据返回false', () => {
      const entry = {
        data: { v: 1 },
        timestamp: Date.now() - 10000,
        ttl: 100,
        key: 'cache:api:/api/test:',
      }
      localStorageMock.setItem('cache:api:/api/test:', JSON.stringify(entry))

      const c = new RequestCache()
      expect(c.has('/api/test')).toBe(false)
    })
  })

  describe('clearExpired', () => {
    it('应该清除localStorage中过期的缓存条目', () => {
      const expiredEntry = {
        data: { v: 1 },
        timestamp: Date.now() - 10000,
        ttl: 100,
        key: 'cache:api:/api/expired:',
      }
      const validEntry = {
        data: { v: 2 },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'cache:api:/api/valid:',
      }
      const otherNamespaceEntry = {
        data: { v: 3 },
        timestamp: Date.now() - 10000,
        ttl: 100,
        key: 'cache:other:/api/test:',
      }

      localStorageMock.setItem('cache:api:/api/expired:', JSON.stringify(expiredEntry))
      localStorageMock.setItem('cache:api:/api/valid:', JSON.stringify(validEntry))
      localStorageMock.setItem('cache:other:/api/test:', JSON.stringify(otherNamespaceEntry))

      const c = new RequestCache({ namespace: 'api' })
      c.clearExpired()

      expect(localStorageMock.getItem('cache:api:/api/expired:')).toBeNull()
      expect(localStorageMock.getItem('cache:api:/api/valid:')).not.toBeNull()
    })

    it('遇到损坏JSON的条目也应被清理', () => {
      localStorageMock.setItem('cache:api:/api/bad:', '{not valid')

      const c = new RequestCache()
      c.clearExpired()

      expect(localStorageMock.getItem('cache:api:/api/bad:')).toBeNull()
    })
  })

  describe('RequestCache高级行为', () => {
    it('persist为false时get不会从持久化恢复', async () => {
      const entry = {
        data: { v: 1 },
        timestamp: Date.now(),
        ttl: 1000,
        key: 'cache:api:/api/test:',
      }
      localStorageMock.setItem('cache:api:/api/test:', JSON.stringify(entry))

      const c = new RequestCache({ persist: false })
      const result = await c.get('/api/test')
      expect(result).toBeNull()
    })

    it('persist为false时set不写入localStorage', () => {
      const c = new RequestCache({ persist: false })
      c.set('/api/test', { v: 1 })
      expect(localStorageMock.getItem('cache:api:/api/test:')).toBeNull()
    })

    it('has当持久化缓存中有但内存中没有时返回true', () => {
      const entry = {
        data: { v: 1 },
        timestamp: Date.now(),
        ttl: 1000,
        key: 'cache:api:/api/test:',
      }
      localStorageMock.setItem('cache:api:/api/test:', JSON.stringify(entry))

      const c = new RequestCache()
      expect(c.has('/api/test')).toBe(true)
    })

    it('has当内存有或持久化有任一存在即返回true', () => {
      const c = new RequestCache({ persist: false })
      c.set('/api/test', { v: 1 })
      expect(c.has('/api/test')).toBe(true)
      expect(c.has('/api/none')).toBe(false)
    })

    it('delete当持久化存在时应一并删除', () => {
      const c = new RequestCache()
      c.set('/api/test', { v: 1 })
      expect(localStorageMock.getItem('cache:api:/api/test:')).not.toBeNull()

      c.delete('/api/test')
      expect(localStorageMock.getItem('cache:api:/api/test:')).toBeNull()
    })

    it('clear当持久化不存在时不应报错', () => {
      const c = new RequestCache({ persist: false })
      c.set('/api/test', { v: 1 })
      expect(() => c.clear()).not.toThrow()
      expect(c.has('/api/test')).toBe(false)
    })

    it('clearExpired当持久化不存在时不应报错', () => {
      const c = new RequestCache({ persist: false })
      expect(() => c.clearExpired()).not.toThrow()
    })

    it('set支持自定义ttl', async () => {
      const c = new RequestCache()
      c.set('/api/test', { v: 1 }, undefined, 100)

      vi.useFakeTimers()
      vi.advanceTimersByTime(200)
      const result = await c.get('/api/test')
      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it('wrap支持自定义ttl', async () => {
      vi.useFakeTimers()
      const c = new RequestCache()
      const fetcher = vi.fn().mockResolvedValue({ v: 1 })

      await c.wrap('/api/test', fetcher, undefined, 100)
      vi.advanceTimersByTime(200)

      const result = await c.get('/api/test')
      expect(result).toBeNull()
      vi.useRealTimers()
    })

    it('wrap支持带params的缓存键', async () => {
      const c = new RequestCache({ persist: false })
      const fetcher = vi.fn().mockResolvedValue({ v: 1 })

      await c.wrap('/api/test', fetcher, { page: 1 })
      const result = await c.wrap('/api/test', fetcher, { page: 1 })
      expect(result).toEqual({ v: 1 })
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('相同key重复set应更新数据', async () => {
      const c = new RequestCache()
      c.set('/api/test', { v: 1 })
      c.set('/api/test', { v: 2 })
      expect(await c.get('/api/test')).toEqual({ v: 2 })
    })

    it('params为undefined时key只包含url', async () => {
      const c = new RequestCache()
      c.set('/api/test', { v: 1 })
      const result = await c.get('/api/test', undefined)
      expect(result).toEqual({ v: 1 })
    })
  })

  describe('持久化数据回填内存', () => {
    it('从持久化读取后应回填到内存缓存', async () => {
      const entry = {
        data: { v: 1 },
        timestamp: Date.now(),
        ttl: 1000,
        key: 'cache:api:/api/test:',
      }
      localStorageMock.setItem('cache:api:/api/test:', JSON.stringify(entry))

      const c = new RequestCache()
      await c.get('/api/test')

      // 第二次get应从内存读取,验证持久化数据已回填
      const result = await c.get('/api/test')
      expect(result).toEqual({ v: 1 })
    })
  })
})
