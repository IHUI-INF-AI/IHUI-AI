import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { AvalancheGuard, DEFAULT_AVALANCHE_CONFIG } from '../utils/cache-avalanche-guard.js'

/**
 * 缓存韧性插件。
 *
 * 迁移自旧架构 cache_resilience 设计（旧文件未提交，本插件按任务规格实现）。
 *
 * 四项能力：
 * 1. 熔断器：缓存服务（Redis）连续失败达阈值时熔断，降级直查 DB；
 *    冷却后半开探测，成功则恢复。
 * 2. 缓存一致性：doubleDelete 双删策略——写前删缓存 + 写后延迟再删，
 *    消除"读旧值回填"导致的脏缓存窗口。
 * 3. 缓存击穿防护：singleflight 模式——相同 key 并发回源只查一次 DB，
 *    其余请求复用同一 Promise，避免热点 key 失效瞬间打穿 DB。
 * 4. 雪崩防护（bug174）：TTL ±20% 抖动 + 提前 30s 预热调度，
 *    防止大量 key 同时过期引发回源雪崩。
 */
const KEY_PREFIX = 'ihui:cache:'

type BreakerState = 'closed' | 'open' | 'half_open'

interface Breaker {
  state: BreakerState
  failures: number
  openedAt: number
  readonly cooldownMs: number
  readonly threshold: number
}

declare module 'fastify' {
  interface FastifyInstance {
    cacheResilience: {
      /** 取缓存或回源（含 singleflight + 熔断降级） */
      getOrLoad<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T>
      /** 失效单个缓存 key */
      invalidate(key: string): Promise<void>
      /** 双删策略：写前删 + 写后延迟删，保证缓存一致性 */
      doubleDelete<T>(key: string, writeFn: () => Promise<T>, delayMs?: number): Promise<T>
      /** 当前熔断器状态 */
      breakerState(): BreakerState
      /** 缓存雪崩防护统计 */
      avalancheStats(): { tracked: number; prewarmedTotal: number }
    }
  }
}

const cacheResiliencePlugin: FastifyPluginAsync = async (server) => {
  const breaker: Breaker = {
    state: 'closed',
    failures: 0,
    openedAt: 0,
    cooldownMs: 30_000,
    threshold: 5,
  }
  // singleflight：相同 key 的进行中回源 Promise
  const inflight = new Map<string, Promise<unknown>>()

  // 雪崩防护：TTL 抖动 + 预热调度（bug174）
  // loaders 保存各 key 的回源函数，供预热回调在过期前主动刷新
  const loaders = new Map<string, () => Promise<unknown>>()
  const avalanche = new AvalancheGuard(DEFAULT_AVALANCHE_CONFIG, (key) => {
    const loader = loaders.get(key)
    if (!loader) return
    // 预热：在过期前异步刷新缓存
    void (async () => {
      try {
        const val = await loader()
        const ttl = avalanche.ttl(key)
        await cacheSet(key, ttl, val)
        avalanche.register(key, ttl)
      } catch {
        // 预热失败不影响业务，下次 getOrLoad 会正常回源
      }
    })()
  })

  // 定期扫描即将过期的 key 并触发预热
  const preloadTimer = setInterval(() => {
    avalanche.tick()
  }, 10_000)

  function breakerAllow(): boolean {
    if (breaker.state === 'closed') return true
    if (breaker.state === 'open') {
      if (Date.now() - breaker.openedAt >= breaker.cooldownMs) {
        breaker.state = 'half_open'
        return true
      }
      return false
    }
    return true // half_open：允许单次探测
  }

  function breakerSuccess(): void {
    breaker.failures = 0
    breaker.state = 'closed'
  }

  function breakerFailure(): void {
    breaker.failures++
    if (breaker.failures >= breaker.threshold || breaker.state === 'half_open') {
      breaker.state = 'open'
      breaker.openedAt = Date.now()
    }
  }

  async function cacheGet<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await server.redis.get(KEY_PREFIX + key)
      if (!raw) return undefined
      return JSON.parse(raw) as T
    } catch (e) {
      server.log.warn({ err: e }, 'cache get failed, tripping breaker')
      breakerFailure()
      return undefined
    }
  }

  async function cacheSet(key: string, ttlSec: number, val: unknown): Promise<void> {
    try {
      await server.redis.set(KEY_PREFIX + key, JSON.stringify(val), 'EX', ttlSec)
      breakerSuccess()
    } catch (e) {
      server.log.warn({ err: e }, 'cache set failed, tripping breaker')
      breakerFailure()
    }
  }

  async function invalidate(key: string): Promise<void> {
    avalanche.unregister(key)
    loaders.delete(key)
    try {
      await server.redis.del(KEY_PREFIX + key)
    } catch {
      /* ignore */
    }
  }

  /** 从缓存键中提取前缀（冒号前的部分），用于指标分维度统计 */
  function extractKeyPrefix(key: string): string {
    const idx = key.indexOf(':')
    return idx > 0 ? key.slice(0, idx) : key
  }

  async function getOrLoad<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    const keyPrefix = extractKeyPrefix(key)
    // 熔断器开启时跳过缓存直查 DB（降级）
    if (breakerAllow()) {
      const cached = await cacheGet<T>(key)
      if (cached !== undefined) {
        // 缓存命中
        try {
          server.recordCache(keyPrefix, true)
        } catch {
          /* 指标采集失败不影响业务 */
        }
        return cached
      }
      // 缓存未命中
      try {
        server.recordCache(keyPrefix, false)
      } catch {
        /* 指标采集失败不影响业务 */
      }
    }
    // singleflight：相同 key 并发只回源一次
    const existing = inflight.get(key)
    if (existing) return existing as Promise<T>

    const p = (async (): Promise<T> => {
      try {
        const val = await loader()
        // 回填缓存（熔断器未开启时），使用雪崩防护的抖动 TTL
        if (breakerAllow()) {
          const jitteredTtl = avalanche.ttl(key, ttlSec)
          await cacheSet(key, jitteredTtl, val)
          avalanche.register(key, jitteredTtl)
          loaders.set(key, loader as () => Promise<unknown>)
        }
        return val
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, p)
    return p
  }

  async function doubleDelete<T>(
    key: string,
    writeFn: () => Promise<T>,
    delayMs = 500,
  ): Promise<T> {
    // 双删：写前删缓存 → 写 DB → 延迟再删（清除并发读回填的旧值）
    await invalidate(key)
    const result = await writeFn()
    setTimeout(() => {
      void invalidate(key)
    }, delayMs)
    return result
  }

  server.decorate('cacheResilience', {
    getOrLoad,
    invalidate,
    doubleDelete,
    breakerState: () => breaker.state,
    avalancheStats: () => avalanche.getStats(),
  })

  // 应用关闭时清理预热定时器
  server.addHook('onClose', async () => {
    clearInterval(preloadTimer)
  })
}

export const cacheResilience = fp(cacheResiliencePlugin, {
  name: 'cache-resilience',
  fastify: '5.x',
})
