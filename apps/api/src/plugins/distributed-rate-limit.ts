import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { normalizeHeader } from '../utils/http-normalize.js'

/**
 * 分布式限流插件。
 *
 * 迁移自旧架构 server/app/utils/rate_limit_dist.py + fair_rate_limit.py。
 *
 * 三项能力：
 * 1. Redis 滑动窗口限流（Lua ZSET 原子计数，多实例生效）。
 * 2. 公平限流：按 scope 值（用户/IP/租户）权重均衡分配额度，高权重获得更高配额。
 * 3. 自适应限流：根据事件循环延迟动态计算 loadFactor（1.0 正常 → 0.5 高负载），
 *    系统繁忙时自动收紧限额，避免雪崩。
 *
 * Redis 不可用时 fail-open（放行），保障可用性。
 */
const KEY_PREFIX = 'ihui:ratelimit'

// Lua 滑动窗口：ZSET 按 score(now_ms) 记录请求，清理窗口外成员后计数。
// KEYS[1]=bucket key, ARGV=[limit, windowMs, nowMs]
// 返回 [allowed(0/1), count, retryAfterMs]
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now_ms - window_ms)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset_after = window_ms
  if oldest[2] then
    reset_after = math.max(0, tonumber(oldest[2]) + window_ms - now_ms)
  end
  return {0, count, reset_after}
end
redis.call('ZADD', key, now_ms, now_ms .. ':' .. math.random(1, 1000000000))
redis.call('PEXPIRE', key, window_ms)
return {1, count + 1, window_ms}
`

export type RateLimitScope = 'ip' | 'user' | 'tenant' | 'api_key' | 'global'

export interface RateLimitRule {
  name: string
  limit: number
  windowSec: number
  scope: RateLimitScope
}

export interface RateLimitResult {
  allowed: boolean
  count: number
  limit: number
  retryAfterMs: number
  remaining: number
  rule: string
}

declare module 'fastify' {
  interface FastifyInstance {
    distributedRateLimit: {
      /** 注册限流规则 */
      addRule(rule: RateLimitRule): void
      /** 检查是否放行（按规则名 + 请求提取 scope 值） */
      check(ruleName: string, request: FastifyRequest): Promise<RateLimitResult>
      /** 设置 scope 值的公平权重（默认 1.0） */
      setWeight(scopeValue: string, weight: number): void
      /** 统计信息 */
      stats(): {
        rules: RateLimitRule[]
        totalAllowed: number
        totalBlocked: number
        loadFactor: number
      }
      /** 生成 preHandler，命中限流返回 429 */
      preHandler(ruleName: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    }
  }
}

function extractScope(scope: RateLimitScope, request: FastifyRequest): string {
  switch (scope) {
    case 'ip':
      return `ip:${request.ip}`
    case 'user':
      return `user:${request.userId ?? 'anonymous'}`
    case 'tenant':
      return `tenant:${normalizeHeader(request.headers['x-tenant-id']) ?? '0'}`
    case 'api_key':
      return `apikey:${normalizeHeader(request.headers['x-api-key']) ?? 'none'}`
    case 'global':
      return 'global:all'
  }
}

const distributedRateLimitPlugin: FastifyPluginAsync = async (server) => {
  const rules = new Map<string, RateLimitRule>()
  const weights = new Map<string, number>()
  let totalAllowed = 0
  let totalBlocked = 0
  // 2026-07-22 P0 Round 3:本地 token bucket 降级存储(Redis 故障时使用)
  // key=bucketKey, value={timestamps: number[]},超过 10000 个 key 时 clear() 防内存泄漏
  const localBuckets = new Map<string, { timestamps: number[] }>()

  // 事件循环延迟监控：用于自适应限流
  const histogram = monitorEventLoopDelay()
  histogram.enable()

  function computeLoadFactor(): number {
    const meanMs = histogram.mean / 1e6 // ns -> ms
    if (!Number.isFinite(meanMs) || meanMs <= 50) return 1.0
    if (meanMs >= 1000) return 0.5
    // 线性：1.0 @ 50ms → 0.5 @ 1000ms
    return 1.0 - 0.5 * ((meanMs - 50) / 950)
  }

  function addRule(rule: RateLimitRule): void {
    rules.set(rule.name, rule)
  }

  function setWeight(scopeValue: string, weight: number): void {
    weights.set(scopeValue, weight)
  }

  async function check(ruleName: string, request: FastifyRequest): Promise<RateLimitResult> {
    const rule = rules.get(ruleName)
    if (!rule) {
      return { allowed: true, count: 0, limit: 0, retryAfterMs: 0, remaining: -1, rule: ruleName }
    }
    const scopeValue = extractScope(rule.scope, request)
    const weight = weights.get(scopeValue) ?? 1
    const loadFactor = computeLoadFactor()
    // 公平限流：按权重放大额度；自适应限流：按负载收紧额度
    const effectiveLimit = Math.max(1, Math.round(rule.limit * weight * loadFactor))
    const windowMs = Math.round(rule.windowSec * 1000)
    const nowMs = Date.now()
    const bucketKey = `${KEY_PREFIX}:${ruleName}:${scopeValue}`

    try {
      const res = (await server.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        bucketKey,
        String(effectiveLimit),
        String(windowMs),
        String(nowMs),
      )) as number[]
      const allowed = (res[0] ?? 0) === 1
      const count = Number(res[1] ?? 0)
      const retryAfterMs = Number(res[2] ?? 0)
      if (allowed) totalAllowed++
      else totalBlocked++
      return {
        allowed,
        count,
        limit: effectiveLimit,
        retryAfterMs,
        remaining: Math.max(0, effectiveLimit - count),
        rule: ruleName,
      }
    } catch (e) {
      // 2026-07-22 P0 Round 3 鲁棒性加固:Redis 故障降级本地 token bucket
      // 原:fail-open 直接放行(限流失效,攻击者可无限调用)
      // 新:降级到进程内 token bucket(单实例限流,多实例下不如 Redis 精确但有保护)
      server.log.warn({ err: e }, 'distributed rate limit redis failed, fallback to local token bucket')
      return localTokenBucket(bucketKey, effectiveLimit, windowMs, nowMs, ruleName)
    }
  }

  /**
   * 本地 token bucket 降级(Redis 故障时使用)。
   * 进程内 Map 存储最近请求时间戳,按滑动窗口计数。
   * 多实例下每个实例独立计数(限额会被放大 N 倍),但仍提供基本保护。
   */
  function localTokenBucket(
    bucketKey: string,
    limit: number,
    windowMs: number,
    nowMs: number,
    ruleName: string,
  ): { allowed: boolean; count: number; limit: number; retryAfterMs: number; remaining: number; rule: string } {
    const bucket = localBuckets.get(bucketKey) ?? { timestamps: [] as number[] }
    // 清理窗口外时间戳
    const cutoff = nowMs - windowMs
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff)
    if (bucket.timestamps.length >= limit) {
      // 被限流:计算最早时间戳何时过期
      const oldest = bucket.timestamps[0] ?? nowMs
      const retryAfterMs = Math.max(0, oldest + windowMs - nowMs)
      // 更新 bucket(防止 Map 无限增长:超过 10000 个 key 时清理最旧的)
      if (localBuckets.size > 10_000) {
        localBuckets.clear()
      }
      localBuckets.set(bucketKey, bucket)
      return {
        allowed: false,
        count: bucket.timestamps.length,
        limit,
        retryAfterMs,
        remaining: 0,
        rule: ruleName,
      }
    }
    bucket.timestamps.push(nowMs)
    if (localBuckets.size > 10_000) {
      localBuckets.clear()
    }
    localBuckets.set(bucketKey, bucket)
    return {
      allowed: true,
      count: bucket.timestamps.length,
      limit,
      retryAfterMs: 0,
      remaining: Math.max(0, limit - bucket.timestamps.length),
      rule: ruleName,
    }
  }

  function preHandler(ruleName: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await check(ruleName, request)
      reply.header('X-RateLimit-Limit', String(result.limit))
      if (!result.allowed) {
        reply.header('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
        reply.header('X-RateLimit-Remaining', '0')
        reply.code(429).send({ code: 429, message: '请求过于频繁，请稍后再试' })
      } else {
        reply.header('X-RateLimit-Remaining', String(result.remaining))
      }
    }
  }

  server.decorate('distributedRateLimit', {
    addRule,
    check,
    setWeight,
    stats: () => ({
      rules: [...rules.values()],
      totalAllowed,
      totalBlocked,
      loadFactor: computeLoadFactor(),
    }),
    preHandler,
  })
}

export const distributedRateLimit = fp(distributedRateLimitPlugin, {
  name: 'distributed-rate-limit',
  fastify: '5.x',
})
