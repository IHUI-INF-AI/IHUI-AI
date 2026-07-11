/**
 * 死锁重试（bug199）。
 *
 * 检测到数据库死锁或序列化失败时自动重试，采用指数退避 + 抖动策略，
 * 避免事务冲突导致请求直接失败。
 *
 * 识别的错误码：
 * - PostgreSQL SQLSTATE: 40P01 (deadlock_detected), 40001 (serialization_failure)
 * - MySQL errno: 1213 (deadlock), 1205 (lock_wait_timeout)
 * - 异常消息关键字兜底匹配
 *
 * 迁移自旧架构 bug199_deadlock_retry.py。
 */

/** 死锁重试配置。 */
export interface DeadlockRetryConfig {
  /** 最大尝试次数（含首次执行），默认 5 */
  maxAttempts: number
  /** 基础退避延迟（毫秒），默认 20 */
  baseDelayMs: number
  /** 最大退避延迟（毫秒），默认 500 */
  maxDelayMs: number
  /**
   * 需要识别的错误码集合。
   * PostgreSQL SQLSTATE 为字符串（如 "40P01"）；MySQL errno 为数字（如 1213）。
   */
  errorCodes: ReadonlyArray<string | number>
}

/** 默认配置。 */
export const DEFAULT_DEADLOCK_RETRY_CONFIG: DeadlockRetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 20,
  maxDelayMs: 500,
  errorCodes: ['40P01', '40001', 1213, 1205],
}

/** 重试统计。 */
export interface DeadlockRetryStats {
  /** 已重试次数 */
  retried: number
  /** 成功次数 */
  success: number
  /** 重试耗尽次数 */
  exhausted: number
}

/**
 * 判断异常是否为死锁/序列化失败。
 *
 * 检查顺序：
 * 1. PostgreSQL 的 pgcode / sqlstate / code 属性
 * 2. MySQL 的 errno / number 属性及 args 元组
 * 3. 异常消息关键字兜底（deadlock / serialization failure）
 */
export function isDeadlockError(
  err: unknown,
  codes: ReadonlyArray<string | number> = DEFAULT_DEADLOCK_RETRY_CONFIG.errorCodes,
): boolean {
  const strCodes = new Set(codes.filter((c): c is string => typeof c === 'string'))
  const intCodes = new Set(codes.filter((c): c is number => typeof c === 'number'))

  if (err !== null && typeof err === 'object') {
    const e = err as Record<string, unknown>

    // PostgreSQL: pgcode / sqlstate / code（字符串型 SQLSTATE）
    for (const attr of ['pgcode', 'sqlstate', 'code']) {
      const v = e[attr]
      if (typeof v === 'string' && strCodes.has(v)) return true
    }

    // MySQL: errno / number（整数型 errno 或字符串型 SQLSTATE）
    for (const attr of ['errno', 'number']) {
      const v = e[attr]
      if (typeof v === 'number' && intCodes.has(v)) return true
      if (typeof v === 'string' && strCodes.has(v)) return true
    }

    // args 元组（部分驱动把错误码放在 args 中）
    const args = e['args']
    if (Array.isArray(args)) {
      for (const a of args) {
        if (typeof a === 'number' && intCodes.has(a)) return true
        if (typeof a === 'string' && strCodes.has(a)) return true
      }
    }
  }

  // 消息关键字兜底
  const msg = String(err).toLowerCase()
  return msg.includes('deadlock') || msg.includes('serialization failure')
}

/** 计算指数退避延迟（含 ±20% 抖动）。 */
function backoffDelay(attempt: number, config: DeadlockRetryConfig): number {
  const base = Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(2, attempt - 1))
  const jitter = Math.floor(base * 0.2)
  // [-jitter, +jitter] 随机偏移
  const offset = Math.floor((Math.random() * 2 - 1) * jitter)
  return Math.max(0, base + offset)
}

/**
 * 死锁重试器：封装重试逻辑与统计。
 */
export class DeadlockRetrier {
  private readonly config: DeadlockRetryConfig
  private readonly stats: DeadlockRetryStats = { retried: 0, success: 0, exhausted: 0 }

  constructor(config: DeadlockRetryConfig = DEFAULT_DEADLOCK_RETRY_CONFIG) {
    this.config = config
  }

  /**
   * 执行可能抛死锁异常的异步函数，自动重试。
   * @returns fn 的返回值
   * @throws 重试耗尽后抛出最后一次异常；非死锁异常立即抛出
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn()
        this.stats.success++
        return result
      } catch (err) {
        lastErr = err
        // 非死锁异常不重试，直接抛出
        if (!isDeadlockError(err, this.config.errorCodes)) throw err
        // 已达最大次数，跳出
        if (attempt >= this.config.maxAttempts) break
        this.stats.retried++
        const delay = backoffDelay(attempt, this.config)
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
      }
    }
    this.stats.exhausted++
    throw lastErr
  }

  /** 获取重试统计快照。 */
  getStats(): DeadlockRetryStats {
    return { ...this.stats }
  }
}

/**
 * 带死锁重试的高阶函数。
 *
 * @param fn 要执行的异步函数
 * @param config 重试配置，默认 maxAttempts=5
 * @returns fn 的返回值
 *
 * @example
 * const result = await withDeadlockRetry(() => db.transaction(async (tx) => {
 *   await tx.update(accounts).set({ balance: 100 }).where(eq(accounts.id, userId));
 * }));
 */
export async function withDeadlockRetry<T>(
  fn: () => Promise<T>,
  config: DeadlockRetryConfig = DEFAULT_DEADLOCK_RETRY_CONFIG,
): Promise<T> {
  const retrier = new DeadlockRetrier(config)
  return retrier.call(fn)
}
