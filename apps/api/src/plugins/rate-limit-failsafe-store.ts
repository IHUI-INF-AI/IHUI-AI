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

/** 进程内兜底存储（无 toad-cache 依赖，自实现定长窗口计数 + 上限保护）。 */
class LocalFallbackStore {
  private map = new Map<string, { current: number; ttl: number; start: number }>()
  constructor(
    private readonly continueExceeding: boolean,
    private readonly exponentialBackoff: boolean,
    private readonly cap = 20000,
  ) {}

  incr(ip: string, cb: StoreCallback, timeWindow: number, max: number): void {
    const now = Date.now()
    let entry = this.map.get(ip)
    if (!entry || entry.start + timeWindow <= now) {
      entry = { current: 1, ttl: timeWindow, start: now }
    } else {
      entry.current++
      if (this.continueExceeding && entry.current > max) {
        entry.ttl = timeWindow
        entry.start = now
      } else if (this.exponentialBackoff && entry.current > max) {
        const backoff = Math.min(
          timeWindow * 2 ** (entry.current - max - 1),
          Number.MAX_SAFE_INTEGER,
        )
        entry.ttl = backoff
        entry.start = now
      } else {
        entry.ttl = timeWindow - (now - entry.start)
      }
    }
    this.map.set(ip, entry)
    this.prune()
    cb(null, { current: entry.current, ttl: entry.ttl })
  }

  read(ip: string, cb: StoreCallback, timeWindow: number): void {
    const now = Date.now()
    const entry = this.map.get(ip)
    if (!entry || entry.start + timeWindow <= now) {
      cb(null, { current: 0, ttl: 0 })
      return
    }
    cb(null, { current: entry.current, ttl: timeWindow - (now - entry.start) })
  }

  /** 超过上限时淘汰最旧 1000 个键，防止内存无限增长。 */
  private prune(): void {
    if (this.map.size <= this.cap) return
    let n = 0
    for (const k of this.map.keys()) {
      this.map.delete(k)
      if (++n >= 1000) break
    }
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
            // Redis 故障 → 进程内保守兜底，绝不放行失败路径
            this.local.incr(ip, cb, timeWindow, max)
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
          this.local.read(ip, cb, timeWindow)
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
