/**
 * API缓存组合式函数
 * 提供API响应缓存、防抖、节流等功能
 */

import { ApiCache, debounceApi, throttleApi } from '@/utils/apiResponseHandler'
import { requestDeduplicator } from '@/utils/optimization'
import type { ApiResponse } from '@/types'

// 全局API缓存实例
const globalApiCache = new ApiCache(5 * 60 * 1000) // 默认5分钟

/**
 * 使用API缓存
 */
export function useApiCache<_T = unknown>(options?: {
  cacheKey?: string
  ttl?: number
  enabled?: boolean
}) {
  const { cacheKey: _cacheKey, ttl, enabled = true } = options || {}
  const cache = globalApiCache

  const getCached = <R>(key: string): R | undefined => {
    if (!enabled) return undefined
    return cache.get<R>(key)
  }

  const setCache = <R>(key: string, data: R, customTTL?: number): void => {
    if (!enabled) return
    cache.set(key, data, customTTL || ttl)
  }

  const clearCache = (key?: string): void => {
    if (key) {
      cache.delete(key)
    } else {
      cache.clear()
    }
  }

  const hasCache = (key: string): boolean => {
    if (!enabled) return false
    return cache.hasValid(key)
  }

  return {
    cache,
    getCached,
    setCache,
    clearCache,
    hasCache,
  }
}

/**
 * 使用防抖API
 */
export function useDebounceApi<T extends unknown[], R>(
  apiFn: (...args: T) => Promise<ApiResponse<R>>,
  delay: number = 300
) {
  // 使用 unknown 作为中间类型进行转换
  const debouncedFn = debounceApi(
    apiFn as unknown as (...args: unknown[]) => Promise<ApiResponse<R>>,
    delay
  )
  return debouncedFn as unknown as (...args: T) => Promise<ApiResponse<R>>
}

/**
 * 使用节流API
 */
export function useThrottleApi<T extends unknown[], R>(
  apiFn: (...args: T) => Promise<ApiResponse<R>>,
  interval: number = 1000
) {
  // 使用 unknown 作为中间类型进行转换
  const throttledFn = throttleApi(
    apiFn as unknown as (...args: unknown[]) => Promise<ApiResponse<R>>,
    interval
  )
  return throttledFn as unknown as (...args: T) => Promise<ApiResponse<R>>
}

/**
 * 使用请求去重
 */
export function useRequestDeduplication<T>(
  requestFn: () => Promise<T>,
  keyGenerator?: () => string
): Promise<T> {
  const dedupedFn = requestDeduplicator(requestFn, keyGenerator)
  return dedupedFn() as Promise<T>
}

/**
 * 带缓存的API调用
 */
export function useCachedApi<T extends unknown[], R>(
  apiFn: (...args: T) => Promise<ApiResponse<R>>,
  options?: {
    cacheKey?: (...args: T) => string
    ttl?: number
    enabled?: boolean
    debounce?: number
    throttle?: number
    deduplicate?: boolean
  }
) {
  const { cacheKey, ttl, enabled = true, debounce, throttle, deduplicate = true } = options || {}

  const { getCached, setCache, hasCache } = useApiCache({ ttl, enabled })

  // 包装API函数
  let wrappedFn: (...args: T) => Promise<ApiResponse<R>> = apiFn

  // 应用防抖
  if (debounce) {
    wrappedFn = useDebounceApi(wrappedFn, debounce)
  }

  // 应用节流
  if (throttle) {
    wrappedFn = useThrottleApi(wrappedFn, throttle)
  }

  // 执行API调用
  const execute = async (...args: T): Promise<ApiResponse<R>> => {
    // 生成缓存键
    const key = cacheKey ? cacheKey(...args) : `api:${apiFn.name}:${JSON.stringify(args)}`

    // 检查缓存
    if (enabled && hasCache(key)) {
      const cached = getCached<ApiResponse<R>>(key)
      if (cached !== undefined) {
        return cached
      }
    }

    // 请求去重
    const executeRequest = async (): Promise<ApiResponse<R>> => {
      const result = await wrappedFn(...args)

      // 缓存结果
      if (enabled && result) {
        setCache(key, result, ttl)
      }

      return result
    }

    if (deduplicate) {
      // 使用函数包装以匹配类型
      const dedupKey = () => key
      return useRequestDeduplication(executeRequest, dedupKey)
    }

    return executeRequest()
  }

  return {
    execute,
    clearCache: (key?: string) => {
      if (key) {
        const cacheKey = options?.cacheKey ? options.cacheKey(...([] as unknown as T)) : undefined
        if (cacheKey) {
          globalApiCache.delete(cacheKey)
        }
      } else {
        globalApiCache.clear()
      }
    },
  }
}
