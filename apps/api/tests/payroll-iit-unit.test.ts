// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  IIT_MONTHLY_DEDUCTION_CENTS,
  computeWithholding,
  cumulativeIncomeTax,
} from '../src/services/payroll-iit.js'

/** 元 → 分 */
const y = (yuan: number) => Math.round(yuan * 100)

describe('cumulativeIncomeTax:年度税率表', () => {
  it('应纳税所得额为 0 或负 ⇒ 0', () => {
    expect(cumulativeIncomeTax(0)).toBe(0)
    expect(cumulativeIncomeTax(-100)).toBe(0)
  })

  it('3% 档上限 36000 元 ⇒ 1080 元', () => {
    expect(cumulativeIncomeTax(y(36000))).toBe(y(1080))
  })

  it('10% 档 40000 元 ⇒ 1480 元(1480 = 4000 − 2520)', () => {
    expect(cumulativeIncomeTax(y(40000))).toBe(y(1480))
  })

  it('20% 档 150000 元 ⇒ 13080 元', () => {
    expect(cumulativeIncomeTax(y(150000))).toBe(y(13080))
  })

  it('25% 档 350000 元 ⇒ 55580 元', () => {
    expect(cumulativeIncomeTax(y(350000))).toBe(y(55580))
  })

  it('30% 档 500000 元 ⇒ 97080 元', () => {
    expect(cumulativeIncomeTax(y(500000))).toBe(y(97080))
  })

  it('35% 档 700000 元 ⇒ 159080 元', () => {
    expect(cumulativeIncomeTax(y(700000))).toBe(y(159080))
  })

  it('45% 档 1000000 元 ⇒ 268080 元', () => {
    expect(cumulativeIncomeTax(y(1000000))).toBe(y(268080))
  })

  it('档位边界上浮 0.01 元不跨档跳变', () => {
    expect(cumulativeIncomeTax(y(36000.01))).toBe(y(1080))
  })

  it('超出上限返回 0(理论上不可达,防御)', () => {
    expect(cumulativeIncomeTax(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('computeWithholding:累计预扣法逐月', () => {
  const monthly = (month: number, grossYuan: number, prior = { income: 0, tax: 0 }) =>
    computeWithholding({
      cumulativeIncomeCents: y(prior.income + grossYuan),
      cumulativeSocialCents: 0,
      cumulativeSpecialCents: 0,
      months: month,
      priorWithheldCents: y(prior.tax),
    })

  it('月薪 10000 无扣除:1~7 月每月 150,8 月跳到 430', () => {
    const jan = monthly(1, 10000)
    expect(jan.withholdingCents).toBe(y(150))

    const feb = monthly(2, 10000, { income: 10000, tax: 150 })
    expect(feb.withholdingCents).toBe(y(150))

    const jul = monthly(7, 10000, { income: 60000, tax: 900 })
    expect(jul.cumulativeTaxableCents).toBe(y(35000))
    expect(jul.withholdingCents).toBe(y(150))

    const aug = monthly(8, 10000, { income: 70000, tax: 1050 })
    expect(aug.cumulativeTaxableCents).toBe(y(40000))
    expect(aug.cumulativeTaxCents).toBe(y(1480))
    expect(aug.withholdingCents).toBe(y(430))
  })

  it('月薪 30000:1 月 750,2 月 1730(累计跨入 10% 档)', () => {
    const jan = monthly(1, 30000)
    expect(jan.cumulativeTaxableCents).toBe(y(25000))
    expect(jan.withholdingCents).toBe(y(750))

    const feb = monthly(2, 30000, { income: 30000, tax: 750 })
    expect(feb.cumulativeTaxableCents).toBe(y(50000))
    expect(feb.cumulativeTaxCents).toBe(y(2480))
    expect(feb.withholdingCents).toBe(y(1730))
  })

  it('已预扣多于累计税额时本期为 0(不产生负数退税)', () => {
    const r = computeWithholding({
      cumulativeIncomeCents: y(10000),
      cumulativeSocialCents: 0,
      cumulativeSpecialCents: 0,
      months: 1,
      priorWithheldCents: y(500),
    })
    expect(r.cumulativeTaxCents).toBe(y(150))
    expect(r.withholdingCents).toBe(0)
  })

  it('专项扣除与专项附加都在累计口径里抵扣', () => {
    const r = computeWithholding({
      cumulativeIncomeCents: y(20000),
      cumulativeSocialCents: y(3000),
      cumulativeSpecialCents: y(2000),
      months: 2,
      priorWithheldCents: 0,
    })
    // 20000 − 10000 − 3000 − 2000 = 5000 ⇒ 150
    expect(r.cumulativeTaxableCents).toBe(y(5000))
    expect(r.cumulativeTaxCents).toBe(y(150))
  })

  it('某月收入为 0 时减除费用仍累计,后续少缴', () => {
    // 1 月 0 收入,2 月 10000:累计收入 10000 − 减除 10000 = 0 ⇒ 不缴
    const feb = computeWithholding({
      cumulativeIncomeCents: y(10000),
      cumulativeSocialCents: 0,
      cumulativeSpecialCents: 0,
      months: 2,
      priorWithheldCents: 0,
    })
    expect(feb.cumulativeTaxableCents).toBe(0)
    expect(feb.withholdingCents).toBe(0)
  })

  it('months 钳制在 1~12(防止传 0 或 13 把减除费用算错)', () => {
    const base = {
      cumulativeIncomeCents: y(60000),
      cumulativeSocialCents: 0,
      cumulativeSpecialCents: 0,
      priorWithheldCents: 0,
    }
    expect(computeWithholding({ ...base, months: 0 }).cumulativeTaxableCents).toBe(y(55000))
    expect(computeWithholding({ ...base, months: 13 }).cumulativeTaxableCents).toBe(0)
  })

  it('基本减除费用常量 = 5000 元', () => {
    expect(IIT_MONTHLY_DEDUCTION_CENTS).toBe(500_000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
