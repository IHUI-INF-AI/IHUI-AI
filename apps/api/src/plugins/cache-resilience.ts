import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

/**
 * 缓存韧性插件。
 *
 * 迁移自旧架构 cache_resilience 设计（旧文件未提交，本插件按任务规格实现）。
 *
 * 三项能力：
 * 1. 熔断器：缓存服务（Redis）连续失败达阈值时熔断，降级直查 DB；
 *    冷却后半开探测，成功则恢复。
 * 2. 缓存一致性：doubleDelete 双删策略——写前删缓存 + 写后延迟再删，
 *    消除"读旧值回填"导致的脏缓存窗口。
 * 3. 缓存击穿防护：singleflight 模式——相同 key 并发回源只查一次 DB，
 *    其余请求复用同一 Promise，避免热点 key 失效瞬间打穿 DB。
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
    try {
      await server.redis.del(KEY_PREFIX + key)
    } catch {
      /* ignore */
    }
  }

  async function getOrLoad<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    // 熔断器开启时跳过缓存直查 DB（降级）
    if (breakerAllow()) {
      const cached = await cacheGet<T>(key)
      if (cached !== undefined) return cached
    }
    // singleflight：相同 key 并发只回源一次
    const existing = inflight.get(key)
    if (existing) return existing as Promise<T>

    const p = (async (): Promise<T> => {
      try {
        const val = await loader()
        // 回填缓存（熔断器未开启时）
        if (breakerAllow()) await cacheSet(key, ttlSec, val)
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
  })
}

export const cacheResilience = fp(cacheResiliencePlugin, {
  name: 'cache-resilience',
  fastify: '5.x',
})
