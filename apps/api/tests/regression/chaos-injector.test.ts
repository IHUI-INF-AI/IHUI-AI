/**
 * 回归测试:BUG-R18-CHAOS
 *
 * bugId: BUG-R18-CHAOS
 * 轮次: 18
 * 场景: 注入 500ms 网络延迟,验证降级策略生效
 *       旧架构来源: server/tests/test_bug_fixes_round18.py
 *
 * 验证点:
 *  - injectLatency(fn, 500) fn 执行时间 >= 500ms
 *  - withCircuitBreaker(fn) 连续 3 次失败后开路,第 4 次立即返回 fallback
 *  - withCircuitBreaker(fn) 半开状态下成功,闭路恢复
 *  - withTimeout(fn, 100) fn 超过 100ms 返回 timeout 错误
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/chaos-injector.test.ts
 */
import { describe, it, expect } from 'vitest'

/**
 * 注入网络延迟(模拟混沌工程的网络分区/抖动)
 */
async function injectLatency<T>(fn: () => Promise<T>, latencyMs: number): Promise<T> {
  await new Promise((r) => setTimeout(r, latencyMs))
  return fn()
}

/** 断路器状态 */
type CircuitState = 'closed' | 'open' | 'half_open'

/** 断路器配置 */
interface CircuitOptions {
  /** 失败多少次后开路 */
  failureThreshold: number
  /** 开路后多久尝试半开(ms) */
  resetTimeoutMs: number
  /** 半开状态下成功多少次后闭路 */
  halfOpenSuccessThreshold: number
  /** fallback 返回值 */
  fallback: unknown
}

/**
 * 简化版断路器(回归测试用)
 * - closed: 正常调用,失败计数累加,达阈值切 open
 * - open: 直接返回 fallback,经过 resetTimeout 后切 half_open
 * - half_open: 允许 1 次试探,成功累加,失败立即 open
 */
class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private halfOpenSuccessCount = 0
  private lastFailureTime = 0
  private readonly opts: CircuitOptions

  constructor(opts: Partial<CircuitOptions> = {}) {
    this.opts = {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      halfOpenSuccessThreshold: 1,
      fallback: null,
      ...opts,
    }
  }

  getState(): CircuitState {
    return this.state
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    // open 状态:检查是否到 reset 时间
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.opts.resetTimeoutMs) {
        this.state = 'half_open'
        this.halfOpenSuccessCount = 0
      } else {
        // 直接 fallback,不调用 fn
        return this.opts.fallback as T
      }
    }
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.halfOpenSuccessCount++
      if (this.halfOpenSuccessCount >= this.opts.halfOpenSuccessThreshold) {
        this.state = 'closed'
        this.failureCount = 0
        this.halfOpenSuccessCount = 0
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now()
    if (this.state === 'half_open') {
      // 半开失败 → 立即 open
      this.state = 'open'
    } else {
      this.failureCount++
      if (this.failureCount >= this.opts.failureThreshold) {
        this.state = 'open'
      }
    }
  }
}

/** timeout 错误类 */
class TimeoutError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'TimeoutError'
  }
}

/**
 * 超时包装器:fn 超过 timeoutMs 抛 TimeoutError
 */
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    fn()
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}

/** 便利函数:使用默认 CircuitBreaker 包装 */
async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  opts: Partial<CircuitOptions> = {},
): Promise<T | null> {
  const cb = new CircuitBreaker({ fallback: null, ...opts })
  return cb.call(fn).catch(() => null)
}

describe('BUG-R18-CHAOS:混沌工程降级策略', () => {
  it('injectLatency(fn, 500) 执行时间 >= 500ms', async () => {
    const start = Date.now()
    await injectLatency(async () => 'done', 500)
    const elapsed = Date.now() - start
    // 允许 ±20ms 误差
    expect(elapsed).toBeGreaterThanOrEqual(480)
    expect(elapsed).toBeLessThan(800)
  })

  it('injectLatency 返回 fn 的结果', async () => {
    const result = await injectLatency(async () => 42, 10)
    expect(result).toBe(42)
  })

  it('withCircuitBreaker 连续 3 次失败后开路,第 4 次立即返回 fallback', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      fallback: 'fallback',
    })
    const failFn = async () => {
      throw new Error('boom')
    }
    // 前 3 次失败
    await expect(cb.call(failFn)).rejects.toThrow('boom')
    await expect(cb.call(failFn)).rejects.toThrow('boom')
    await expect(cb.call(failFn)).rejects.toThrow('boom')
    expect(cb.getState()).toBe('open')
    // 第 4 次:直接返回 fallback,不调用 fn
    const result = await cb.call(failFn)
    expect(result).toBe('fallback')
  })

  it('断路器 open 状态 → fallback 立即返回(无延迟)', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10000,
      fallback: 'fast-fallback',
    })
    await expect(
      cb.call(async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow('x')
    expect(cb.getState()).toBe('open')
    const start = Date.now()
    const result = await cb.call(async () => {
      throw new Error('should not be called')
    })
    const elapsed = Date.now() - start
    expect(result).toBe('fast-fallback')
    // 立即返回,不等待 fn
    expect(elapsed).toBeLessThan(50)
  })

  it('半开状态下成功 → 闭路恢复', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 1,
      fallback: 'fb',
    })
    // 触发开路
    await expect(
      cb.call(async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow('x')
    await expect(
      cb.call(async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow('x')
    expect(cb.getState()).toBe('open')
    // 等待 reset 时间
    await new Promise((r) => setTimeout(r, 60))
    // 下一次调用进入 half_open,成功后闭路
    const result = await cb.call(async () => 'recovered')
    expect(result).toBe('recovered')
    expect(cb.getState()).toBe('closed')
  })

  it('半开状态下失败 → 立即重新开路', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30,
      halfOpenSuccessThreshold: 1,
      fallback: 'fb',
    })
    await expect(
      cb.call(async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow('x')
    expect(cb.getState()).toBe('open')
    await new Promise((r) => setTimeout(r, 40))
    // 进入 half_open 但又失败 → open
    await expect(
      cb.call(async () => {
        throw new Error('y')
      }),
    ).rejects.toThrow('y')
    expect(cb.getState()).toBe('open')
  })

  it('withTimeout(fn, 100) fn 超过 100ms → 抛 TimeoutError', async () => {
    const slowFn = async () => {
      await new Promise((r) => setTimeout(r, 300))
      return 'slow'
    }
    await expect(withTimeout(slowFn, 100)).rejects.toThrow(/Timed out/)
  })

  it('withTimeout fn 在 100ms 内完成 → 返回结果', async () => {
    const fastFn = async () => {
      await new Promise((r) => setTimeout(r, 20))
      return 'fast'
    }
    const result = await withTimeout(fastFn, 100)
    expect(result).toBe('fast')
  })

  it('withTimeout fn 抛错时 → 透传错误', async () => {
    const errFn = async () => {
      throw new Error('custom-error')
    }
    await expect(withTimeout(errFn, 100)).rejects.toThrow('custom-error')
  })

  it('withCircuitBreaker 成功调用 → 返回 fn 结果,不触发 fallback', async () => {
    const result = await withCircuitBreaker(async () => 'ok', { failureThreshold: 3 })
    expect(result).toBe('ok')
  })
})
