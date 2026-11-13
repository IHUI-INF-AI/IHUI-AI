// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { selfCheckPayroll } from '../ai-task-self-check.js'

/**
 * 薪资结果自检单测(HR-6 第 2 期)。
 *
 * 每条断言都对应一种真实发生过的算错方式,单测逐条钉住。
 * 最关键的两条来自本仓实测事故:
 *   · 负数工资 -12350(双重扣款)⇒ net_non_negative
 *   · 全员 0 元(薪资配置全缺)⇒ gross_positive
 */

const base = {
  monthlyEmployees: 2,
  payslipCount: 2,
  totalGross: '4650.00',
  totalNet: '843.75',
  skippedNoConfig: 0,
}

describe('selfCheckPayroll 正常情况', () => {
  it('一切正常 ⇒ passed=true,无 problem', () => {
    const r = selfCheckPayroll(base)
    expect(r.passed).toBe(true)
    expect(r.failedCount).toBe(0)
    expect(r.problems).toEqual([])
    expect(r.results.length).toBe(4) // 无上月基准时 4 条
  })
})

describe('selfCheckPayroll 五条不变量', () => {
  it('① 月结有人但没工资单 ⇒ 失败', () => {
    const r = selfCheckPayroll({ ...base, payslipCount: 0 })
    expect(r.passed).toBe(false)
    expect(r.problems.some((p) => p.includes('就必须产出工资单'))).toBe(true)
  })

  it('② 有人但应发为 0 ⇒ 失败(全员配置缺失的典型结果)', () => {
    const r = selfCheckPayroll({ ...base, totalGross: '0', totalNet: '0' })
    expect(r.passed).toBe(false)
    expect(r.problems.some((p) => p.includes('应发合计为正'))).toBe(true)
  })

  it('③ 实发为负 ⇒ 失败(本仓实测踩过 -16156.25)', () => {
    const r = selfCheckPayroll({ ...base, totalGross: '-12350', totalNet: '-16156.25' })
    expect(r.passed).toBe(false)
    expect(r.problems.some((p) => p.includes('实发合计不为负'))).toBe(true)
    // 应发为负也会同时触发 gross_positive
    expect(r.problems.some((p) => p.includes('应发合计为正'))).toBe(true)
  })

  it('④ 实发大于应发 ⇒ 失败(扣款算成负数)', () => {
    const r = selfCheckPayroll({ ...base, totalGross: '1000', totalNet: '1200' })
    expect(r.passed).toBe(false)
    expect(r.problems.some((p) => p.includes('实发不超过应发'))).toBe(true)
  })

  it('⑤ 环比超过阈值 ⇒ 失败(漏算/多算一大批人)', () => {
    const r = selfCheckPayroll({
      ...base,
      totalGross: '10000',
      previousMonthGross: '4000', // 涨 150%,超 50%
    })
    expect(r.passed).toBe(false)
    expect(r.problems.some((p) => p.includes('环比'))).toBe(true)
  })
})

describe('selfCheckPayroll 边界与容错', () => {
  it('月结为空 ⇒ 不判应发与工资单(空月是合法的)', () => {
    const r = selfCheckPayroll({
      monthlyEmployees: 0,
      payslipCount: 0,
      totalGross: '0',
      totalNet: '0',
      skippedNoConfig: 0,
    })
    expect(r.passed).toBe(true)
  })

  it('无上月基准 ⇒ 不做环比断言(首次运行不该误报)', () => {
    const r = selfCheckPayroll({ ...base, previousMonthGross: null })
    expect(r.results.some((x) => x.id === 'gross_mom_within_tolerance')).toBe(false)
  })

  it('上月为 0 ⇒ 不做环比(除零无意义)', () => {
    const r = selfCheckPayroll({ ...base, previousMonthGross: '0' })
    expect(r.results.some((x) => x.id === 'gross_mom_within_tolerance')).toBe(false)
  })

  it('环比在阈值内 ⇒ 通过', () => {
    const r = selfCheckPayroll({ ...base, totalGross: '5000', previousMonthGross: '4000' })
    const mom = r.results.find((x) => x.id === 'gross_mom_within_tolerance')
    expect(mom?.passed).toBe(true)
  })

  it('自定义阈值生效', () => {
    const r = selfCheckPayroll({
      ...base,
      totalGross: '5000',
      previousMonthGross: '4000', // 波动 25%
      grossToleranceRatio: 0.1, // 收紧到 10%
    })
    expect(r.passed).toBe(false)
  })

  it('缺薪资配置 ⇒ 列入 problems 但不判失败(是"没算全"不是"算错")', () => {
    const r = selfCheckPayroll({ ...base, skippedNoConfig: 3 })
    expect(r.passed).toBe(true) // 断言全过
    expect(r.problems.some((p) => p.includes('缺少薪资配置'))).toBe(true)
  })

  it('非法数值输入不炸(容错为 0)', () => {
    const r = selfCheckPayroll({
      monthlyEmployees: Number.NaN,
      payslipCount: 1,
      totalGross: 'abc',
      totalNet: 'xyz',
      skippedNoConfig: Number.NaN,
    })
    expect(typeof r.passed).toBe('boolean')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
