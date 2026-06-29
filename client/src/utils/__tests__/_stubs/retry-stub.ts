/**
 * 历史遗留测试 ../retry 的占位模块
 * 源文件已废弃，此文件由 vitest.config.ts alias 解析
 */

export function calculateDelay(attempt: number, base: number, max: number): number {
  return Math.min(max, base * Math.pow(2, attempt))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface WithRetryOptions {
  retryCondition?: (e: unknown) => boolean
  maxRetries?: number
  baseDelay: number
  maxDelay: number
}

export async function withRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions): Promise<T> {
  const max = opts.maxRetries ?? 3
  let lastErr: unknown
  for (let i = 0; i <= max; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      if (opts.retryCondition && !opts.retryCondition(e)) throw e
    }
  }
  throw lastErr
}

export interface Retryable<T> { execute(): Promise<T> }
export function createRetryable<T>(fn: () => Promise<T>, _opts: object): Retryable<T> {
  return { execute: () => fn() }
}

export type CircuitState = 'closed' | 'open'

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private threshold: number
  constructor(opts: { failureThreshold: number; resetTimeout: number }) { this.threshold = opts.failureThreshold }
  getState(): CircuitState { return this.state }
  recordFailure(): void {
    this.threshold--
    if (this.threshold <= 0) this.state = 'open'
  }
  reset(): void { this.state = 'closed' }
}

export function useRetry(): { withRetry: typeof withRetry } {
  return { withRetry }
}
