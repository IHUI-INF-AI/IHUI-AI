// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * Redis 键设计(2026-11-13 F-556 修正):
 * - fail:login:{identity}    失败计数(纯 INCR,15 分钟 TTL)
 * - lock:login:{identity}    锁定标记(SET NX EX,15 分钟)
 *
 * identity 优先取登录路由解析到的用户 id(`user:{id}`):username / phone / email
 * 三个可互换标识指向同一用户时共享同一份失败计数与锁定窗口。修正前按原始账号串
 * 分桶,攻击者对同一账号的三种标识各失败 5 次即拿到 15 次配额(配额放大 3 倍)。
 * 解析不到用户、或解析查询失败(调用方拿不到 userId)时回退到规范化原始串
 * (手机号去空白/统一区号,邮箱与用户名 trim + 小写)—— 仍然计数并锁定,不因解析失败放行。
 *
 * 更早的修正(2026-10-27):key 曾为 {account}:{ip},同一账号换 IP 即重置计数,
 * 锁定近乎失效(分布式撞库每 IP 每 15 分钟 5 次无限续)。现改为按账号全局计数,
 * ip 参数保留于签名(调用点不动),暂不参与 key —— IP 维度滥用由全局
 * rate-limit(100 req/min/IP)与 anti-automation 兜底。
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
const fallbackStore = new Map<
  string,
  { failures: number; lockedUntil: number; lastFailAt: number }
>()

/** 账号标识归一:去空白 + 小写(免锁定名单匹配用,大小写变体不产生平行项) */
function normalizeAccount(account: string): string {
  return account.trim().toLowerCase()
}

/**
 * F-556:解析不到用户时的兜底身份键 —— 规范化原始账号串。
 * 手机号去空白/连字符/括号并统一 +86 / 0086 区号前缀;邮箱与用户名 trim + 小写。
 */
export function normalizeLockoutIdentity(account: string): string {
  const lower = account.trim().toLowerCase()
  const compact = lower.replace(/[\s\-()]/g, '')
  if (!/^(\+|00)?\d{7,15}$/.test(compact)) return lower
  const digits = compact.replace(/^\+/, '').replace(/^00/, '')
  return digits.length > 11 && digits.startsWith('86') ? digits.slice(2) : digits
}

/**
 * F-556:账号 → 锁定身份键。调用方(登录路由)已按标识解析出用户时传 userId,
 * username / phone / email 三个可互换标识因此共享同一份配额;解析不到用户
 * (或解析查询失败)时回退到规范化原始串 —— 仍然计数并锁定,不因解析失败放行。
 */
function lockoutIdentity(account: string, userId?: string | number | null): string {
  if (userId !== null && userId !== undefined) {
    const id = String(userId).trim()
    if (id) return `user:${id.toLowerCase()}`
  }
  return normalizeLockoutIdentity(account)
}

function fallbackRecordFailure(identity: string): number {
  const now = Date.now()
  const existing = fallbackStore.get(identity)
  if (!existing) {
    fallbackStore.set(identity, { failures: 1, lockedUntil: 0, lastFailAt: now })
    return MAX_FAILURES - 1
  }
  if (now - existing.lastFailAt > FAILURE_WINDOW_SEC * 1000) {
    fallbackStore.set(identity, { failures: 1, lockedUntil: 0, lastFailAt: now })
    return MAX_FAILURES - 1
  }
  existing.failures += 1
  existing.lastFailAt = now
  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = now + LOCK_DURATION_SEC * 1000
  }
  return Math.max(0, MAX_FAILURES - existing.failures)
}

function fallbackGetLockRemainingMs(identity: string): number {
  const record = fallbackStore.get(identity)
  if (!record) return 0
  const remaining = record.lockedUntil - Date.now()
  return remaining > 0 ? remaining : 0
}

function fallbackClearFailures(identity: string): void {
  fallbackStore.delete(identity)
}

/**
 * 把 fallback 计数抬到至少 target(两存储取最大值,只升不降),达阈值时一并置锁。
 * F-555:Redis 故障期的失败账本在 fallback,恢复后必须以它为准补齐,
 * 否则累计失败与锁定状态在恢复瞬间清零。
 */
function fallbackRaiseFailures(identity: string, target: number): void {
  const now = Date.now()
  const existing = fallbackStore.get(identity)
  if (!existing) {
    fallbackStore.set(identity, {
      failures: target,
      lockedUntil: target >= MAX_FAILURES ? now + LOCK_DURATION_SEC * 1000 : 0,
      lastFailAt: now,
    })
    return
  }
  if (target > existing.failures) existing.failures = target
  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = Math.max(existing.lockedUntil, now + LOCK_DURATION_SEC * 1000)
  }
}

/**
 * 免锁定账号名单(2026-11-11):逗号分隔,大小写不敏感,匹配用户名/邮箱/手机号任一标识。
 * 典型用途:本地开发环境把机主自己的 admin 账号排除在"5 次失败锁 15 分钟"之外,
 * 避免自己调试时被自己的安全策略锁死。生产通过环境变量留空即保持原有严格锁定。
 */
const LOCKOUT_EXEMPT_ACCOUNTS = new Set(
  (process.env.AUTH_LOCKOUT_EXEMPT_ACCOUNTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)

function isLockoutExempt(account: string): boolean {
  if (LOCKOUT_EXEMPT_ACCOUNTS.size === 0) return false
  return LOCKOUT_EXEMPT_ACCOUNTS.has(normalizeAccount(account))
}

/** 记录一次登录失败。返回剩余可重试次数;已达上限返回 0。 */
export async function recordLoginFailure(
  account: string,
  _ip: string,
  userId?: string | number | null,
): Promise<number> {
  // 免锁定账号:既不计失败次数,也不置锁,剩余次数恒为满额。
  if (isLockoutExempt(account)) return MAX_FAILURES

  // F-556:按账号归一化身份分桶,username/phone/email 命中同一用户时共享配额。
  const identity = lockoutIdentity(account, userId)

  // F-555:写路径双写。fallback 先记一次(Redis 故障时它就是唯一账本),
  // Redis 可用时再取两存储最大计数,并把 fallback 的累计值回填,避免恢复后清零。
  const localRemaining = fallbackRecordFailure(identity)
  const localCount = MAX_FAILURES - localRemaining

  const redis = getRedis()
  if (!redis) return localRemaining

  const failKey = `${KEY_PREFIX_FAIL}${identity}`
  const lockKey = `${KEY_PREFIX_LOCK}${identity}`
  try {
    const count = await redis.incr(failKey)
    if (count === 1) {
      await redis.expire(failKey, FAILURE_WINDOW_SEC)
    }
    const effective = Math.max(count, localCount)
    if (effective > count) {
      // 故障期 fallback 计得更多:回填 Redis(best-effort,失败只告警)
      try {
        await redis.set(failKey, String(effective), 'EX', FAILURE_WINDOW_SEC)
      } catch (e) {
        logger.warn('[account-lockout] backfill failure count to redis failed', { error: e })
      }
    }
    if (effective > localCount) {
      fallbackRaiseFailures(identity, effective)
    }
    if (effective >= MAX_FAILURES) {
      await redis.set(lockKey, '1', 'EX', LOCK_DURATION_SEC, 'NX')
    }
    return Math.max(0, MAX_FAILURES - effective)
  } catch (e) {
    logger.error('[account-lockout] recordLoginFailure redis failed, fallback to memory', {
      error: e,
    })
    // 本次失败已在上方写入 fallback,不再重复计数(会放大失败次数)。
    return localRemaining
  }
}

/** 查询账号/IP 是否被锁定。返回剩余锁定毫秒数,0 表示未锁。 */
export async function getLockRemainingMs(
  account: string,
  _ip: string,
  userId?: string | number | null,
): Promise<number> {
  if (isLockoutExempt(account)) return 0

  // F-556:读取与写入共用同一归一化身份键(带 userId 优先)。
  const identity = lockoutIdentity(account, userId)

  // F-555:读路径合并两存储,取更严格(剩余更长)的结果。
  const localRemaining = fallbackGetLockRemainingMs(identity)
  const redis = getRedis()
  if (!redis) return localRemaining

  const lockKey = `${KEY_PREFIX_LOCK}${identity}`
  try {
    const ttl = await redis.ttl(lockKey)
    const redisRemaining = ttl > 0 ? ttl * 1000 : 0
    if (localRemaining > redisRemaining) {
      // Redis 恢复后把 fallback 中的锁定回填(best-effort,失败只告警),让多实例同口径
      try {
        await redis.set(lockKey, '1', 'EX', Math.ceil(localRemaining / 1000))
      } catch (e) {
        logger.warn('[account-lockout] backfill lock to redis failed', { error: e })
      }
      return localRemaining
    }
    return redisRemaining
  } catch (e) {
    logger.error('[account-lockout] getLockRemainingMs redis failed, fallback to memory', {
      error: e,
    })
    return localRemaining
  }
}

/** 登录成功时清空失败计数与锁定。 */
export async function clearLoginFailures(
  account: string,
  _ip: string,
  userId?: string | number | null,
): Promise<void> {
  // F-556:清空同样按归一化身份键,避免成功登录后三种标识的配额不同步。
  const identity = lockoutIdentity(account, userId)
  // F-555:双写之后成功路径必须同时清两存储,否则 fallback 残留计数/锁会继续生效。
  fallbackClearFailures(identity)
  const redis = getRedis()
  if (!redis) return
  try {
    const failKey = `${KEY_PREFIX_FAIL}${identity}`
    const lockKey = `${KEY_PREFIX_LOCK}${identity}`
    await redis.del(failKey, lockKey)
  } catch (e) {
    logger.error('[account-lockout] clearLoginFailures redis failed, fallback already cleared', {
      error: e,
    })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
