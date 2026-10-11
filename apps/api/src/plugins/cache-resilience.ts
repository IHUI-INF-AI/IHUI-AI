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

/**
 * 等锁者声明的「必需项」——一串点分路径，可选数组下标。
 * 例：`'id'`、`'user.profile.name'`、`'items[0].id'`、`'items.0.name'`。
 *
 * 只有等锁者自己知道"这份载荷少了哪个字段我就不能干活"，leader 不知道，缓存条目本身
 * 也不记录"我是按谁的投影回填的"，所以必需项只能由等锁者在调用点声明。
 */
export type CacheRequiredPaths = readonly string[]

/** 复检裁决三态：齐全 / 判缺 / 判不了。 */
export type RecheckVerdict =
  | { kind: 'satisfied' }
  /** 共享结果缺了本调用方声明的必需项 ⇒ 不吃这份缓存，等锁者自己回源重算 */
  | { kind: 'violated'; missing: string[] }
  /** 判不了：无从判断这份载荷对本调用方够不够用。既不谎报通过，也不据此把复用全废掉。 */
  | { kind: 'undecided'; reason: 'no-declaration' | 'unreadable-shape'; detail: string }

/** 最近一次「未判定」的落点（点名：哪个 key、什么原因）。 */
export interface UndecidedEvent {
  key: string
  reason: 'no-declaration' | 'unreadable-shape'
  detail: string
}

/** 等锁者复检观测面：三态互斥，合计 = 等锁者（非 leader）参与 singleflight 的次数。 */
export interface SingleflightRecheckStats {
  /** 必需项齐全 ⇒ 复用共享结果的次数 */
  satisfied: number
  /** 必需项缺失 ⇒ 不吃缓存、自行回源的次数 */
  violated: number
  /** 判不了 ⇒ 落未判定并点名的次数 */
  undecided: number
  /** 最近一次未判定的落点；从未发生则为 null */
  lastUndecided: UndecidedEvent | null
}

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
        opts?: { nullTtlSec?: number; requiredPaths?: CacheRequiredPaths },
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
      /** 等锁者复检观测面:区分"齐全复用 / 判缺自回源 / 判不了(未判定)"三态 */
      singleflightRecheckStats(): SingleflightRecheckStats
    }
  }
}

/** 路径分段黑名单：遍历只走自有属性，拒走原型链（原型污染面）。 */
const UNSAFE_PATH_SEGMENT = new Set(['__proto__', 'prototype', 'constructor'])

/**
 * 把 `'a.b[0].c'` / `'a[0]'` / `'a.0'` 归一成段数组；看不懂 ⇒ null（落"未判定"）。
 * 形状看不懂的判定是**保守方向**：宁可点名说判不了，也不许猜成"这个字段大概在"。
 */
export function parseCachePath(path: unknown): string[] | null {
  if (typeof path !== 'string') return null
  const trimmed = path.trim()
  if (!trimmed) return null
  const segs = trimmed
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0)
  if (segs.length === 0) return null
  if (segs.some((s) => UNSAFE_PATH_SEGMENT.has(s))) return null
  return segs
}

/**
 * 判定路径在 `root` 上是否「齐全」。
 * 判缺口径固定为：中间节点不是对象/数组 ⇒ 缺；终点严格等于 `undefined` ⇒ 缺。
 * `null` 是显式空值，**算存在**（否则"字段在但为空"会被误杀成缺字段）。
 */
export function cachePathPresent(root: unknown, segs: readonly string[]): boolean {
  let cur: unknown = root
  for (const seg of segs) {
    if (cur === null || cur === undefined) return false
    if (Array.isArray(cur)) {
      if (!/^\d+$/.test(seg)) return false
      const i = Number(seg)
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return false
      cur = cur[i]
      continue
    }
    if (typeof cur !== 'object') return false
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return false
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur !== undefined
}

/**
 * 等锁者按**自己**声明的必需项复检共享结果。
 *
 * 为什么不能默认复用 leader 那一份：singleflight 只按 key 聚合，而同一个 key 的等锁者未必
 * 是同一个调用方——列表页只要 `items[].id`，详情页要 `items[].detail`。leader 按它自己的
 * loader 回源并回填，写进缓存的是 leader 的投影；等锁者盲目复用就会拿到缺字段的载荷，而这个
 * 缺口在整个 TTL 内不会自愈（后续所有读都命中这份条目）。缺口一旦被回填固化，就与格①
 * 「未命中不是事实」同源：缓存里存的是"别人够用的那一份"，不是"你必需项齐全的证明"。
 * 所以等锁者拿到结果后必须按自己的声明再复检一次。
 */
export function recheckRequiredPaths(
  value: unknown,
  requiredPaths: CacheRequiredPaths | undefined,
): RecheckVerdict {
  // ① 声明缺失：调用方压根没声明必需项 ⇒ 我们无从判断这份载荷对它够不够用。
  //    落"未判定"并点名（见 recordRecheck），不许悄悄折成"satisfied"。
  if (requiredPaths === undefined || requiredPaths === null) {
    return { kind: 'undecided', reason: 'no-declaration', detail: 'requiredPaths 未声明' }
  }
  // ② 形状看不懂：声明了但不是数组 ⇒ 同样落"未判定"，由调用方去修声明，不替它猜。
  if (!Array.isArray(requiredPaths)) {
    return {
      kind: 'undecided',
      reason: 'unreadable-shape',
      detail: `requiredPaths 类型为 ${typeof requiredPaths}，应为 string[]`,
    }
  }
  const missing: string[] = []
  const unreadable: string[] = []
  for (const p of requiredPaths) {
    const segs = parseCachePath(p)
    if (segs === null) {
      unreadable.push(String(p))
      continue
    }
    if (!cachePathPresent(value, segs)) missing.push(String(p))
  }
  // 只要有一条路径的形状看不懂，整份复检就判不了（不许拿"其余几条都在"折成通过）
  if (unreadable.length > 0) {
    return {
      kind: 'undecided',
      reason: 'unreadable-shape',
      detail: `无法解析的必需路径: ${unreadable.join(', ')}`,
    }
  }
  if (missing.length > 0) return { kind: 'violated', missing }
  // 空声明（paths: []）是"没有必需项"，必需项集合为空 ⇒ 全部齐全，判通过（不是未判定）
  return { kind: 'satisfied' }
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

  /** 等锁者复检观测面(三态互斥)——"这次够不够用"落在计数与日志上,不落在猜测里 */
  const recheckStats: SingleflightRecheckStats = {
    satisfied: 0,
    violated: 0,
    undecided: 0,
    lastUndecided: null,
  }

  /** 复检裁决落账。未判定必须点名(key + 原因),既不折成通过也不折成全部拒绝。 */
  function recordRecheck(key: string, verdict: RecheckVerdict): void {
    if (verdict.kind === 'satisfied') {
      recheckStats.satisfied += 1
      return
    }
    if (verdict.kind === 'violated') {
      recheckStats.violated += 1
      server.log.warn(
        { key, missing: verdict.missing },
        'singleflight recheck: 共享结果缺本调用方声明的必需项,等锁者自行回源(不吃这份缓存)',
      )
      return
    }
    recheckStats.undecided += 1
    recheckStats.lastUndecided = {
      key,
      reason: verdict.reason,
      detail: verdict.detail,
    }
    server.log.warn(
      { key, reason: verdict.reason, detail: verdict.detail },
      'singleflight recheck: 判不了,落未判定(既非通过也非拒绝)',
    )
  }

  /**
   * 真正起一次回源并登记到 singleflight（leader 与"不吃缓存"的等锁者共用同一条路径）。
   * `finally { inflight.delete(key) }` 是既有「失败不固化」语义：无论成功/失败/抛错都摘票，
   * 不许把一次失败永久留在 inflight 里。本改动不触碰该行。
   */
  function runLoad<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
    opts?: { nullTtlSec?: number; requiredPaths?: CacheRequiredPaths },
  ): Promise<T> {
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

  async function getOrLoad<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
    opts?: { nullTtlSec?: number; requiredPaths?: CacheRequiredPaths },
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
    if (existing) {
      // 等锁者：拿到别人算完的结果后，**按自己声明的必需项再复检一次**。
      // leader 的 loader 是 leader 的投影，不等于本调用方必需项齐全的证明（详见
      // recheckRequiredPaths 注释）。复检不通过 ⇒ 不吃这份缓存，自己回源重算。
      const shared: unknown = await existing
      const verdict = recheckRequiredPaths(shared, opts?.requiredPaths)
      recordRecheck(key, verdict)
      if (verdict.kind === 'violated') {
        return runLoad(key, ttlSec, loader, opts)
      }
      // satisfied 复用；undecided 判不了 —— 不谎报通过（已单独计数并点名），
      // 也不折成"全部拒绝"（该复用的照样复用，不废掉 singleflight、不抛错）。
      return shared as T
    }

    return runLoad(key, ttlSec, loader, opts)
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
    singleflightRecheckStats: () => ({
      ...recheckStats,
      lastUndecided: recheckStats.lastUndecided ? { ...recheckStats.lastUndecided } : null,
    }),
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
