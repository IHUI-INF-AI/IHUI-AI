import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CircuitBreaker,
  CircuitOpenError,
  serverPreset,
  clientPreset,
} from '../src/circuit-breaker.js'
import type { CircuitBreakerOptions } from '../src/circuit-breaker.js'

async function settle(breaker: CircuitBreaker, success: boolean): Promise<void> {
  try {
    await breaker.execute(async () => {
      if (!success) throw new Error('boom')
      return 'ok'
    })
  } catch {
    // expected for failure path
  }
}

describe('CircuitBreaker — Sliding-window-with-min-samples', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('closed 状态执行成功并返回结果', async () => {
    const cb = new CircuitBreaker('test')
    const result = await cb.execute(async () => 42)
    expect(result).toBe(42)
    expect(cb.getState()).toBe('closed')
    const stats = cb.getStats()
    expect(stats.successes).toBe(1)
    expect(stats.failures).toBe(0)
    expect(stats.total).toBe(1)
    expect(stats.failureRate).toBe(0)
  })

  it('失败次数未达阈值时保持 closed', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 5, minSamples: 10 })
    for (let i = 0; i < 4; i++) await settle(cb, false)
    for (let i = 0; i < 6; i++) await settle(cb, true)
    expect(cb.getState()).toBe('closed')
    const stats = cb.getStats()
    expect(stats.failures).toBe(4)
    expect(stats.total).toBe(10)
    expect(stats.failureRate).toBeCloseTo(0.4, 5)
  })

  it('失败次数达阈值且样本足够时 trip 到 open', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 5, minSamples: 10 })
    for (let i = 0; i < 5; i++) await settle(cb, false)
    for (let i = 0; i < 5; i++) await settle(cb, true)
    expect(cb.getState()).toBe('open')
    const stats = cb.getStats()
    expect(stats.failures).toBe(5)
    expect(stats.total).toBe(10)
    expect(stats.failureRate).toBeCloseTo(0.5, 5)
  })

  it('minSamples 不足时不 trip(冷启动保护)', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 5, minSamples: 10 })
    for (let i = 0; i < 5; i++) await settle(cb, false)
    for (let i = 0; i < 2; i++) await settle(cb, true)
    expect(cb.getState()).toBe('closed')
    const stats = cb.getStats()
    expect(stats.total).toBe(7)
    expect(stats.failures).toBe(5)
    expect(stats.failureRate).toBeCloseTo(5 / 7, 5)
  })

  it('open 状态 execute 直接抛 CircuitOpenError', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 2, minSamples: 2 })
    await settle(cb, false)
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
    await expect(cb.execute(async () => 'nope')).rejects.toBeInstanceOf(CircuitOpenError)
    const err = await cb.execute(async () => 'nope').catch((e) => e as CircuitOpenError)
    expect(err.breakerName).toBe('test')
    expect(err.state).toBe('open')
  })

  it('open 经 halfOpenTimeoutMs 后转为 half-open', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
      halfOpenTimeoutMs: 30_000,
    })
    await settle(cb, false)
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
    vi.advanceTimersByTime(29_999)
    expect(cb.getState()).toBe('open')
    vi.advanceTimersByTime(1)
    expect(cb.getState()).toBe('half-open')
  })

  it('half-open 连续 successThreshold 次成功后回到 closed', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
      successThreshold: 3,
      halfOpenTimeoutMs: 30_000,
    })
    await settle(cb, false)
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
    vi.advanceTimersByTime(30_000)
    expect(cb.getState()).toBe('half-open')
    await settle(cb, true)
    expect(cb.getState()).toBe('half-open')
    await settle(cb, true)
    expect(cb.getState()).toBe('half-open')
    await settle(cb, true)
    expect(cb.getState()).toBe('closed')
    const stats = cb.getStats()
    expect(stats.total).toBe(0)
    expect(stats.failures).toBe(0)
  })

  it('half-open 任一失败立即回到 open 并重置 openedAt', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
      successThreshold: 3,
      halfOpenTimeoutMs: 30_000,
    })
    await settle(cb, false)
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
    vi.advanceTimersByTime(30_000)
    expect(cb.getState()).toBe('half-open')
    await settle(cb, true)
    expect(cb.getState()).toBe('half-open')
    vi.advanceTimersByTime(5_000)
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
    vi.advanceTimersByTime(29_999)
    expect(cb.getState()).toBe('open')
    vi.advanceTimersByTime(1)
    expect(cb.getState()).toBe('half-open')
  })

  it('half-open 只允许 1 个并发试探', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
      halfOpenTimeoutMs: 30_000,
    })
    await settle(cb, false)
    await settle(cb, false)
    vi.advanceTimersByTime(30_000)
    expect(cb.getState()).toBe('half-open')
    let resolveFirst!: (v: string) => void
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })
    const p1 = cb.execute(() => first)
    await Promise.resolve()
    await Promise.resolve()
    await expect(cb.execute(async () => 'second')).rejects.toBeInstanceOf(CircuitOpenError)
    resolveFirst('done')
    await expect(p1).resolves.toBe('done')
    expect(cb.getState()).toBe('half-open')
  })

  it('滑动窗口过期清除旧样本(失败计数随之下降)', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      minSamples: 10,
      windowSizeMs: 60_000,
    })
    for (let i = 0; i < 5; i++) await settle(cb, false)
    for (let i = 0; i < 5; i++) await settle(cb, true)
    expect(cb.getState()).toBe('open')
    cb.reset()
    expect(cb.getStats().total).toBe(0)
    for (let i = 0; i < 5; i++) await settle(cb, false)
    expect(cb.getStats().failures).toBe(5)
    expect(cb.getStats().total).toBe(5)
    vi.advanceTimersByTime(60_001)
    expect(cb.getStats().total).toBe(0)
    expect(cb.getStats().failures).toBe(0)
    expect(cb.getStats().failureRate).toBe(0)
  })

  it('滑动窗口过期后旧失败不再触发 trip', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      minSamples: 10,
      windowSizeMs: 60_000,
    })
    for (let i = 0; i < 4; i++) await settle(cb, false)
    vi.advanceTimersByTime(60_001)
    for (let i = 0; i < 10; i++) await settle(cb, true)
    expect(cb.getState()).toBe('closed')
    const stats = cb.getStats()
    expect(stats.failures).toBe(0)
    expect(stats.total).toBe(10)
  })

  it('reset 清空所有状态', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 2, minSamples: 2 })
    await settle(cb, false)
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
    cb.reset()
    expect(cb.getState()).toBe('closed')
    expect(cb.getStats().total).toBe(0)
    expect(cb.getStats().failures).toBe(0)
    const result = await cb.execute(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('执行中 fn 抛错时错误透传且计数为失败', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 5, minSamples: 10 })
    const marker = new Error('custom-failure')
    await expect(cb.execute(async () => { throw marker })).rejects.toBe(marker)
    const stats = cb.getStats()
    expect(stats.failures).toBe(1)
    expect(stats.successes).toBe(0)
    expect(stats.total).toBe(1)
  })

  it('serverPreset 与 clientPreset 满足默认值约定', () => {
    expect(serverPreset.failureThreshold).toBe(5)
    expect(serverPreset.minSamples).toBe(10)
    expect(serverPreset.windowSizeMs).toBe(60_000)
    expect(clientPreset.failureThreshold).toBe(3)
    expect(clientPreset.minSamples).toBe(5)
    expect(clientPreset.windowSizeMs).toBe(30_000)
    const serverCb = new CircuitBreaker('s', serverPreset)
    const clientCb = new CircuitBreaker('c', clientPreset)
    expect(serverCb.getState()).toBe('closed')
    expect(clientCb.getState()).toBe('closed')
  })

  it('使用 serverPreset 时需 5 失败 + 10 样本才 trip', async () => {
    const opts: CircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 3,
      minSamples: 10,
      windowSizeMs: 60_000,
      halfOpenTimeoutMs: 30_000,
      ...serverPreset,
    } as CircuitBreakerOptions
    const cb = new CircuitBreaker('s', opts)
    for (let i = 0; i < 4; i++) await settle(cb, false)
    for (let i = 0; i < 6; i++) await settle(cb, true)
    expect(cb.getState()).toBe('closed')
    await settle(cb, false)
    expect(cb.getState()).toBe('open')
  })
})
