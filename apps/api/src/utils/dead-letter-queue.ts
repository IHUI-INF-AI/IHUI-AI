/**
 * Bug-165: 死信队列.
 *
 * 任务反复失败超过阈值后进入死信, 不再消耗重试资源;
 * 提供重投 / 丢弃 / 隔离 接口.
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug165_dlq.py
 */

/** 死信处理动作. */
export enum DLQAction {
  /** 重投成功, 已从队列移除 */
  REPLAY = 'REPLAY',
  /** 直接丢弃 */
  DROP = 'DROP',
  /** 隔离 (重投失败或无重投器) */
  QUARANTINE = 'QUARANTINE',
}

/** 死信条目. */
export interface DeadLetter {
  taskId: string
  name: string
  payload: unknown
  lastError: string
  attempts: number
  firstTs: number
  lastTs: number
  /** 错误历史 (最多保留 50 条) */
  history: string[]
}

/** 死信队列配置. */
export interface DLQConfig {
  /** 进入死信的最小尝试次数, 默认 5 */
  maxAttempts: number
  /** 队列最大容量, 默认 10000 */
  maxSize: number
  /** 保留时长(秒), 默认 7 天 */
  retentionSec: number
}

export const DEFAULT_DLQ_CONFIG: DLQConfig = {
  maxAttempts: 5,
  maxSize: 10_000,
  retentionSec: 7 * 24 * 3600,
}

type ReplayFn = (item: DeadLetter) => boolean

/**
 * 死信队列: 阈值进入, 增删查, 重投.
 */
export class DeadLetterQueue {
  private readonly config: DLQConfig
  private readonly replayFn?: ReplayFn
  private readonly items = new Map<string, DeadLetter>()

  constructor(config: Partial<DLQConfig> = {}, replay?: ReplayFn) {
    this.config = { ...DEFAULT_DLQ_CONFIG, ...config }
    this.replayFn = replay
  }

  /**
   * 推入一条死信.
   * @returns 仅当 attempts >= maxAttempts 时才会入队, 返回 DeadLetter; 否则返回 null
   */
  push(
    taskId: string,
    name: string,
    payload: unknown,
    err: string,
    attempts: number,
  ): DeadLetter | null {
    if (attempts < this.config.maxAttempts) return null
    const now = Date.now() / 1000
    const existing = this.items.get(taskId)
    if (!existing) {
      const item: DeadLetter = {
        taskId,
        name,
        payload,
        lastError: err,
        attempts,
        firstTs: now,
        lastTs: now,
        history: [err],
      }
      this.items.set(taskId, item)
      this.evictLocked(now)
      return item
    }
    existing.attempts = attempts
    existing.lastError = err
    existing.lastTs = now
    existing.history.push(err)
    if (existing.history.length > 50) {
      existing.history.splice(0, existing.history.length - 50)
    }
    this.evictLocked(now)
    return existing
  }

  /** 超容量 / 过期清理. */
  private evictLocked(now: number): void {
    const limit = now - this.config.retentionSec
    for (const [k, v] of this.items) {
      if (v.lastTs < limit) this.items.delete(k)
    }
    if (this.items.size <= this.config.maxSize) return
    // 按首次进入时间排序, 删除最旧的
    const sorted = Array.from(this.items.entries()).sort((a, b) => a[1].firstTs - b[1].firstTs)
    const removeCount = this.items.size - this.config.maxSize
    for (let i = 0; i < removeCount; i++) {
      const k = sorted[i]?.[0]
      if (k) this.items.delete(k)
    }
  }

  /** 获取单条死信. */
  get(taskId: string): DeadLetter | undefined {
    return this.items.get(taskId)
  }

  /** 列出死信 (按入队顺序, 截断 limit). */
  list(limit = 100): DeadLetter[] {
    return Array.from(this.items.values()).slice(0, limit)
  }

  /** 手动移除一条. */
  remove(taskId: string): boolean {
    return this.items.delete(taskId)
  }

  /** 重投一条死信. */
  replay(taskId: string): DLQAction {
    const item = this.items.get(taskId)
    if (!item) return DLQAction.DROP
    const fn = this.replayFn
    if (!fn) return DLQAction.QUARANTINE
    let ok = false
    try {
      ok = fn(item)
    } catch {
      ok = false
    }
    if (ok) {
      this.items.delete(taskId)
      return DLQAction.REPLAY
    }
    return DLQAction.QUARANTINE
  }

  /** 导出 JSON (不含 payload 细节). */
  exportJSON(): string {
    const arr = Array.from(this.items.values()).map((i) => ({
      taskId: i.taskId,
      name: i.name,
      attempts: i.attempts,
      firstTs: i.firstTs,
      lastTs: i.lastTs,
      lastError: i.lastError,
    }))
    return JSON.stringify(arr)
  }

  /** 统计. */
  stats(): { size: number } {
    return { size: this.items.size }
  }
}

/** 全局单例. */
export const deadLetterQueue = new DeadLetterQueue()
