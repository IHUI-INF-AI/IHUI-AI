// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { buildPayrollTodoDrafts } from '../hr-payroll-workflow.js'
import type { PayrollRunSummary } from '../hr-payroll-workflow.js'

/**
 * 薪资流程 → 待办 的生成规则单测(HR-6 第 4 期)。
 *
 * 只测纯函数(草稿生成),落库幂等在真库端到端里验证。
 */

function makeSummary(over: Partial<PayrollRunSummary> = {}): PayrollRunSummary {
  return {
    ok: true,
    monthlyEmployees: 2,
    payrollInserted: 2,
    skippedNoConfig: 0,
    totalGross: '4650.00',
    totalNet: '843.75',
    payslipCount: 2,
    itemsNeedingHuman: [],
    failedStepIndex: null,
    errorMessage: null,
    selfCheck: { passed: true, passedCount: 4, failedCount: 0, results: [], problems: [] },
    ...over,
  }
}

describe('buildPayrollTodoDrafts 正常情况', () => {
  it('一切正常 ⇒ 不生成任何待办', () => {
    const drafts = buildPayrollTodoDrafts(makeSummary(), '2026-11')
    expect(drafts).toEqual([])
  })
})

describe('buildPayrollTodoDrafts 各类问题的待办映射', () => {
  it('流程失败 ⇒ blocker,且不再生成后续业务待办', () => {
    const drafts = buildPayrollTodoDrafts(
      makeSummary({ ok: false, failedStepIndex: 1, errorMessage: 'endpoint failed: 500' }),
      '2026-11',
    )
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.severity).toBe('blocker')
    expect(drafts[0]?.title).toContain('第 2 步失败')
    expect(drafts[0]?.dedupeKey).toBe('hr.monthly-payroll:2026-11:step_failed:1')
  })

  it('缺薪资配置 ⇒ warn,带人数与处理入口', () => {
    const drafts = buildPayrollTodoDrafts(makeSummary({ skippedNoConfig: 3 }), '2026-11')
    const t = drafts.find((d) => d.dedupeKey.endsWith('missing_salary_config'))
    expect(t).toBeTruthy()
    expect(t?.severity).toBe('warn')
    expect(t?.affectedCount).toBe(3)
    expect(t?.title).toContain('3 人')
    expect(t?.actionPath).toContain('tab=payroll')
  })

  it('月结为空 ⇒ blocker,指向导入页', () => {
    const drafts = buildPayrollTodoDrafts(
      makeSummary({ monthlyEmployees: 0, payslipCount: 0, totalGross: '0', totalNet: '0' }),
      '2026-11',
    )
    const t = drafts.find((d) => d.dedupeKey.endsWith('empty_monthly'))
    expect(t).toBeTruthy()
    expect(t?.severity).toBe('blocker')
    expect(t?.actionPath).toContain('tab=import')
  })

  it('自检失败 ⇒ 按断言 id 逐条生成 blocker', () => {
    const drafts = buildPayrollTodoDrafts(
      makeSummary({
        ok: false,
        selfCheck: {
          passed: false,
          passedCount: 2,
          failedCount: 2,
          problems: ['实发合计不为负:...', '实发不超过应发:...'],
          results: [
            {
              id: 'net_non_negative',
              label: '实发合计不为负',
              passed: false,
              actual: '-100',
              expected: '>= 0',
            },
            {
              id: 'net_not_exceed_gross',
              label: '实发不超过应发',
              passed: false,
              actual: '1200/1000',
              expected: '<= 应发',
            },
            {
              id: 'gross_positive',
              label: '应发合计为正',
              passed: true,
              actual: '1000',
              expected: '> 0',
            },
          ],
        },
      }),
      '2026-11',
    )
    const sc = drafts.filter((d) => d.dedupeKey.includes(':selfcheck:'))
    expect(sc).toHaveLength(2) // 只给失败的两条
    expect(sc.every((d) => d.severity === 'blocker')).toBe(true)
    expect(sc.map((d) => d.dedupeKey).some((k) => k.endsWith('net_non_negative'))).toBe(true)
  })

  it('多条问题并存 ⇒ 各自独立生成,dedupeKey 不冲突', () => {
    const drafts = buildPayrollTodoDrafts(
      makeSummary({
        skippedNoConfig: 2,
        selfCheck: {
          passed: false,
          passedCount: 3,
          failedCount: 1,
          problems: ['实发不超过应发:...'],
          results: [
            {
              id: 'net_not_exceed_gross',
              label: '实发不超过应发',
              passed: false,
              actual: 'x',
              expected: 'y',
            },
          ],
        },
      }),
      '2026-11',
    )
    const keys = drafts.map((d) => d.dedupeKey)
    expect(new Set(keys).size).toBe(keys.length) // 无重复
    expect(drafts.length).toBeGreaterThanOrEqual(2)
  })

  it('不同月份的同名问题 dedupeKey 不同(不会串月)', () => {
    const a = buildPayrollTodoDrafts(makeSummary({ skippedNoConfig: 1 }), '2026-11')
    const b = buildPayrollTodoDrafts(makeSummary({ skippedNoConfig: 1 }), '2026-12')
    expect(a[0]?.dedupeKey).not.toBe(b[0]?.dedupeKey)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
