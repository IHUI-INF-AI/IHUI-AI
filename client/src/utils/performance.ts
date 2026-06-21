/**
 * 性能工具
 * 提供性能优化相关功能
 */

import { logger } from './logger'

export { debounce, throttle } from './format'

/**
 * 测量函数执行时间
 */
export function measurePerformance<T>(fn: () => T, label: string): T {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  logger.info(`[Performance] ${label}: ${end - start}ms`)
  return result
}

/**
 * 异步测量函数执行时间
 */
export async function measurePerformanceAsync<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()
  logger.info(`[Performance] ${label}: ${end - start}ms`)
  return result
}
