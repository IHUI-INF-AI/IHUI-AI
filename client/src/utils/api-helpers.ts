/**
 * API辅助工具
 * 提供API相关的辅助功能
 */

/**
 * 输入验证器
 */
export const InputValidator = {
  isEmail: (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },
  isPhone: (value: string): boolean => {
    return /^1[3-9]\d{9}$/.test(value)
  },
  isRequired: (value: any): boolean => {
    if (typeof value === 'string') return value.trim().length > 0
    return value !== null && value !== undefined
  },
  minLength: (value: string, length: number): boolean => {
    return value.length >= length
  },
  maxLength: (value: string, length: number): boolean => {
    return value.length <= length
  },
}

/**
 * 获取默认登录时长
 */
export function getDefaultLoginDuration(): number {
  return 7 * 24 * 60 * 60 * 1000 // 7天
}

/**
 * 创建中止控制器
 */
export function createAbortController(): AbortController {
  return new AbortController()
}

/**
 * 取消请求
 */
export function cancelRequest(controller: AbortController): void {
  controller.abort()
}

/**
 * 缓存相关
 */
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟

export function getCachedData<T>(key: string): T | null {
  const item = cache.get(key)
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data as T
  }
  cache.delete(key)
  return null
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearCachedData(key?: string): void {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

/**
 * 检查登录是否过期
 */
export function isLoginExpired(): boolean {
  const loginTime = localStorage.getItem('login_time')
  if (!loginTime) return true

  const expireTime = 7 * 24 * 60 * 60 * 1000 // 7天
  return Date.now() - parseInt(loginTime) > expireTime
}

/**
 * 演示模式检查
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true' || window.location.search.includes('demo=true')
}

/**
 * 注册清理函数
 */
export function registerCleanup(fn: () => void): () => void {
  window.addEventListener('beforeunload', fn)
  return () => window.removeEventListener('beforeunload', fn)
}

/**
 * 设置超时
 */
export function setTimeout(fn: () => void, delay: number): number {
  return window.setTimeout(fn, delay)
}

/**
 * 清除超时
 */
export function clearTimeout(id: number): void {
  window.clearTimeout(id)
}
