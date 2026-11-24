// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  accumulatedCentsAt,
  depreciationSequence,
  monthsBetween,
  straightLinePeriodCents,
} from '../src/services/fin-accounting/fixed-asset-service.js'
import { sumPayrollTaxRows } from '../src/services/fin-accounting/filing-derive-service.js'
import { selectFilingDueTasks } from '../src/services/fin-filing-watch.js'
import { aggregateAuxRows } from '../src/services/fin-accounting/ledger-report-service.js'

/**
 * 2026-11-24 二波补口的纯核单测:
 * ① 直线法折旧的尾差归属与越界;② IIT 工资汇总口径;③ 到期提醒窗选取;
 * ④ 辅助核算按值聚合。全部走分口径,不碰 db。
 */

describe('straightLinePeriodCents 直线法', () => {
  it('12000 元原值、5% 残值、12 个月:月计提 950 元整', () => {
    // 应计 = 12000 - 600 = 11400 → 月 950
    expect(straightLinePeriodCents(1_200_000, 0.05, 12, 1)).toBe(95_000)
    expect(straightLinePeriodCents(1_200_000, 0.05, 12, 12)).toBe(95_000)
  })

  it('不能整除时尾差进最后一个月,全期合计严格等于应计额', () => {
    // 1000.00 元、无残值、3 个月 → 333.33 + 333.33 + 333.34
    const s = [1, 2, 3].map((i) => straightLinePeriodCents(100_000, 0, 3, i))
    expect(s).toEqual([33_333, 33_333, 33_334])
    expect(s.reduce((a, b) => a + b, 0)).toBe(100_000)
  })

  it('期序号越界(0 或超过寿命)计提为 0', () => {
    expect(straightLinePeriodCents(100_000, 0.05, 24, 0)).toBe(0)
    expect(straightLinePeriodCents(100_000, 0.05, 24, 25)).toBe(0)
  })

  it('寿命非法(0/负/小数)计提为 0,不抛不猜', () => {
    expect(straightLinePeriodCents(100_000, 0.05, 0, 1)).toBe(0)
    expect(straightLinePeriodCents(100_000, 0.05, -3, 1)).toBe(0)
    expect(straightLinePeriodCents(100_000, 0.05, 1.5, 1)).toBe(0)
  })
})

describe('depreciationSequence / monthsBetween', () => {
  it('开始当期即第 1 期,跨年月序正确', () => {
    expect(monthsBetween('2026-01', '2026-01')).toBe(0)
    expect(monthsBetween('2025-11', '2026-02')).toBe(3)
    const card = {
      startPeriod: '2025-11',
      usefulMonths: 12,
      status: 'active',
      disposalPeriod: null,
    } as const
    expect(depreciationSequence(card, '2025-11')).toBe(1)
    expect(depreciationSequence(card, '2026-10')).toBe(12)
    // 早于开始期不计提
    expect(depreciationSequence(card, '2025-10')).toBeNull()
  })

  it('处置期起停提,处置当月仍提(最后可用期)', () => {
    const disposed = {
      startPeriod: '2026-01',
      usefulMonths: 24,
      status: 'disposed',
      disposalPeriod: '2026-06',
    } as const
    expect(depreciationSequence(disposed, '2026-05')).toBe(5)
    expect(depreciationSequence(disposed, '2026-06')).toBeNull()
    expect(depreciationSequence(disposed, '2026-07')).toBeNull()
  })

  it('accumulatedCentsAt 合计不超过应计总额(处置冻结)', () => {
    const a = {
      originalCost: '10000.00',
      salvageRate: '0.0500',
      usefulMonths: 10,
      startPeriod: '2026-01',
      disposalPeriod: '2026-03',
      status: 'disposed',
    } as const
    // 应计 9500 元,只提了 2026-01/02 两期 = 950 + 950
    expect(accumulatedCentsAt(a, '2026-03')).toBe(190_000)
    // 月全取回:10 期合计严格 = 9500 元(尾差已并入最后期)
    const full = { ...a, status: 'active', disposalPeriod: null } as const
    expect(accumulatedCentsAt(full, '2026-10')).toBe(950_000)
  })
})

describe('sumPayrollTaxRows IIT 回流汇总', () => {
  it('逐人分口径累加,人数如实', () => {
    const r = sumPayrollTaxRows([
      { taxableIncome: '9800.00', incomeTax: '294.00' },
      { taxableIncome: '36000.00', incomeTax: '1080.00' },
      { taxableIncome: '0.00', incomeTax: '0.00' },
    ])
    expect(r.headcount).toBe(3)
    expect(r.baseCents).toBe(4_580_000)
    expect(r.taxCents).toBe(137_400)
  })

  it('空集合聚合为 0 人(由上层对 0 人 fail-closed,聚合本身不冒充有数)', () => {
    expect(sumPayrollTaxRows([])).toEqual({ baseCents: 0, taxCents: 0, headcount: 0 })
  })
})

describe('selectFilingDueTasks 提醒窗', () => {
  const mk = (id: string, status: string, dueDate: string) => ({ id, status, dueDate })
  it('临期(0~3 天)与逾期(30 天内)进提醒,窗口外与已提交不进', () => {
    const tasks = [
      mk('a', 'pending', '2026-11-24'), // 今天 → upcoming days=0
      mk('b', 'computed', '2026-11-27'), // 3 天后 → upcoming
      mk('c', 'drafted', '2026-11-28'), // 4 天后 → 窗外
      mk('d', 'pending', '2026-11-20'), // 逾期 4 天
      mk('e', 'submitted', '2026-11-24'), // 已提交不提醒
      mk('f', 'pending', '2026-09-01'), // 逾期 84 天 → 陈旧线外
    ]
    const picked = selectFilingDueTasks(tasks, '2026-11-24')
    expect(picked.map((p) => p.task.id).sort()).toEqual(['a', 'b', 'd'])
    expect(picked.find((p) => p.task.id === 'd')?.kind).toBe('overdue')
    expect(picked.find((p) => p.task.id === 'a')?.days).toBe(0)
  })

  it('dueDate 带时间戳形态只取日期部分比较', () => {
    const picked = selectFilingDueTasks([mk('g', 'pending', '2026-11-26T00:00:00.000Z')], '2026-11-24')
    expect(picked).toHaveLength(1)
    expect(picked[0]?.days).toBe(2)
  })
})

describe('aggregateAuxRows 辅助核算聚合', () => {
  it('同值借贷分口径累加,按净额绝对值降序', () => {
    const rows = [
      { value: '华东客户', direction: 'debit' as const, cents: 50_000 },
      { value: '华东客户', direction: 'credit' as const, cents: 20_000 },
      { value: '研发部', direction: 'debit' as const, cents: 5_000 },
    ]
    expect(aggregateAuxRows(rows)).toEqual([
      { value: '华东客户', debit: 50_000, credit: 20_000, net: 30_000 },
      { value: '研发部', debit: 5_000, credit: 0, net: 5_000 },
    ])
  })

  it('空集不报错,给空表', () => {
    expect(aggregateAuxRows([])).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
