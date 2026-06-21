/**
 * AI 能力调用缓存
 * 提供智能缓存机制，减少重复调用，提升性能
 */

import { ref } from 'vue'
import { logger } from '../utils/logger'
import { useCleanup } from '@/composables/useCleanup'
import type { AICapabilityRequest, AICapabilityResponse } from '@/services/unified-ai-orchestrator'

// 缓存项
interface CacheItem {
  key: string
  response: AICapabilityResponse
  timestamp: number
  expiresAt: number
  hitCount: number
}

// 缓存配置
interface CacheConfig {
  ttl?: number // 缓存时间（毫秒）
  maxSize?: number // 最大缓存数量
  enableCache?: boolean // 是否启用缓存
}

/**
 * AI 能力缓存 Composable
 */
export function useAICapabilityCache(config: CacheConfig = {}) {
  const {
    ttl = 5 * 60 * 1000, // 默认 5 分钟
    maxSize = 100,
    enableCache = true,
  } = config
  const cleanup = useCleanup()

  const cache = ref<Map<string, CacheItem>>(new Map())

  /**
   * 生成缓存键
   */
  function generateCacheKey(request: AICapabilityRequest): string {
    const { type, capabilityId, input, context } = request
    const keyParts = [
      type,
      capabilityId || 'auto',
      typeof input === 'string' ? input : JSON.stringify(input),
      context?.userMessage || '',
    ]
    return keyParts.join('::')
  }

  /**
   * 获取缓存
   */
  function getCache(request: AICapabilityRequest): AICapabilityResponse | null {
    if (!enableCache) return null

    const key = generateCacheKey(request)
    const item = cache.value.get(key)

    if (!item) return null

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      cache.value.delete(key)
      return null
    }

    // 更新命中次数
    item.hitCount++
    return item.response
  }

  /**
   * 设置缓存
   */
  function setCache(request: AICapabilityRequest, response: AICapabilityResponse): void {
    if (!enableCache) return

    const key = generateCacheKey(request)

    // 检查缓存大小
    if (cache.value.size >= maxSize) {
      // 删除最旧的缓存项
      const entries = Array.from(cache.value.entries()) as Array<[string, { timestamp: number }]>
      const oldestKey = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      cache.value.delete(oldestKey)
    }

    const item: CacheItem = {
      key,
      response,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 0,
    }

    cache.value.set(key, item)
  }

  /**
   * 清除缓存
   */
  function clearCache(): void {
    cache.value.clear()
  }

  /**
   * 清除过期缓存
   */
  function clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, item] of cache.value.entries()) {
      if (now > item.expiresAt) {
        cache.value.delete(key)
      }
    }
  }

  /**
   * 获取缓存统计
   */
  function getCacheStats() {
    const total = cache.value.size
    const cacheItems = Array.from(cache.value.values()) as CacheItem[]
    const totalHits = cacheItems.reduce((sum, item) => sum + item.hitCount, 0)
    const avgHitCount = total > 0 ? totalHits / total : 0

    return {
      total,
      totalHits,
      avgHitCount,
      hitRate: totalHits / (totalHits + total) || 0,
    }
  }

  /**
   * 预热缓存
   */
  async function warmupCache(
    requests: AICapabilityRequest[],
    invokeFn: (req: AICapabilityRequest) => Promise<AICapabilityResponse>
  ): Promise<void> {
    for (const request of requests) {
      const cached = getCache(request)
      if (!cached) {
        try {
          const response = await invokeFn(request)
          setCache(request, response)
        } catch (error) {
          logger.error('Cache warm-up failed:', error)
        }
      }
    }
  }

  // 定期清理过期缓存
  if (enableCache) {
    cleanup.addInterval(() => {
      clearExpiredCache()
    }, 60000) // 每分钟清理一次
  }

  return {
    getCache,
    setCache,
    clearCache,
    clearExpiredCache,
    getCacheStats,
    warmupCache,
  }
}
