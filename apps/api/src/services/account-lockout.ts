/**
 * 账号登录失败锁定服务。
 *
 * 设计目标：
 * - 防止密码爆破：连续 N 次失败后临时锁定账号。
 * - 防止单 IP 横扫：按 (account, ip) 双重维度记录。
 * - 锁定后即便密码正确也拒绝登录，避免攻击者耗尽后撞中。
 * - 进程内 Map 存储（无 Redis 依赖），多实例部署时每实例独立计数；
 *   若需全局一致可后续迁移至 Redis（接口与 distributedRateLimit 一致）。
 */
interface AttemptRecord {
  /** 连续失败次数 */
  failures: number
  /** 锁定到期时间戳（毫秒） */
  lockedUntil: number
  /** 最后一次失败时间 */
  lastFailAt: number
}

const MAX_FAILURES = 5
const LOCK_DURATION_MS = 15 * 60 * 1000
const FAILURE_WINDOW_MS = 15 * 60 * 1000
const store = new Map<string, AttemptRecord>()

function key(account: string, ip: string): string {
  return `${account}::${ip}`
}

/** 记录一次登录失败。返回剩余可重试次数；已达上限返回 0。 */
export function recordLoginFailure(account: string, ip: string): number {
  const k = key(account, ip)
  const now = Date.now()
  const existing = store.get(k)

  if (!existing) {
    store.set(k, { failures: 1, lockedUntil: 0, lastFailAt: now })
    return MAX_FAILURES - 1
  }

  // 失败窗口外重置计数
  if (now - existing.lastFailAt > FAILURE_WINDOW_MS) {
    store.set(k, { failures: 1, lockedUntil: 0, lastFailAt: now })
    return MAX_FAILURES - 1
  }

  existing.failures += 1
  existing.lastFailAt = now

  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = now + LOCK_DURATION_MS
  }
  return Math.max(0, MAX_FAILURES - existing.failures)
}

/** 查询账号/IP 是否被锁定。返回剩余锁定毫秒数，0 表示未锁。 */
export function getLockRemainingMs(account: string, ip: string): number {
  const record = store.get(key(account, ip))
  if (!record) return 0
  const remaining = record.lockedUntil - Date.now()
  return remaining > 0 ? remaining : 0
}

/** 登录成功时清空失败计数。 */
export function clearLoginFailures(account: string, ip: string): void {
  store.delete(key(account, ip))
}

export const ACCOUNT_LOCKOUT_CONFIG = {
  maxFailures: MAX_FAILURES,
  lockDurationMs: LOCK_DURATION_MS,
  failureWindowMs: FAILURE_WINDOW_MS,
} as const
