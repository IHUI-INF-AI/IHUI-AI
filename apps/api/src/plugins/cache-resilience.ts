// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 空值哨兵(格①,2026-09-26 立):仅在调用方显式传 `nullTtlSec`(空值 TTL 档位)时写入。
 * 它让"缓存里是空值"与"没有缓存条目"在存储层与观测面都可区分;默认路径**不写**——
 * 未命中不是事实,回填 null 会把"旁路建行(不经 doubleDelete 直接写库)"永久隐身掉。
 */
const NULL_CACHE_SENTINEL = '{"__ihuiCacheNull__":1}'

/** cacheProbe 三态:实际值命中 / 空值哨兵命中 / 无条目(含读失败)。 */
type CacheProbe<T> = { kind: 'hit'; value: T } | { kind: 'null-hit' } | { kind: 'miss' }

/** 空值回填观测面计数(格①):三类事件互斥,合计 = 所有 loader 返回空的回填尝试 + 空值条目命中。 */
interface CacheQualityStats {
  /** loader 返回 null/undefined 且未启用空值档位 ⇒ 跳过回填的次数 */
  emptySkipped: number
  /** 显式 nullTtlSec 档位写入哨兵空值条目的次数 */
  nullEntryWrites: number
  /** 命中哨兵空值条目的次数(与"无条目"在观测面上可区分) */
  nullEntryHits: number
}

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
      /**
       * 取缓存或回源(含 singleflight + 熔断降级)。
       * 格①(2026-09-26)：loader 返回 null/undefined 时默认**不回填**缓存。
       * 确需缓存空值时必须显式传 opts.nullTtlSec(空值 TTL 档位),写入可区分的哨兵条目;
       * 不存在"永久记住一次未命中"的形态。
       */
      getOrLoad<T>(
        key: string,
        ttlSec: number,
        loader: () => Promise<T>,
        opts?: { nullTtlSec?: number },
      ): Promise<T>
      /** 失效单个缓存 key */
      invalidate(key: string): Promise<void>
      /** 双删策略：写前删 + 写后延迟删，保证缓存一致性 */
      doubleDelete<T>(key: string, writeFn: () => Promise<T>, delayMs?: number): Promise<T>
      /** 当前熔断器状态 */
      breakerState(): BreakerState
      /** 缓存雪崩防护统计 */
      avalancheStats(): { tracked: number; prewarmedTotal: number }
      /** 空值回填观测面:区分"跳过空回填 / 哨兵空值条目写入 / 空值条目命中"(不得靠猜) */
      cacheQualityStats(): CacheQualityStats
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

  // 格①观测面(2026-09-26):回填决策必须可查——"这次是不是空"落在计数里,不落在猜测里
  const backfillStats: CacheQualityStats = {
    emptySkipped: 0,
    nullEntryWrites: 0,
    nullEntryHits: 0,
  }

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
        // 格①(与 getOrLoad 同理):预热回填 null = 把一次未命中永久化,跳过并计数
        if (val === null || val === undefined) {
          backfillStats.emptySkipped += 1
          server.log.debug({ key }, 'cache prewarm skipped: loader returned empty (not a fact)')
          return
        }
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

  async function cacheProbe<T>(key: string): Promise<CacheProbe<T>> {
    try {
      const raw = await server.redis.get(KEY_PREFIX + key)
      if (!raw) return { kind: 'miss' }
      if (raw === NULL_CACHE_SENTINEL) return { kind: 'null-hit' }
      return { kind: 'hit', value: JSON.parse(raw) as T }
    } catch (e) {
      server.log.warn({ err: e }, 'cache get failed, tripping breaker')
      breakerFailure()
      return { kind: 'miss' }
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

  /** 原串回填通道:只用于空值哨兵(JSON 序列化 null 会与"读不到"分支撞车,必须用可辨识哨兵)。 */
  async function cacheSetRawStr(key: string, raw: string, ttlSec: number): Promise<void> {
    try {
      await server.redis.set(KEY_PREFIX + key, raw, 'EX', ttlSec)
      breakerSuccess()
    } catch (e) {
      server.log.warn({ err: e }, 'cache null-entry set failed, tripping breaker')
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

  async function getOrLoad<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
    opts?: { nullTtlSec?: number },
  ): Promise<T> {
    const keyPrefix = extractKeyPrefix(key)
    // 熔断器开启时跳过缓存直查 DB（降级）
    if (breakerAllow()) {
      const probe = await cacheProbe<T>(key)
      if (probe.kind !== 'miss') {
        // 缓存命中
        try {
          server.recordCache(keyPrefix, true)
        } catch {
          /* 指标采集失败不影响业务 */
        }
        // 格①：空值哨兵条目也算命中,但观测面单独计数,与"实际值命中""无条目"三者可区分
        if (probe.kind === 'null-hit') {
          backfillStats.nullEntryHits += 1
          server.log.debug({ key }, 'cache null-entry hit (explicit null TTL tier)')
          return null as unknown as T
        }
        return probe.value
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
        if (breakerAllow()) {
          // 格①(2026-09-26)：未命中不是事实。loader 返回 null/undefined 可能只是"行还没建"——
          // 只有 doubleDelete 写路径会让缓存失效,旁路直接写库不受保护,回填 null 会让这条
          // 空值永久隐身。默认不回填;确需缓存空值必须显式传 opts.nullTtlSec(空值 TTL 档),
          // 写入可区分的哨兵条目。不存在"永久记住一次未命中"的形态。
          if (val === null || val === undefined) {
            if (opts?.nullTtlSec && opts.nullTtlSec > 0) {
              await cacheSetRawStr(key, NULL_CACHE_SENTINEL, opts.nullTtlSec)
              backfillStats.nullEntryWrites += 1
            } else {
              backfillStats.emptySkipped += 1
            }
          } else {
            const jitteredTtl = avalanche.ttl(key, ttlSec)
            await cacheSet(key, jitteredTtl, val)
            avalanche.register(key, jitteredTtl)
            loaders.set(key, loader as () => Promise<unknown>)
          }
        }
        // 回填观测面：这次是不是空,落在日志与计数上,不留给下次排查去猜
        server.log.debug(
          { key, empty: val === null || val === undefined },
          'cache backfill decision',
        )
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
    cacheQualityStats: () => ({ ...backfillStats }),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
