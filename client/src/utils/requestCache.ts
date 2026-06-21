/**
 * 请求缓存策略
 * 提供内存缓存、持久化缓存和缓存过期管理
 */

export interface CacheOptions {
  ttl?: number
  maxSize?: number
  persist?: boolean
  namespace?: string
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize: number
  private namespace: string

  constructor(maxSize = 100, namespace = 'default') {
    this.maxSize = maxSize
    this.namespace = namespace
  }

  private getNamespacedKey(key: string): string {
    return `${this.namespace}:${key}`
  }

  set<T>(key: string, data: T, ttl: number): void {
    const namespacedKey = this.getNamespacedKey(key)

    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(namespacedKey, {
      data,
      timestamp: Date.now(),
      ttl,
      key: namespacedKey,
    })
  }

  get<T>(key: string): T | null {
    const namespacedKey = this.getNamespacedKey(key)
    const entry = this.cache.get(namespacedKey) as CacheEntry<T> | undefined

    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(namespacedKey)
      return null
    }

    return entry.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    const namespacedKey = this.getNamespacedKey(key)
    return this.cache.delete(namespacedKey)
  }

  clear(): void {
    const prefix = `${this.namespace}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  size(): number {
    let count = 0
    const prefix = `${this.namespace}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        count++
      }
    }
    return count
  }
}

class PersistentCache {
  private namespace: string

  constructor(namespace = 'default') {
    this.namespace = namespace
  }

  private getStorageKey(key: string): string {
    return `cache:${this.namespace}:${key}`
  }

  set<T>(key: string, data: T, ttl: number): void {
    if (typeof window === 'undefined') return

    const storageKey = this.getStorageKey(key)
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key: storageKey,
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(entry))
    } catch {
      // Storage full, clear old entries
      this.clearExpired()
      try {
        localStorage.setItem(storageKey, JSON.stringify(entry))
      } catch {
        // Still can't write, ignore
      }
    }
  }

  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null

    const storageKey = this.getStorageKey(key)
    const raw = localStorage.getItem(storageKey)

    if (!raw) return null

    try {
      const entry = JSON.parse(raw) as CacheEntry<T>

      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(storageKey)
        return null
      }

      return entry.data
    } catch {
      localStorage.removeItem(storageKey)
      return null
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.getStorageKey(key))
  }

  clear(): void {
    if (typeof window === 'undefined') return

    const prefix = `cache:${this.namespace}:`
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  clearExpired(): void {
    if (typeof window === 'undefined') return

    const prefix = 'cache:'
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const raw = localStorage.getItem(key)
        if (raw) {
          try {
            const entry = JSON.parse(raw) as CacheEntry<unknown>
            if (Date.now() - entry.timestamp > entry.ttl) {
              keysToRemove.push(key)
            }
          } catch {
            keysToRemove.push(key)
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
}

export class RequestCache {
  private memoryCache: MemoryCache
  private persistentCache: PersistentCache | null
  private defaultTtl: number

  constructor(options: CacheOptions = {}) {
    const {
      ttl = 5 * 60 * 1000,
      maxSize = 100,
      persist = true,
      namespace = 'api',
    } = options

    this.defaultTtl = ttl
    this.memoryCache = new MemoryCache(maxSize, namespace)
    this.persistentCache = persist ? new PersistentCache(namespace) : null
  }

  private generateKey(url: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : ''
    return `${url}:${paramString}`
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T | null> {
    const key = this.generateKey(url, params)

    const memoryResult = this.memoryCache.get<T>(key)
    if (memoryResult !== null) {
      return memoryResult
    }

    if (this.persistentCache) {
      const persistentResult = this.persistentCache.get<T>(key)
      if (persistentResult !== null) {
        this.memoryCache.set(key, persistentResult, this.defaultTtl)
        return persistentResult
      }
    }

    return null
  }

  set<T>(url: string, data: T, params?: Record<string, unknown>, ttl?: number): void {
    const key = this.generateKey(url, params)
    const actualTtl = ttl ?? this.defaultTtl

    this.memoryCache.set(key, data, actualTtl)
    if (this.persistentCache) {
      this.persistentCache.set(key, data, actualTtl)
    }
  }

  has(url: string, params?: Record<string, unknown>): boolean {
    const key = this.generateKey(url, params)
    return this.memoryCache.has(key) || (this.persistentCache?.has(key) ?? false)
  }

  delete(url: string, params?: Record<string, unknown>): void {
    const key = this.generateKey(url, params)
    this.memoryCache.delete(key)
    if (this.persistentCache) {
      this.persistentCache.delete(key)
    }
  }

  clear(): void {
    this.memoryCache.clear()
    this.persistentCache?.clear()
  }

  clearExpired(): void {
    this.persistentCache?.clearExpired()
  }

  async wrap<T>(url: string, fetcher: () => Promise<T>, params?: Record<string, unknown>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(url, params)
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    this.set(url, data, params, ttl)
    return data
  }
}

export const defaultCache = new RequestCache()

export function useRequestCache(options?: CacheOptions) {
  const cache = new RequestCache(options)

  return {
    get: <T>(url: string, params?: Record<string, unknown>) => cache.get<T>(url, params),
    set: <T>(url: string, data: T, params?: Record<string, unknown>, ttl?: number) => cache.set(url, data, params, ttl),
    has: (url: string, params?: Record<string, unknown>) => cache.has(url, params),
    delete: (url: string, params?: Record<string, unknown>) => cache.delete(url, params),
    clear: () => cache.clear(),
    wrap: <T>(url: string, fetcher: () => Promise<T>, params?: Record<string, unknown>, ttl?: number) =>
      cache.wrap(url, fetcher, params, ttl),
  }
}

export default RequestCache
