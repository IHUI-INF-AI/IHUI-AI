/**
 * 账号登录失败锁定服务(Redis 后端)。
 *
 * 设计目标:
 * - 防止密码爆破:连续 N 次失败后临时锁定账号。
 * - 防止单 IP 横扫:按 (account, ip) 双重维度记录。
 * - 锁定后即便密码正确也拒绝登录,避免攻击者耗尽后撞中。
 * - Redis 后端 → 多实例部署时计数一致(进程内 Map 不一致)。
 * - Redis 不可用时降级为进程内 Map,保证基础可用性。
 *
 * Redis 键设计:
 * - fail:login:{account}:{ip}    失败计数(纯 INCR,15 分钟 TTL)
 * - lock:login:{account}:{ip}    锁定标记(SET NX EX,15 分钟)
 */
import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

const MAX_FAILURES = 5
const LOCK_DURATION_SEC = 15 * 60
const FAILURE_WINDOW_SEC = 15 * 60
const KEY_PREFIX_FAIL = 'fail:login:'
const KEY_PREFIX_LOCK = 'lock:login:'

let redisClient: Redis | null = null

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    })
    redisClient.on('error', (err) => {
      logger.error('[account-lockout] redis error', { error: err })
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  } catch (e) {
    logger.error('[account-lockout] redis init failed', { error: e })
    redisClient = null
  }
  return redisClient
}

/** 进程内降级存储(Redis 不可用时) */
const fallbackStore = new Map<string, { failures: number; lockedUntil: number; lastFailAt: number }>()

function fallbackKey(account: string, ip: string): string {
  return `${account}::${ip}`
}

function fallbackRecordFailure(account: string, ip: string): number {
  const k = fallbackKey(account, ip)
  const now = Date.now()
  const existing = fallbackStore.get(k)
  if (!existing) {
    fallbackStore.set(k, { failures: 1, lockedUntil: 0, lastFailAt: now })
    return MAX_FAILURES - 1
  }
  if (now - existing.lastFailAt > FAILURE_WINDOW_SEC * 1000) {
    fallbackStore.set(k, { failures: 1, lockedUntil: 0, lastFailAt: now })
    return MAX_FAILURES - 1
  }
  existing.failures += 1
  existing.lastFailAt = now
  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = now + LOCK_DURATION_SEC * 1000
  }
  return Math.max(0, MAX_FAILURES - existing.failures)
}

function fallbackGetLockRemainingMs(account: string, ip: string): number {
  const record = fallbackStore.get(fallbackKey(account, ip))
  if (!record) return 0
  const remaining = record.lockedUntil - Date.now()
  return remaining > 0 ? remaining : 0
}

function fallbackClearFailures(account: string, ip: string): void {
  fallbackStore.delete(fallbackKey(account, ip))
}

/** 记录一次登录失败。返回剩余可重试次数;已达上限返回 0。 */
export async function recordLoginFailure(account: string, ip: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return fallbackRecordFailure(account, ip)

  const failKey = `${KEY_PREFIX_FAIL}${account}:${ip}`
  const lockKey = `${KEY_PREFIX_LOCK}${account}:${ip}`
  try {
    const count = await redis.incr(failKey)
    if (count === 1) {
      await redis.expire(failKey, FAILURE_WINDOW_SEC)
    }
    if (count >= MAX_FAILURES) {
      await redis.set(lockKey, '1', 'EX', LOCK_DURATION_SEC, 'NX')
    }
    return Math.max(0, MAX_FAILURES - count)
  } catch (e) {
    logger.error('[account-lockout] recordLoginFailure redis failed, fallback to memory', { error: e })
    return fallbackRecordFailure(account, ip)
  }
}

/** 查询账号/IP 是否被锁定。返回剩余锁定毫秒数,0 表示未锁。 */
export async function getLockRemainingMs(account: string, ip: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return fallbackGetLockRemainingMs(account, ip)

  const lockKey = `${KEY_PREFIX_LOCK}${account}:${ip}`
  try {
    const ttl = await redis.ttl(lockKey)
    if (ttl > 0) return ttl * 1000
    return 0
  } catch (e) {
    logger.error('[account-lockout] getLockRemainingMs redis failed, fallback to memory', { error: e })
    return fallbackGetLockRemainingMs(account, ip)
  }
}

/** 登录成功时清空失败计数与锁定。 */
export async function clearLoginFailures(account: string, ip: string): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    fallbackClearFailures(account, ip)
    return
  }
  try {
    const failKey = `${KEY_PREFIX_FAIL}${account}:${ip}`
    const lockKey = `${KEY_PREFIX_LOCK}${account}:${ip}`
    await redis.del(failKey, lockKey)
  } catch (e) {
    logger.error('[account-lockout] clearLoginFailures redis failed, fallback to memory', { error: e })
    fallbackClearFailures(account, ip)
  }
}

export const ACCOUNT_LOCKOUT_CONFIG = {
  maxFailures: MAX_FAILURES,
  lockDurationSec: LOCK_DURATION_SEC,
  failureWindowSec: FAILURE_WINDOW_SEC,
} as const

/** 仅供测试:重置内部 Redis 单例 + fallback 存储。 */
export function _resetAccountLockoutForTests(): void {
  redisClient?.quit().catch(() => {
    /* ignore */
  })
  redisClient = null
  fallbackStore.clear()
}
