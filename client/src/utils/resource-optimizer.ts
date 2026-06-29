/**
 * 资源优化工具
 * 提供请求取消、缓存等功能
 */

// 请求控制器存储
const abortControllers = new Map<string, AbortController>()

// 缓存存储
const cacheStore = new Map<string, { data: unknown; timestamp: number; ttl: number }>()

/**
 * 创建AbortController
 */
export function createAbortController(key: string): AbortController {
  // 取消之前的请求
  cancelRequest(key)

  const controller = new AbortController()
  abortControllers.set(key, controller)

  // 自动清理
  controller.signal.addEventListener('abort', () => {
    abortControllers.delete(key)
  })

  return controller
}

/**
 * 取消请求
 */
export function cancelRequest(key?: string): void {
  if (key) {
    const controller = abortControllers.get(key)
    if (controller) {
      controller.abort()
      abortControllers.delete(key)
    }
  } else {
    // 取消所有请求
    abortControllers.forEach((controller) => {
      controller.abort()
    })
    abortControllers.clear()
  }
}

/**
 * 获取缓存数据
 */
export function getCachedData<T>(key: string): T | null {
  const cached = cacheStore.get(key)
  if (!cached) return null

  // 检查是否过期
  if (Date.now() - cached.timestamp > cached.ttl) {
    cacheStore.delete(key)
    return null
  }

  return cached.data as T
}

/**
 * 设置缓存数据
 */
export function setCachedData<T>(key: string, data: T, ttl = 5 * 60 * 1000): void {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  })
}

/**
 * 清除缓存
 */
export function clearCachedData(key?: string): void {
  if (key) {
    cacheStore.delete(key)
  } else {
    cacheStore.clear()
  }
}
