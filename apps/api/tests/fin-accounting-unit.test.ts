// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { MoneyError, fromCents, sumCents, toCents } from '../src/services/fin-accounting/money.js'
import { DEFAULT_CHART, resolveChart } from '../src/services/fin-accounting/chart-of-accounts.js'
import {
  assertPeriod,
  lastDayOf,
  nextPeriod,
  prevPeriod,
} from '../src/services/fin-accounting/period.js'

describe('money:整数分运算', () => {
  it('0.1 + 0.2 在分口径下严格等于 0.3', () => {
    expect(fromCents(toCents('0.1') + toCents('0.2'))).toBe('0.30')
  })

  it('accepts 两位以内小数与整数,统一补两位', () => {
    expect(fromCents(toCents('12'))).toBe('12.00')
    expect(fromCents(toCents('12.3'))).toBe('12.30')
    expect(fromCents(toCents('12.34'))).toBe('12.34')
    expect(fromCents(toCents('-1.5'))).toBe('-1.50')
  })

  it('rejects 三位小数与科学计数法', () => {
    expect(() => toCents('1.234')).toThrow(MoneyError)
    expect(() => toCents('1e3')).toThrow(MoneyError)
  })

  it('rejects 超出 numeric(16,2) 的金额', () => {
    expect(() => toCents('10000000000000000')).toThrow(MoneyError)
  })

  it('sumCents 按分累加,不受浮点误差影响', () => {
    expect(fromCents(sumCents(['0.1', '0.2', '0.3']))).toBe('0.60')
    expect(fromCents(sumCents([null, undefined, '1.05']))).toBe('1.05')
  })

  it('null/undefined 视为 0(期初未填列)', () => {
    expect(toCents(null)).toBe(0)
    expect(toCents(undefined)).toBe(0)
  })
})

describe('chart-of-accounts:科目模板完整性', () => {
  const resolved = resolveChart(DEFAULT_CHART)

  it('科目编码唯一', () => {
    const codes = DEFAULT_CHART.map((a) => a.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('编码长度只允许 4/6/8 位', () => {
    for (const a of DEFAULT_CHART) {
      expect(a.code).toMatch(/^\d{4}(\d{2})?(\d{2})?$/)
    }
  })

  it('每个 parentCode 都在模板内(无悬空父级)', () => {
    const codes = new Set(DEFAULT_CHART.map((a) => a.code))
    for (const a of DEFAULT_CHART) {
      if (a.parentCode) expect(codes.has(a.parentCode)).toBe(true)
    }
  })

  it('有子科目的父级不再是末级,能够穿透汇总', () => {
    const self = resolved.find((a) => a.code === '2221')
    expect(self?.isLeaf).toBe(false)
    expect(self?.level).toBe(1)
    const child = resolved.find((a) => a.code === '222101')
    expect(child?.level).toBe(2)
    expect(child?.isLeaf).toBe(true)
  })

  it('余额方向与科目性质匹配(资产/费用为借,负债/权益/收入为贷)', () => {
    const bad = resolved.filter((a) => {
      if (a.code.startsWith('1602') || a.code.startsWith('1702')) return false // 备抵科目贷方
      if (a.code.startsWith('2221')) return false // 税费明细方向各自不同
      if (['asset', 'expense', 'cost'].includes(a.category)) return a.direction !== 'debit'
      if (['liability', 'equity', 'revenue'].includes(a.category)) return a.direction !== 'credit'
      return false
    })
    expect(bad.map((a) => a.code)).toEqual([])
  })

  it('模板覆盖成本类与税费明细(代账的两个高频盲区)', () => {
    const codes = new Set(DEFAULT_CHART.map((a) => a.code))
    for (const c of ['4001', '4002', '4301', '222101', '222102', '222106', '222111', '222112']) {
      expect(codes.has(c)).toBe(true)
    }
  })
})

describe('period:会计期间', () => {
  it('跨年推进/回退', () => {
    expect(nextPeriod('2026-12')).toBe('2027-01')
    expect(prevPeriod('2027-01')).toBe('2026-12')
    expect(nextPeriod('2026-11')).toBe('2026-12')
    expect(prevPeriod('2026-03')).toBe('2026-02')
  })

  it('月末最后一天含闰年 2 月', () => {
    expect(lastDayOf('2026-02')).toBe('28')
    expect(lastDayOf('2028-02')).toBe('29')
    expect(lastDayOf('2026-12')).toBe('31')
    expect(lastDayOf('2026-04')).toBe('30')
  })

  it('非法期间显式拒绝(不做静默回退)', () => {
    expect(() => assertPeriod('2026-13')).toThrow()
    expect(() => assertPeriod('2026-1')).toThrow()
    expect(() => assertPeriod('202611')).toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
