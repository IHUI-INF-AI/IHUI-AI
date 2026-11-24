// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { calcAnnualBonusTax, calcSeverance, serviceYears } from '../hr-compensation.js'

/**
 * 年终奖 / 经济补偿测算单测(2026-11-24 补口)。
 * 钉三件事:① 奖金÷12 定档、速算扣除数用月度值;② 补偿年限按月进位;③ 3 倍封顶与免税额度。
 */
describe('calcAnnualBonusTax 全年一次性奖金单独计税', () => {
  it('36000 元落在 3% 档,税额 1080', () => {
    const r = calcAnnualBonusTax(36_000)
    expect(r.monthlyEquivalent).toBe(3_000)
    expect(r.rate).toBe(0.03)
    expect(r.taxAmount).toBe(1_080)
    expect(r.netAmount).toBe(34_920)
  })

  it('刚过 3000 档即跳到 10%,速算扣除 210', () => {
    const r = calcAnnualBonusTax(36_001)
    expect(r.rate).toBe(0.1)
    expect(r.taxAmount).toBe(3_390.1)
  })

  it('120000 元(月均 10000)= 120000×10%−210', () => {
    const r = calcAnnualBonusTax(120_000)
    expect(r.taxAmount).toBe(11_790)
    expect(r.netAmount).toBe(108_210)
  })

  it('零或负数直接拒绝,不静默返回 0', () => {
    expect(() => calcAnnualBonusTax(0)).toThrow()
    expect(() => calcAnnualBonusTax(-1)).toThrow()
  })
})

describe('serviceYears 补偿年限', () => {
  it('满 1 年记 1,满 6 个月不满 1 年记 1,不满 6 个月记 0.5', () => {
    expect(serviceYears('2020-01-01', '2024-01-01').rawYears).toBe(4)
    expect(serviceYears('2023-07-01', '2024-05-01').rawYears).toBe(1) // 10 个月
    expect(serviceYears('2023-12-01', '2024-04-01').rawYears).toBe(0.5) // 4 个月
  })

  it('离职早于入职必须抛错', () => {
    expect(() => serviceYears('2024-01-01', '2023-01-01')).toThrow()
  })
})

describe('calcSeverance 经济补偿', () => {
  it('普通离职:3 倍社平以内全免个税', () => {
    const r = calcSeverance({
      hireDate: '2020-01-01',
      lastWorkDate: '2024-07-01',
      monthlyAvgWage: 10_000,
      localAvgMonthlyWage: 8_000,
    })
    expect(r.yearsOfService).toBe(5) // 4 年 6 个月整 → 满 6 个月按 1 年
    expect(r.compensationAmount).toBe(50_000)
    expect(r.exemptAmount).toBe(50_000)
    expect(r.taxableExcess).toBe(0)
    expect(r.taxAmount).toBe(0)
    expect(r.netAmount).toBe(50_000)
  })

  it('月工资高于社平 3 倍:按 3 倍封顶且年限封顶 12', () => {
    const r = calcSeverance({
      hireDate: '2000-01-01',
      lastWorkDate: '2024-01-01',
      monthlyAvgWage: 30_000,
      localAvgMonthlyWage: 8_000,
    })
    expect(r.capped).toBe(true)
    expect(r.effectiveMonthlyWage).toBe(24_000)
    expect(r.yearsOfService).toBe(12)
    expect(r.compensationAmount).toBe(288_000)
    expect(r.taxableExcess).toBe(0) // 恰好等于 8000×36
  })

  it('超长工龄且未触发封顶:超额部分计税', () => {
    const r = calcSeverance({
      hireDate: '1980-01-01',
      lastWorkDate: '2020-01-01',
      monthlyAvgWage: 20_000,
      localAvgMonthlyWage: 10_000,
    })
    expect(r.capped).toBe(false)
    expect(r.yearsOfService).toBe(40)
    expect(r.compensationAmount).toBe(800_000)
    expect(r.exemptAmount).toBe(360_000)
    expect(r.taxableExcess).toBe(440_000)
    expect(r.taxAmount).toBeGreaterThan(0)
    expect(r.netAmount).toBe(800_000 - r.taxAmount)
  })

  it('缺社平工资时必须拒绝,不许按 0 折算', () => {
    expect(() =>
      calcSeverance({
        hireDate: '2020-01-01',
        lastWorkDate: '2024-01-01',
        monthlyAvgWage: 10_000,
        localAvgMonthlyWage: 0,
      }),
    ).toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
