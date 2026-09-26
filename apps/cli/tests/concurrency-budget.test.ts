// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
  concurrencyBudgetSnapshot,
  cpuParallelism,
  resolveMaxConcurrency,
} from '../src/subagents/concurrency-budget.js'

/**
 * 并发预算单一出口的回归。
 *
 * 三条主判据对应立票时的三个实测缺陷:
 *  1. 模型可填任意大的 maxWorkers(旧代码只有 `?? 4` 兜默认,无上界)
 *  2. 默认档写死 4 且全仓无 CPU 推导
 *  3. requested=0 / 负数 / NaN 会打穿 `activeCount < maxWorkers` 判据(任务全排队饿死)
 *
 * `cpu` 形参是刻意的测试通道:在恰好 4 核的机器上,"默认走 CPU 推导"与"默认写死 4"
 * 结果同值 ⇒ 不注入就测不出这一格(注错方向还会得到一台恒真的尺子)。
 */
describe('resolveMaxConcurrency — 并发预算单一出口', () => {
  it('模型填 999 ⇒ 钳到硬上限,不是 999', () => {
    expect(resolveMaxConcurrency(999)).toBe(MAX_CONCURRENCY)
    expect(resolveMaxConcurrency(999)).toBeLessThanOrEqual(MAX_CONCURRENCY)
  })

  it('未填 ⇒ 走 CPU 推导而非固定 4(cpu=12 注入)', () => {
    expect(resolveMaxConcurrency(undefined, 12)).toBe(12)
    // 机器并行度超过硬上限时同样被钳(推导不等于放行)
    expect(resolveMaxConcurrency(undefined, 64)).toBe(MAX_CONCURRENCY)
    // cpu=1 的机器上默认档必须是 1,不得被抬回旧的 4
    expect(resolveMaxConcurrency(undefined, 1)).toBe(1)
  })

  it('requested=0 / 负数 / NaN ⇒ 落 1 且不抛', () => {
    expect(() => resolveMaxConcurrency(0)).not.toThrow()
    expect(resolveMaxConcurrency(0)).toBe(MIN_CONCURRENCY)
    expect(resolveMaxConcurrency(-5)).toBe(MIN_CONCURRENCY)
    expect(() => resolveMaxConcurrency(Number.NaN)).not.toThrow()
    expect(resolveMaxConcurrency(Number.NaN)).toBeGreaterThanOrEqual(MIN_CONCURRENCY)
    expect(resolveMaxConcurrency(Number.NaN)).toBeLessThanOrEqual(MAX_CONCURRENCY)
  })

  it('真实机器读数与档位常量自身在带内(cpuParallelism 不返回 0/负)', () => {
    const cpu = cpuParallelism()
    expect(cpu).toBeGreaterThanOrEqual(MIN_CONCURRENCY)
    expect(concurrencyBudgetSnapshot().ceiling).toBe(MAX_CONCURRENCY)
    expect(concurrencyBudgetSnapshot().cpuDerivedDefault).toBe(resolveMaxConcurrency())
  })

  it('池计数单调:activePools 不得为负(重复 shutdown 不重复记账)', () => {
    const before = concurrencyBudgetSnapshot()
    expect(before.activePools).toBeGreaterThanOrEqual(0)
    expect(before.poolsClosed).toBeLessThanOrEqual(before.poolsCreated)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
