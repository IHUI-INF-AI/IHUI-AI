// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import {
  HR_MONTHLY_PAYROLL_TEMPLATE_NAME,
  buildHrMonthlyPayrollTemplate,
  summarizePayrollRun,
} from '../hr-payroll-workflow.js'

/**
 * HR 月度薪资编排模板单测(HR-6 第 1 期)。
 *
 * 只测纯函数:模板结构与摘要翻译。真实执行(跑通 5 步)在真库端到端里验证。
 */

describe('buildHrMonthlyPayrollTemplate 模板结构', () => {
  it('五步顺序与路径正确', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    expect(tpl.name).toBe(HR_MONTHLY_PAYROLL_TEMPLATE_NAME)
    expect(tpl.steps.map((s) => `${s.method} ${s.path}`)).toEqual([
      'POST /hr-settle/daily',
      'POST /hr-settle/monthly',
      'GET /hr-settle/monthly',
      'POST /hr-payroll/calculate',
      'GET /hr-payroll/items',
    ])
  })

  it('periodMonth 透传到每一步', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    for (const step of tpl.steps) {
      expect(step.params?.['periodMonth']).toBe('2026-11')
    }
  })

  it('regionName 只传给算薪步,不污染其它步骤', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11', regionName: '北京市' })
    expect(tpl.steps[3]?.params?.['regionName']).toBe('北京市')
    expect(tpl.steps[0]?.params?.['regionName']).toBeUndefined()
    expect(tpl.steps[4]?.params?.['regionName']).toBeUndefined()
  })

  it('不设 cron:自动发工资必须由人触发', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    expect(tpl.cron).toBeNull()
    expect(tpl.triggerType).toBe('manual')
  })
})

describe('summarizePayrollRun 执行结果翻译', () => {
  const okResults = [
    { stepIndex: 0, ok: true, output: { data: { employeeDays: 60 } } },
    { stepIndex: 1, ok: true, output: { data: { employees: 2 } } },
    { stepIndex: 2, ok: true, output: { data: { rows: [{ id: 'a' }, { id: 'b' }] } } },
    {
      stepIndex: 3,
      ok: true,
      output: { data: { inserted: 1, skippedNoConfig: 1, totalGross: 4650, totalNet: 843.75 } },
    },
    { stepIndex: 4, ok: true, output: { data: { rows: [{ netPay: '843.75' }] } } },
  ]

  it('全成功:人数/金额/工资单条数正确', () => {
    const s = summarizePayrollRun(okResults)
    expect(s.ok).toBe(true)
    expect(s.monthlyEmployees).toBe(2)
    expect(s.payrollInserted).toBe(1)
    expect(s.skippedNoConfig).toBe(1)
    expect(s.totalGross).toBe('4650.00')
    expect(s.totalNet).toBe('843.75')
    expect(s.payslipCount).toBe(1)
    expect(s.failedStepIndex).toBeNull()
  })

  it('缺薪资配置 → 列入待人工处理', () => {
    const s = summarizePayrollRun(okResults)
    expect(s.itemsNeedingHuman.some((m) => m.includes('缺少薪资配置'))).toBe(true)
  })

  it('月结为空 → 提示先核对数据源', () => {
    const results = [
      okResults[0]!,
      okResults[1]!,
      { stepIndex: 2, ok: true, output: { data: { rows: [] } } },
      { stepIndex: 3, ok: true, output: { data: { inserted: 0, skippedNoConfig: 0, totalGross: 0 } } },
      { stepIndex: 4, ok: true, output: { data: { rows: [] } } },
    ]
    const s = summarizePayrollRun(results)
    expect(s.monthlyEmployees).toBe(0)
    expect(s.itemsNeedingHuman.some((m) => m.includes('没有月结数据'))).toBe(true)
  })

  it('中途失败 → ok=false 并指出失败步与原因', () => {
    const results = [
      okResults[0]!,
      { stepIndex: 1, ok: false, error: 'endpoint POST /hr-settle/monthly failed: 400' },
    ]
    const s = summarizePayrollRun(results)
    expect(s.ok).toBe(false)
    expect(s.failedStepIndex).toBe(1)
    expect(s.errorMessage).toContain('400')
  })

  it('无 data 包装时也能解析(端点直接返回对象)', () => {
    const results = [
      { stepIndex: 0, ok: true, output: {} },
      { stepIndex: 1, ok: true, output: {} },
      { stepIndex: 2, ok: true, output: { rows: [{ id: 'x' }] } },
      { stepIndex: 3, ok: true, output: { inserted: 2, totalGross: 1000, totalNet: 900 } },
      { stepIndex: 4, ok: true, output: { rows: [] } },
    ]
    const s = summarizePayrollRun(results)
    expect(s.monthlyEmployees).toBe(1)
    expect(s.payrollInserted).toBe(2)
    expect(s.totalGross).toBe('1000.00')
  })

  it('应发为 0 但月结有人 → 提示数据异常', () => {
    const results = [
      okResults[0]!,
      okResults[1]!,
      okResults[2]!,
      { stepIndex: 3, ok: true, output: { data: { inserted: 0, skippedNoConfig: 0, totalGross: 0 } } },
      { stepIndex: 4, ok: true, output: { data: { rows: [] } } },
    ]
    const s = summarizePayrollRun(results)
    expect(s.itemsNeedingHuman.some((m) => m.includes('应发合计为 0'))).toBe(true)
  })
})

describe('summarizePayrollRun × 结果自检联动', () => {
  const okSteps = [
    { stepIndex: 0, ok: true, output: { data: { employeeDays: 60 } } },
    { stepIndex: 1, ok: true, output: { data: { employees: 2 } } },
    { stepIndex: 2, ok: true, output: { data: { rows: [{ id: 'a' }, { id: 'b' }] } } },
    {
      stepIndex: 3,
      ok: true,
      output: { data: { inserted: 2, skippedNoConfig: 0, totalGross: 4650, totalNet: 843.75 } },
    },
    { stepIndex: 4, ok: true, output: { data: { rows: [{ netPay: '843.75' }] } } },
  ]

  it('流程跑通且自检通过 ⇒ ok=true,selfCheck 有报告', () => {
    const s = summarizePayrollRun(okSteps)
    expect(s.ok).toBe(true)
    expect(s.selfCheck?.passed).toBe(true)
    expect(s.selfCheck?.failedCount).toBe(0)
  })

  it('流程跑通但自检失败(负数工资)⇒ ok 变 false 且列入待人工', () => {
    const bad = [
      okSteps[0]!,
      okSteps[1]!,
      okSteps[2]!,
      {
        stepIndex: 3,
        ok: true,
        output: { data: { inserted: 2, skippedNoConfig: 0, totalGross: -12350, totalNet: -16156.25 } },
      },
      okSteps[4]!,
    ]
    const s = summarizePayrollRun(bad)
    expect(s.ok).toBe(false)
    expect(s.selfCheck?.passed).toBe(false)
    expect(s.itemsNeedingHuman.some((m) => m.includes('实发合计不为负'))).toBe(true)
  })

  it('流程本身失败 ⇒ 不做自检(避免把"没跑完"误报成"算错了")', () => {
    const failed = [
      okSteps[0]!,
      { stepIndex: 1, ok: false, error: 'endpoint failed: 500' },
    ]
    const s = summarizePayrollRun(failed)
    expect(s.ok).toBe(false)
    expect(s.selfCheck).toBeNull()
  })

  it('提供上月基准时环比断言生效', () => {
    const s = summarizePayrollRun(okSteps, { previousMonthGross: '1000' })
    // 4650 vs 1000 = 涨 365%,超默认 50%
    expect(s.ok).toBe(false)
    expect(s.selfCheck?.results.some((r) => r.id === 'gross_mom_within_tolerance')).toBe(true)
  })
})
