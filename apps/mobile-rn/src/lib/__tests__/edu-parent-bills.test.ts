// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  aggregateParentBills,
  earliestDue,
  sumParentBills,
  type ParentBillChildRef,
  type ParentBillItem,
} from '../edu-parent-bills'

function bill(
  enrollmentId: string,
  totalFee: number,
  ledger: ParentBillItem['ledger'],
): ParentBillItem {
  return { enrollmentId, className: 'C', termName: 'T', status: 'active', totalFee, ledger }
}

const kids: ParentBillChildRef[] = [
  { studentId: 's1', name: '小明' },
  { studentId: 's2', name: '小红' },
]

describe('aggregateParentBills', () => {
  it('按孩子聚合金额与最早到期日(s1 两期取更早的那个)', () => {
    const groups = aggregateParentBills(kids, [
      {
        studentId: 's1',
        bills: [
          bill('e1', 1000, {
            arrears: 300,
            paidAmount: 700,
            nextDueDate: '2026-11-05T00:00:00.000Z',
            overdueCount: 0,
            dueSoonCount: 1,
          }),
          bill('e2', 500, {
            arrears: 500,
            paidAmount: 0,
            nextDueDate: '2026-10-20T00:00:00.000Z',
            overdueCount: 1,
            dueSoonCount: 0,
          }),
        ],
      },
      {
        studentId: 's2',
        bills: [
          bill('e3', 800, {
            arrears: 0,
            paidAmount: 800,
            nextDueDate: null,
            overdueCount: 0,
            dueSoonCount: 0,
          }),
        ],
      },
    ])

    expect(groups.map((g) => g.studentId)).toEqual(['s1', 's2'])
    const [first, second] = groups
    expect(first).toMatchObject({
      name: '小明',
      termCount: 2,
      totalFee: 1500,
      paidAmount: 700,
      arrears: 800,
      overdueCount: 1,
      nextDueDate: '2026-10-20T00:00:00.000Z',
      ledgerPendingCount: 0,
      failed: null,
    })
    expect(second).toMatchObject({ paidAmount: 800, arrears: 0, nextDueDate: null })
  })

  it('账目未就绪(ledger=null)只计期数与总额,不冒充已缴/欠费', () => {
    const [g] = aggregateParentBills(
      [kids[0]!],
      [{ studentId: 's1', bills: [bill('e1', 1200, null)] }],
    )
    expect(g).toMatchObject({
      termCount: 1,
      totalFee: 1200,
      ledgerPendingCount: 1,
      paidAmount: 0,
      arrears: 0,
      overdueCount: 0,
      nextDueDate: null,
      failed: null,
    })
  })

  it('取数失败的孩子保留该组并点名原因,金额保持 0(不读成"没欠费")', () => {
    const groups = aggregateParentBills(kids, [
      { studentId: 's1', failed: '403 无权查看该学员的账单' },
      { studentId: 's2', bills: [bill('e3', 100, null)] },
    ])
    expect(groups[0]).toMatchObject({
      failed: '403 无权查看该学员的账单',
      arrears: 0,
      termCount: 0,
    })
    expect(groups[1]!.failed).toBeNull()
    expect(sumParentBills(groups).failedCount).toBe(1)
  })

  it('children 有而结果缺失 ⇒ 判为未判定(missing-result),不静默当空账单', () => {
    const groups = aggregateParentBills(kids, [{ studentId: 's2', bills: [] }])
    expect(groups[0]!.failed).toBe('missing-result')
    expect(groups[1]!.failed).toBeNull()
  })

  it('结果里出现孩子列表之外的 studentId 一律忽略(归属以孩子列表为准)', () => {
    const groups = aggregateParentBills(
      [kids[0]!],
      [
        { studentId: 's1', bills: [] },
        { studentId: 'ghost', bills: [bill('x', 9, null)] },
      ],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]!.termCount).toBe(0)
  })

  it('输出顺序恒等于 children 顺序,与取数完成顺序无关', () => {
    const groups = aggregateParentBills(kids, [
      { studentId: 's2', bills: [] },
      { studentId: 's1', bills: [] },
    ])
    expect(groups.map((g) => g.studentId)).toEqual(['s1', 's2'])
  })
})

describe('sumParentBills', () => {
  it('合计跳过失败组、累加到期日取最早,并报未就绪期数', () => {
    const groups = aggregateParentBills(kids, [
      {
        studentId: 's1',
        bills: [
          bill('e1', 100, {
            arrears: 10,
            paidAmount: 90,
            nextDueDate: '2026-12-01',
            overdueCount: 0,
            dueSoonCount: 0,
          }),
          bill('e2', 50, null),
        ],
      },
      { studentId: 's2', failed: 'boom' },
    ])
    expect(sumParentBills(groups)).toEqual({
      arrears: 10,
      overdueCount: 0,
      nextDueDate: '2026-12-01',
      ledgerPendingCount: 1,
      failedCount: 1,
    })
  })
})

describe('earliestDue', () => {
  it('非法日期一律忽略,不参与比较', () => {
    expect(earliestDue(null, 'not-a-date')).toBeNull()
    expect(earliestDue('2026-01-01', 'not-a-date')).toBe('2026-01-01')
    expect(earliestDue('not-a-date', '2026-01-01')).toBe('2026-01-01')
  })

  it('取更早的一个', () => {
    expect(earliestDue('2026-05-01', '2026-04-30')).toBe('2026-04-30')
    expect(earliestDue('2026-05-01', '2026-06-30')).toBe('2026-05-01')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
