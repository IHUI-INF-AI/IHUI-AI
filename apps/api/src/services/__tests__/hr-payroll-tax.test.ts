// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import { calcIncomeTax } from '../hr-payroll.js'

/**
 * 个税计算单测(HR-5 第 5 期)。
 *
 * 这是薪资里最容易出错、也最需要钉住的一环:
 * 税率表跨档、速算扣除数、负数与零边界。
 * 完整的薪资链路(日薪/加班/缺勤/社保/公积金/实发)在真库端到端里逐项验证过。
 */

describe('calcIncomeTax 个税累计预扣', () => {
  it('应纳税所得 <= 0 时不缴税', () => {
    expect(calcIncomeTax(0)).toBe(0)
    expect(calcIncomeTax(-1000)).toBe(0)
  })

  it('第一档 3%(不超过 36000)', () => {
    expect(calcIncomeTax(36000)).toBe(1080) // 36000 × 3%
    expect(calcIncomeTax(6568.75)).toBe(197.06) // 真库用例:6568.75 × 3%
  })

  it('第二档 10%(36000~144000),含速算扣除 2520', () => {
    // 40000 × 10% - 2520 = 1480
    expect(calcIncomeTax(40000)).toBe(1480)
  })

  it('第三档 20%(144000~300000),含速算扣除 16920', () => {
    // 150000 × 20% - 16920 = 13080
    expect(calcIncomeTax(150000)).toBe(13080)
  })

  it('第四档 25%(300000~420000),含速算扣除 31920', () => {
    // 350000 × 25% - 31920 = 55580
    expect(calcIncomeTax(350000)).toBe(55580)
  })

  it('第五档 30%(420000~660000),含速算扣除 52920', () => {
    // 500000 × 30% - 52920 = 97080
    expect(calcIncomeTax(500000)).toBe(97080)
  })

  it('第六档 35%(660000~960000),含速算扣除 85920', () => {
    // 700000 × 35% - 85920 = 159080
    expect(calcIncomeTax(700000)).toBe(159080)
  })

  it('第七档 45%(超过 960000),含速算扣除 181920', () => {
    // 1000000 × 45% - 181920 = 268080
    expect(calcIncomeTax(1000000)).toBe(268080)
  })

  it('跨档边界精确(36000 与 36000.01)', () => {
    // 36000 在第一档末端:36000 × 3% = 1080
    expect(calcIncomeTax(36000)).toBe(1080)
    // 36000.01 进第二档:36000.01 × 10% - 2520 = 1080.001 → 1080
    expect(calcIncomeTax(36000.01)).toBe(1080)
  })

  it('结果保留两位小数', () => {
    const tax = calcIncomeTax(12345.67)
    expect(Number.isInteger(tax * 100)).toBe(true) // 最多两位小数
    expect(tax).toBe(370.37) // 12345.67 × 3% = 370.3701 → 370.37
  })
})
