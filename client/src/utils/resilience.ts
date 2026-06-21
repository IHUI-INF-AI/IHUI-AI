/**
 * 系统韧性工具
 * 提供故障恢复和降级功能
 */

import { ref, onMounted } from 'vue'
import { logger } from './logger'
import { useCleanup } from '@/composables/useCleanup'

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts?: number
  delay?: number
  backoff?: number
}

/**
 * 带重试的函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = config

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt === maxAttempts) break

      const waitTime = delay * Math.pow(backoff, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  throw lastError
}

/**
 * 断路器状态
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * 断路器配置
 */
export interface CircuitBreakerConfig {
  failureThreshold?: number
  resetTimeout?: number
}

/**
 * 创建断路器
 */
export function createCircuitBreaker(config: CircuitBreakerConfig = {}) {
  const { failureThreshold = 5, resetTimeout = 60000 } = config

  let state: CircuitState = 'CLOSED'
  let failures = 0
  let lastFailureTime: number | null = null

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (state === 'OPEN') {
        if (lastFailureTime && Date.now() - lastFailureTime > resetTimeout) {
          state = 'HALF_OPEN'
        } else {
          throw new Error('Circuit breaker is OPEN')
        }
      }

      try {
        const result = await fn()
        if (state === 'HALF_OPEN') {
          state = 'CLOSED'
          failures = 0
        }
        return result
      } catch (error) {
        failures++
        lastFailureTime = Date.now()
        if (failures >= failureThreshold) {
          state = 'OPEN'
        }
        throw error
      }
    },
    getState: () => state,
  }
}

/**
 * 使用韧性系统
 */
export function useResilience() {
  const isOnline = ref(navigator.onLine)
  const retryCount = ref(0)

  const handleOnline = () => {
    isOnline.value = true
    retryCount.value = 0
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  const cleanup = useCleanup()

  onMounted(() => {
    cleanup.addEventListener(window, 'online', handleOnline)
    cleanup.addEventListener(window, 'offline', handleOffline)
  })

  return {
    isOnline,
    retryCount,
    withRetry,
    createCircuitBreaker,
  }
}

/**
 * 初始化韧性系统
 */
export function initResilience(): void {
  logger.info('Resilience system initialized')
}
