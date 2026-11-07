// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { applyReportPayload, judgeKpi, judgeStage } from './session-report'
import type { SessionReport } from './session-report'

const previous: SessionReport = {
  kpis: [{ name: 'tokens', used: 3, budget: 10 }],
  stages: [{ id: 'plan', hit: true }],
}

describe('judgeKpi', () => {
  it('用量超预算是 over', () => {
    expect(judgeKpi(11, 10)).toEqual({
      disposition: 'over',
      reason: 'over-budget',
      ratio: 11 / 10,
    })
  })

  it('预算 null 是 unjudged，不是 within', () => {
    const judged = judgeKpi(1, null)
    expect(judged).toEqual({ disposition: 'unjudged', reason: 'budget-unmeasured', ratio: null })
    expect(judged.disposition).not.toBe('within')
  })

  it('用量没量到或是布尔时是 unjudged', () => {
    expect(judgeKpi(null, 10)).toEqual({
      disposition: 'unjudged',
      reason: 'used-unmeasured',
      ratio: null,
    })
    const booleanUsed = true as unknown as number
    expect(judgeKpi(booleanUsed, 10)).toEqual({
      disposition: 'unjudged',
      reason: 'used-unmeasured',
      ratio: null,
    })
    expect(judgeKpi(null, null).reason).toBe('budget-unmeasured')
  })

  it('用量不超过预算是 within，比值是 used/budget', () => {
    expect(judgeKpi(0, 4)).toEqual({ disposition: 'within', reason: 'within-budget', ratio: 0 })
    expect(judgeKpi(4, 4)).toEqual({ disposition: 'within', reason: 'within-budget', ratio: 1 })
  })

  it('预算不是有限正数时不给比值', () => {
    for (const budget of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(judgeKpi(1, budget)).toEqual({
        disposition: 'unjudged',
        reason: 'budget-unmeasured',
        ratio: null,
      })
    }
  })
})

describe('judgeStage', () => {
  it('hit null 是 unjudged，不是 miss', () => {
    const judged = judgeStage(null)
    expect(judged).toEqual({ disposition: 'unjudged', reason: 'hit-unmeasured' })
    expect(judged.disposition).not.toBe('miss')
  })

  it('布尔命中才是 hit 或 miss', () => {
    expect(judgeStage(true)).toEqual({ disposition: 'hit', reason: 'hit' })
    expect(judgeStage(false)).toEqual({ disposition: 'miss', reason: 'miss' })
  })

  it('hit 不是布尔时是 unjudged', () => {
    const notBoolean = 1 as unknown as boolean
    expect(judgeStage(notBoolean)).toEqual({ disposition: 'unjudged', reason: 'hit-unmeasured' })
  })
})

describe('applyReportPayload', () => {
  it('没有新载荷时保留当前报告', () => {
    const applied = applyReportPayload(previous, null)
    expect(applied).toEqual({ disposition: 'unjudged', reason: 'payload-absent', report: previous })
    expect(applied.report).toBe(previous)
    expect(applyReportPayload(null, null)).toEqual({
      disposition: 'unjudged',
      reason: 'payload-absent',
      report: null,
    })
  })

  it('新载荷是坏 JSON 时旧报告仍在', () => {
    const applied = applyReportPayload(previous, '{')
    expect(applied.disposition).toBe('unjudged')
    expect(applied.reason).toBe('payload-invalid')
    expect(applied.report).toBe(previous)
    expect(applied.report).toEqual({
      kpis: [{ name: 'tokens', used: 3, budget: 10 }],
      stages: [{ id: 'plan', hit: true }],
    })
    expect(applied.report).not.toEqual({ kpis: [], stages: [] })
  })

  it('缺数组、空名字或条目不合法时不替换当前报告', () => {
    const samples = [
      'null',
      '[]',
      '42',
      '"nope"',
      JSON.stringify({ stages: [] }),
      JSON.stringify({ kpis: [], stages: {} }),
      JSON.stringify({ kpis: [{ name: '', used: 1, budget: 2 }], stages: [] }),
      JSON.stringify({
        kpis: [{ name: 'a', used: 1, budget: 2 }],
        stages: [{ id: '', hit: true }],
      }),
      JSON.stringify({ kpis: [null], stages: [] }),
      JSON.stringify({ kpis: [{ name: 'a', used: true, budget: 2 }], stages: [] }),
      JSON.stringify({ kpis: [{ name: 'a', budget: 2 }], stages: [] }),
      JSON.stringify({ kpis: [], stages: [{ id: 's', hit: 'yes' }] }),
    ]
    for (const text of samples) {
      const applied = applyReportPayload(previous, text)
      expect(applied.disposition).toBe('unjudged')
      expect(applied.reason).toBe('payload-invalid')
      expect(applied.report).toBe(previous)
    }
  })

  it('合法 JSON 替换成新报告，且不改旧对象', () => {
    const next: SessionReport = {
      kpis: [{ name: 'latency', used: null, budget: 20 }],
      stages: [{ id: 'review', hit: null }],
    }
    const applied = applyReportPayload(previous, JSON.stringify(next))
    expect(applied.disposition).toBe('rendered')
    expect(applied.reason).toBe('applied')
    expect(applied.report).toEqual(next)
    expect(applied.report).not.toBe(previous)
    expect(previous.kpis[0]?.name).toBe('tokens')
    expect(previous.stages[0]?.hit).toBe(true)
    expect(applyReportPayload(null, JSON.stringify(next)).report).toEqual(next)
    const stage = applied.report?.stages[0]
    expect(stage ? judgeStage(stage.hit).disposition : 'missing').toBe('unjudged')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
