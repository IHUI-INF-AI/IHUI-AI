// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

interface BulkheadWaiter {
  resolve: () => void
  reject: (err: Error) => void
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
  private queue: BulkheadWaiter[] = []

  constructor(maxConcurrency = 10, maxQueueSize = 100) {
    this.maxConcurrency = maxConcurrency
    this.maxQueueSize = maxQueueSize
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrency) {
      if (this.queue.length >= this.maxQueueSize) {
        throw new Error(`Bulkhead rejected: max queue size (${this.maxQueueSize}) exceeded`)
      }
      // F-607/F-608:排队者拿到的是释放方直接移交的名额(不再自增),唤醒与占位原子化;
      // reset() 会 reject 等待者,避免排队请求永久悬挂。
      await new Promise<void>((resolve, reject) => {
        this.queue.push({ resolve, reject })
      })
    } else {
      this.active++
    }

    try {
      return await fn()
    } finally {
      this.releaseSlot()
    }
  }

  /** 释放名额:队列非空则直接移交给队首(active 保持不变),否则归还计数。 */
  private releaseSlot(): void {
    const next = this.queue.shift()
    if (next) {
      next.resolve()
      return
    }
    this.active--
  }

  get stats() {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueSize: this.maxQueueSize,
    }
  }

  /**
   * 重置：拒绝并清空等待队列（active 计数由执行中的任务自然释放）。
   * 排队者从未占位，因此这里只 reject，不触碰 active。
   */
  reset(): void {
    const pending = this.queue
    this.queue = []
    for (const waiter of pending) {
      waiter.reject(new Error('Bulkhead reset'))
    }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
