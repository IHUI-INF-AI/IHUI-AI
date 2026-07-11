/**
 * 韧性模式扩展（M-10 补齐）。
 * 迁移自旧架构 server/app/resilience.py。
 *
 * 补齐 2 种缺失模式：
 * 1. degraded_mode — 降级兜底装饰器（服务不可用时返回 fallback 值）
 * 2. bulkhead — 信号量隔离（限制并发数，防止资源耗尽）
 */

/**
 * 降级兜底装饰器。
 * 当原函数抛出异常时，返回 fallback 值而非传播错误。
 * 适用于非关键路径（如缓存读取失败时返回默认值）。
 */
export async function degradedMode<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (err: Error) => void,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (onError) onError(err instanceof Error ? err : new Error(String(err)))
    return fallback
  }
}

/**
 * 信号量隔离（Bulkhead 模式）。
 * 限制并发请求数量，超出阈值的请求立即失败（快速失败策略）。
 * 防止单一服务耗尽整个连接池/线程池。
 */
export class Bulkhead {
  private active = 0
  private readonly maxConcurrency: number
  private readonly maxQueueSize: number
  private queue: Array<() => void> = []

  constructor(maxConcurrency = 10, maxQueueSize = 100) {
    this.maxConcurrency = maxConcurrency
    this.maxQueueSize = maxQueueSize
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrency) {
      if (this.queue.length >= this.maxQueueSize) {
        throw new Error(`Bulkhead rejected: max queue size (${this.maxQueueSize}) exceeded`)
      }
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      const next = this.queue.shift()
      if (next) next()
    }
  }

  get stats() {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueSize: this.maxQueueSize,
    }
  }

  /** 重置：清空等待队列（active 计数由执行中的任务自然释放）。 */
  reset(): void {
    this.queue = []
  }
}

/** 全局 Bulkhead 实例池（按名称索引） */
const bulkheads = new Map<string, Bulkhead>()

export function getBulkhead(name: string, maxConcurrency = 10, maxQueueSize = 100): Bulkhead {
  let b = bulkheads.get(name)
  if (!b) {
    b = new Bulkhead(maxConcurrency, maxQueueSize)
    bulkheads.set(name, b)
  }
  return b
}

/** 重置指定 Bulkhead：清空等待队列（active 计数由执行中的任务自然释放）。 */
export function resetBulkhead(name: string): boolean {
  const b = bulkheads.get(name)
  if (!b) return false
  b.reset()
  return true
}
