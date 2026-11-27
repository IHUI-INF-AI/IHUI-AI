// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  alignWindowStart,
  fillMinuteSeries,
  gradeRuntime,
  perSecond,
  ratio,
} from '../ai-model-telemetry'

describe('alignWindowStart', () => {
  it('对齐到分钟并恰好覆盖 minutes 个桶', () => {
    const now = new Date('2026-11-26T06:32:45.678Z').getTime()
    const start = alignWindowStart(now, 60)
    expect(new Date(start).getSeconds()).toBe(0)
    expect(new Date(start).getMilliseconds()).toBe(0)
    expect(now - start).toBeGreaterThanOrEqual(59 * 60_000)
    expect(now - start).toBeLessThanOrEqual(60 * 60_000)
  })
})

describe('fillMinuteSeries', () => {
  const now = new Date('2026-11-26T06:32:45.000Z').getTime()

  it('固定 60 个点,缺桶补 0,窗口内桶保持原值', () => {
    const start = alignWindowStart(now, 60)
    const series = fillMinuteSeries(
      [
        { bucket: start / 1000, calls: 2, tokens: 10 },
        { bucket: (start + 60_000) / 1000, calls: 1, tokens: 5 },
      ],
      now,
      60,
    )
    expect(series).toHaveLength(60)
    expect(series[0]).toMatchObject({ t: start, calls: 2, tokens: 10 })
    expect(series[1]).toMatchObject({ t: start + 60_000, calls: 1, tokens: 5 })
    expect(series.slice(2).every((p) => p.calls === 0 && p.tokens === 0)).toBe(true)
  })

  it('同一桶的多行累加,窗口外的桶丢弃', () => {
    const start = alignWindowStart(now, 60)
    const series = fillMinuteSeries(
      [
        { bucket: start / 1000, calls: 1, tokens: 3 },
        { bucket: start / 1000, calls: 2, tokens: 4 },
        { bucket: start / 1000 - 60, calls: 9, tokens: 99 },
        { bucket: start / 1000 + 60 * 60, calls: 7, tokens: 77 },
      ],
      now,
      60,
    )
    expect(series[0]).toMatchObject({ calls: 3, tokens: 7 })
    expect(series.reduce((sum, p) => sum + p.calls, 0)).toBe(3)
  })
})

describe('perSecond', () => {
  it('按窗口秒数折算并保留两位小数', () => {
    expect(perSecond(300, 5)).toBe(1)
    expect(perSecond(17, 5)).toBe(0.06)
    expect(perSecond(0, 5)).toBe(0)
    expect(perSecond(100, 0)).toBe(0)
  })
})

describe('ratio', () => {
  it('分母为 0 回 null(未判定),否则按四位小数', () => {
    expect(ratio(0, 0)).toBeNull()
    expect(ratio(2, 8)).toBe(0.25)
    expect(ratio(1, 3)).toBe(0.3333)
    expect(ratio(0, 5)).toBe(0)
  })
})

describe('gradeRuntime', () => {
  it('样本不足或没有延迟样本时不评级,不伪造分数', () => {
    expect(gradeRuntime({ calls: 19, errors: 0, p95LatencyMs: 1_000 })).toMatchObject({
      tier: 'insufficient',
      score: null,
      sample: 19,
    })
    expect(gradeRuntime({ calls: 100, errors: 0, p95LatencyMs: null })).toMatchObject({
      tier: 'insufficient',
      score: null,
      sample: 100,
    })
  })

  it('错误率 ≤0.5% 且 P95 ≤3s 为优秀', () => {
    expect(gradeRuntime({ calls: 1_000, errors: 5, p95LatencyMs: 3_000 })).toMatchObject({
      tier: 'excellent',
      score: 100,
    })
  })

  it('1% 错误率配 5s P95 为良好(较低分 88)', () => {
    expect(gradeRuntime({ calls: 100, errors: 1, p95LatencyMs: 5_000 })).toMatchObject({
      tier: 'good',
      score: 88,
    })
  })

  it('短板决定等级:错误率 0.5% 但 P95 15s 只能到一般', () => {
    expect(gradeRuntime({ calls: 200, errors: 1, p95LatencyMs: 15_000 })).toMatchObject({
      tier: 'fair',
      score: 70,
    })
  })

  it('3% 错误率为一般,10% 错误率为较差', () => {
    expect(gradeRuntime({ calls: 100, errors: 3, p95LatencyMs: 2_000 })).toMatchObject({
      tier: 'fair',
      score: 60,
    })
    expect(gradeRuntime({ calls: 100, errors: 10, p95LatencyMs: 2_000 })).toMatchObject({
      tier: 'poor',
      score: 30,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
