/**
 * TokenBucket + SuppressionTracker — 纯进程内速率限制。
 *
 * 灵感来源:参考 xai-grok-tools/src/implementations/grok_build/monitor/rate_limiter.rs
 * 简化策略(做减法):
 *   - 0 新依赖(无 lodash / p-limit),纯 TS
 *   - 滑动补充:`lastRefill += interval * refills`(避免 elapsed 累计浮点失真)
 *   - 抑制恢复时输出 catch-up 通知("suppressed N events")
 *   - 持续抑制 > 30s 自动 kill(防长尾冻结)
 *
 * 使用场景:
 *   - LLM 流式输出 token 节流(防突发计费)
 *   - 日志/事件总线写入节流(防终端 IO 抖动)
 *   - WebSocket 消息节流(防反压)
 *
 * 与现有 `apps/api/src/utils/ws-rate-limit.ts`(Redis ZSET 分布式)互补:
 *   - 分布式 ZSET 适合跨进程 / 跨实例
 *   - 本 TokenBucket 适合单进程内热路径(零 IO)
 */

export interface TokenBucketOpts {
  /** 最大令牌数 */
  capacity: number
  /** 补充 1 个令牌的间隔(毫秒) */
  refillIntervalMs: number
  /** 当前时间注入(测试用,默认 Date.now) */
  now?: () => number
}

/**
 * Token bucket rate limiter(滑动窗口 + 饱和上限)。
 *
 * 语义:
 *   - 起始 tokens = capacity(满桶)
 *   - 每次 tryConsume():先按 elapsed 补满(到 capacity 上限),再扣 1
 *   - 无 token 时返回 false(非阻塞,不等)
 *   - lastRefill 按 `refillInterval * refills` 累加,避免长时间空闲后突然扣 1
 *
 * 复杂度:tryConsume O(1),无分配
 */
export class TokenBucket {
  private readonly capacity: number
  private readonly refillIntervalMs: number
  private readonly now: () => number
  private tokens: number
  private lastRefillMs: number

  constructor(opts: TokenBucketOpts) {
    if (opts.capacity <= 0) {
      throw new RangeError('TokenBucket: capacity must be > 0')
    }
    if (opts.refillIntervalMs <= 0) {
      throw new RangeError('TokenBucket: refillIntervalMs must be > 0')
    }
    this.capacity = opts.capacity
    this.refillIntervalMs = opts.refillIntervalMs
    this.now = opts.now ?? Date.now
    this.tokens = opts.capacity
    this.lastRefillMs = this.now()
  }

  /**
   * 尝试取 1 个令牌。
   * - 有 token:扣 1,返回 true
   * - 无 token:返回 false(不阻塞)
   */
  tryConsume(): boolean {
    this.refill()
    if (this.tokens > 0) {
      this.tokens -= 1
      return true
    }
    return false
  }

  /**
   * 当前可用令牌数(测试用,生产代码不要读这个再决定 — 有竞态)
   */
  available(): number {
    this.refill()
    return this.tokens
  }

  /**
   * 主动触发补充(默认在 tryConsume 内自动,无需手动调用)
   */
  refill(): void {
    const now = this.now()
    const elapsed = now - this.lastRefillMs
    if (elapsed < 0) {
      // 时钟回拨:不补充,保护单调性
      return
    }
    const refills = Math.floor(elapsed / this.refillIntervalMs)
    if (refills > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + refills)
      this.lastRefillMs += refills * this.refillIntervalMs
    }
  }
}

export type RateLimitOutcome =
  /** 允许通过,可能有 catch-up 通知(说明之前被抑制过) */
  | { kind: 'allowed'; suppressedCount: number; catchUpNotice: string | null }
  /** 被抑制(本事件被丢弃) */
  | { kind: 'suppressed'; suppressedCount: number }
  /** 持续抑制 > 阈值,自动 kill(后续所有事件都被丢) */
  | { kind: 'autoKill'; message: string }

export interface SuppressionTrackerOpts {
  /** 持续抑制多久后自动 kill(毫秒),默认 30000 */
  autoKillThresholdMs?: number
  /** 输出 catch-up 通知的最小间隔(毫秒),默认 refill * 3 */
  catchUpMinIntervalMs?: number
  /** catch-up 通知文本模板,默认 "[{n} events suppressed — output rate too high]" */
  formatNotice?: (count: number) => string
  /** 当前时间注入(测试用) */
  now?: () => number
}

/**
 * 在 TokenBucket 之上的"抑制跟踪"包装。
 *
 * 用法:
 *   const bucket = new TokenBucket({ capacity: 10, refillIntervalMs: 100 })
 *   const tracker = new SuppressionTracker()
 *   const outcome = tracker.process(bucket.tryConsume(), 'tool x called')
 *   if (outcome.kind === 'allowed') { ... }
 *   else if (outcome.kind === 'suppressed') { (丢 / 计数) }
 *   else if (outcome.kind === 'autoKill') { (触发暂停 / 警告) }
 *
 * 行为:
 *   - 连续抑制计数 +1
 *   - 一旦允许通过,输出 "suppressed N events" 通知(给用户/日志看)
 *   - 持续抑制 > 30s → autoKill(类似熔断,需要外部重置)
 */
export class SuppressionTracker {
  private readonly autoKillThresholdMs: number
  private readonly catchUpMinIntervalMs: number
  private readonly formatNotice: (count: number) => string
  private readonly now: () => number

  private suppressedCount = 0
  private lastSuppressionMs: number | null = null
  private suppressionStartMs: number | null = null
  private killed = false

  constructor(opts: SuppressionTrackerOpts = {}) {
    this.autoKillThresholdMs = opts.autoKillThresholdMs ?? 30_000
    this.catchUpMinIntervalMs = opts.catchUpMinIntervalMs ?? 300
    this.formatNotice =
      opts.formatNotice ??
      ((n) => `[${n} events suppressed — output rate too high]`)
    this.now = opts.now ?? Date.now
  }

  /**
   * 处理一个事件,根据 `tokenAvailable` 决定允许/抑制/auto-kill。
   * `_description` 预留供日志/遥测使用(不影响决策)。
   */
  process(tokenAvailable: boolean, _description?: string): RateLimitOutcome {
    if (this.killed) {
      return { kind: 'suppressed', suppressedCount: this.suppressedCount }
    }
    if (tokenAvailable) {
      // 允许通过 — 检查是否需要 catch-up 通知
      let catchUpNotice: string | null = null
      if (this.suppressedCount > 0) {
        // 上次抑制是否已经"冷却"足够久?是的话重置起点
        if (
          this.lastSuppressionMs !== null &&
          this.now() - this.lastSuppressionMs > this.catchUpMinIntervalMs
        ) {
          this.suppressionStartMs = null
        }
        catchUpNotice = this.formatNotice(this.suppressedCount)
        const n = this.suppressedCount
        this.suppressedCount = 0
        return { kind: 'allowed', suppressedCount: n, catchUpNotice }
      }
      return { kind: 'allowed', suppressedCount: 0, catchUpNotice: null }
    }
    // 被抑制
    this.suppressedCount += 1
    const now = this.now()
    this.lastSuppressionMs = now
    if (this.suppressionStartMs === null) this.suppressionStartMs = now
    // 持续抑制超过阈值 → autoKill
    if (
      this.suppressionStartMs !== null &&
      now - this.suppressionStartMs > this.autoKillThresholdMs
    ) {
      this.killed = true
      return {
        kind: 'autoKill',
        message: this.formatNotice(this.suppressedCount),
      }
    }
    return { kind: 'suppressed', suppressedCount: this.suppressedCount }
  }

  /** 是否已 autoKill(被熔断) */
  isKilled(): boolean {
    return this.killed
  }

  /** 手动重置(autoKill 后用) */
  reset(): void {
    this.suppressedCount = 0
    this.lastSuppressionMs = null
    this.suppressionStartMs = null
    this.killed = false
  }
}
