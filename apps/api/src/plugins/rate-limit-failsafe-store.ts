// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Redis } from 'ioredis'

/**
 * 失稳安全的限流存储（Fail-safe rate-limit store）。
 *
 * 对应安全审计 P0：Redis 不可用时**不**放行（fail-open 会把限流直接打穿，放大 DDoS），
 * 也**不**把全站打成 429/500（硬 fail-closed 牺牲可用性）—— 而是**回退到进程内保守计数**
 * （本地定长窗口 LRU），在故障窗口内仍保留基本限流。与 distributed-rate-limit 的
 * "Redis 故障 → 本地 token bucket" 判据同源同思路（见 distributed-rate-limit.ts 注释）。
 *
 * 实现要点：
 *  - 正常路径走 Redis（与 @fastify/rate-limit 内置 RedisStore 等价的原子 Lua）；
 *  - incr/read 抛错或超时，则转本地 LRU 兜底（永不把请求判为"未被限流"地放行失败路径）；
 *    兜底表是**进程级全局共享容量**（所有路由合计，LRU 淘汰；容量满且无可淘汰的过期条目时
 *    对新 key fail-closed，见 F-227），不同路由靠键前缀隔离计数、不再每路由各持一份 Map；
 *  - child() 沿用同一 Redis 连接，并按路由 method+url 拼出独立键前缀（对齐内置行为）。
 *
 * 注意：本 store 的构造函数仅接收 @fastify/rate-limit 传入的 globalParams（不含 redis 客户端），
 * 因此 redis 客户端与命名空间通过工厂闭包注入，child() 通过显式 ns 参数复用。
 */

/** 与 @fastify/rate-limit 内置 RedisStore 完全一致的原子计数 Lua（INCR + PEXPIRE + PTTL）。 */
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local timeWindow = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local continueExceeding = ARGV[3] == 'true'
local exponentialBackoff = ARGV[4] == 'true'
local MAX_SAFE_INTEGER = (2^53) - 1
local current = redis.call('INCR', key)
if current == 1 or (continueExceeding and current > max) then
  redis.call('PEXPIRE', key, timeWindow)
elseif exponentialBackoff and current > max then
  local backoffExponent = current - max - 1
  timeWindow = math.min(timeWindow * (2 ^ backoffExponent), MAX_SAFE_INTEGER)
  redis.call('PEXPIRE', key, timeWindow)
else
  timeWindow = redis.call('PTTL', key)
end
return {current, timeWindow}
`

/** 非变更读：返回当前计数与剩余 TTL（供 createRateLimit({ increment:false }) 使用）。 */
const RATE_LIMIT_READ_LUA = `
local key = KEYS[1]
local current = redis.call('GET', key)
if not current then
  return {0, 0}
end
local ttl = redis.call('PTTL', key)
if ttl < 0 then
  ttl = 0
end
return {tonumber(current), ttl}
`

export interface StoreResult {
  current: number
  ttl: number
}
export type StoreCallback = (err: Error | null, res?: StoreResult) => void
export interface StoreCtorOptions {
  continueExceeding?: boolean
  exponentialBackoff?: boolean
  routeInfo?: { method?: string; url?: string }
  [key: string]: unknown
}

/**
 * 对外暴露的 store 形状（显式接口，不让工厂返回的匿名类类型外泄）：
 * 匿名类带 private 字段时无法被导出，typecheck 会报 TS4094。
 */
export interface FailSafeRateLimitStore {
  incr(ip: string, cb: StoreCallback, timeWindow: number, max: number): void
  read(ip: string, cb: StoreCallback, timeWindow: number, max: number): void
  child(routeOptions: StoreCtorOptions): FailSafeRateLimitStore
}

export interface FailSafeRateLimitStoreCtor {
  new (globalParams?: StoreCtorOptions, ns?: string): FailSafeRateLimitStore
}

/**
 * 进程内兜底表总容量上限：**进程级全局共享**（所有路由合计 20000 条），
 * 不再每个路由 `child()` 各持一份 20000 条 Map（F-227：内存按「路由数 × 20000」放大）。
 */
const LOCAL_FALLBACK_CAP = 20000

/** 容量满时寻找可淘汰过期条目的 LRU 扫描上限（避免容量压力下每次请求 O(n) 的 CPU 放大）。 */
const LOCAL_EVICT_SCAN_LIMIT = 256

/** 兜底计数条目。 */
interface LocalFallbackEntry {
  current: number
  /** 本窗口开始时刻（read 沿用「timeWindow - 已过时间」的 TTL 口径）。 */
  start: number
  /** 本窗口到期时刻（TTL 计算与过期淘汰共用，跨路由比较时不依赖调用方参数）。 */
  expiresAt: number
}

/**
 * 全局共享兜底计数表：键 = 路由命名空间 + IP（不同路由的计数仍各自独立），容量全局共享。
 * Map 插入序被维护成 LRU 序：每次命中都重新入队，头部即最久未用。
 */
const localFallbackMap = new Map<string, LocalFallbackEntry>()

/** 因兜底表容量耗尽而被 fail-closed 拒绝的请求数（观测用）。 */
let localCapacityRejections = 0

/** 兜底表只读快照（测试与运维观测）。 */
export function getFailSafeLocalFallbackStats(): {
  size: number
  cap: number
  capacityRejections: number
} {
  return {
    size: localFallbackMap.size,
    cap: LOCAL_FALLBACK_CAP,
    capacityRejections: localCapacityRejections,
  }
}

/** 清空进程级兜底表（仅测试隔离用，不影响生产路径）。 */
export function resetFailSafeLocalFallbackForTests(): void {
  localFallbackMap.clear()
  localCapacityRejections = 0
}

/** 命中即刷新 LRU 顺序（Map 插入序 = 最近使用序，头部最久未用）。 */
function touchLocalFallback(key: string, entry: LocalFallbackEntry): void {
  localFallbackMap.delete(key)
  localFallbackMap.set(key, entry)
}

/**
 * 从 LRU 头开始淘汰一个**已过期**条目。
 * 只淘汰过期条目：仍活跃的窗口绝不静默丢弃（否则 IP 轮换即绕过限流），
 * 无可淘汰项时由调用方 fail-closed。扫描上限避免容量压力下退化成 O(n)。
 */
function evictExpiredLocalFallback(now: number): boolean {
  let scanned = 0
  for (const [key, entry] of localFallbackMap) {
    if (entry.expiresAt <= now) {
      localFallbackMap.delete(key)
      return true
    }
    if (++scanned >= LOCAL_EVICT_SCAN_LIMIT) break
  }
  return false
}

/** 进程内兜底存储（无 toad-cache 依赖，自实现定长窗口计数 + 全局容量保护 + LRU）。 */
class LocalFallbackStore {
  constructor(
    private readonly continueExceeding: boolean,
    private readonly exponentialBackoff: boolean,
  ) {}

  incr(key: string, cb: StoreCallback, timeWindow: number, max: number): void {
    const now = Date.now()
    let entry = localFallbackMap.get(key)
    if (entry && entry.expiresAt <= now) {
      localFallbackMap.delete(key)
      entry = undefined
    }
    if (entry) {
      entry.current++
      if (this.continueExceeding && entry.current > max) {
        entry.start = now
        entry.expiresAt = now + timeWindow
      } else if (this.exponentialBackoff && entry.current > max) {
        const backoff = Math.min(
          timeWindow * 2 ** (entry.current - max - 1),
          Number.MAX_SAFE_INTEGER,
        )
        entry.start = now
        entry.expiresAt = now + backoff
      }
      touchLocalFallback(key, entry)
      cb(null, { current: entry.current, ttl: Math.max(0, entry.expiresAt - now) })
      return
    }
    // 新窗口：容量满时只淘汰过期条目；没有可淘汰项则 fail-closed（返回 current > max）。
    if (localFallbackMap.size >= LOCAL_FALLBACK_CAP && !evictExpiredLocalFallback(now)) {
      localCapacityRejections++
      cb(null, { current: max + 1, ttl: timeWindow })
      return
    }
    localFallbackMap.set(key, { current: 1, start: now, expiresAt: now + timeWindow })
    cb(null, { current: 1, ttl: timeWindow })
  }

  read(key: string, cb: StoreCallback, timeWindow: number): void {
    const now = Date.now()
    const entry = localFallbackMap.get(key)
    if (!entry) {
      cb(null, { current: 0, ttl: 0 })
      return
    }
    if (entry.expiresAt <= now) {
      // 顺带清掉过期条目，避免兜底表被过期键长期占用容量。
      localFallbackMap.delete(key)
      cb(null, { current: 0, ttl: 0 })
      return
    }
    touchLocalFallback(key, entry)
    cb(null, { current: entry.current, ttl: Math.max(0, timeWindow - (now - entry.start)) })
  }
}

/**
 * 工厂：注入 Redis 客户端与命名空间，返回符合 @fastify/rate-limit 约定的 store 构造器。
 * 返回的构造器在 `new Store(globalParams)` 时忽略 globalParams 中的无关字段，
 * 仅读取 continueExceeding / exponentialBackoff（兜底 LRU 需要）。
 */
export function createFailSafeRateLimitStore(
  redis: Redis,
  namespace: string,
): FailSafeRateLimitStoreCtor {
  // ioredis defineCommand 动态注入的方法在类型上不存在，这里用受控的 any 调用。
  const r = redis as unknown as {
    ihuiRateLimit?: (...args: unknown[]) => void
    ihuiRateLimitRead?: (...args: unknown[]) => void
    defineCommand: (name: string, opts: { numberOfKeys: number; lua: string }) => void
  }
  if (!r.ihuiRateLimit) {
    r.defineCommand('ihuiRateLimit', { numberOfKeys: 1, lua: RATE_LIMIT_LUA })
  }
  if (!r.ihuiRateLimitRead) {
    r.defineCommand('ihuiRateLimitRead', { numberOfKeys: 1, lua: RATE_LIMIT_READ_LUA })
  }

  return class FailSafeStoreImpl implements FailSafeRateLimitStore {
    private readonly ns: string
    private readonly local: LocalFallbackStore
    private readonly continueExceeding: boolean
    private readonly exponentialBackoff: boolean

    constructor(globalParams?: StoreCtorOptions, ns: string = namespace) {
      this.ns = ns
      this.continueExceeding = globalParams?.continueExceeding ?? false
      this.exponentialBackoff = globalParams?.exponentialBackoff ?? false
      this.local = new LocalFallbackStore(this.continueExceeding, this.exponentialBackoff)
    }

    incr(ip: string, cb: StoreCallback, timeWindow: number, max: number): void {
      const fullKey = this.ns + ip
      r.ihuiRateLimit!(
        fullKey,
        String(timeWindow),
        String(max),
        String(this.continueExceeding),
        String(this.exponentialBackoff),
        (err: Error | null, res?: [number, number]) => {
          if (err || !res) {
            // Redis 故障 → 进程内保守兜底，绝不放行失败路径（键已含路由命名空间）
            this.local.incr(fullKey, cb, timeWindow, max)
            return
          }
          cb(null, { current: res[0], ttl: res[1] })
        },
      )
    }

    read(ip: string, cb: StoreCallback, timeWindow: number, _max: number): void {
      const fullKey = this.ns + ip
      r.ihuiRateLimitRead!(fullKey, (err: Error | null, res?: [number, number]) => {
        if (err || !res) {
          this.local.read(fullKey, cb, timeWindow)
          return
        }
        cb(null, { current: res[0], ttl: res[1] })
      })
    }

    child(routeOptions: StoreCtorOptions): FailSafeRateLimitStore {
      const method = routeOptions?.routeInfo?.method ?? ''
      const url = routeOptions?.routeInfo?.url ?? ''
      return new FailSafeStoreImpl(undefined, this.ns + method + url + '-')
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
