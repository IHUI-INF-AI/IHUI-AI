// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-20 回归夹具（纯 mock，不连库）。
 *
 * 缺陷：家长账单端点对每条报名调用一次 loadEnrollmentLedger，单次函数内 5 条 SQL，
 * N 条报名 = 5N 次往返且列表无上限。
 *
 * 断言：批量入口 loadEnrollmentLedgers 对任意条数只发固定 5 条查询，
 * 且逐条账目结果与单条路径的口径一致（含"唯一报名才认领无归属流水"的语义）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  selectCalls: 0,
  enrollmentRows: [] as Row[],
  siblingRows: [] as Row[],
  paymentRows: [] as Row[],
  refundRows: [] as Row[],
  scheduleRows: [] as Row[],
}))

vi.mock('@ihui/database', () => ({
  eduEnrollment: { __table: 'enrollment' },
  eduPaymentRecord: { __table: 'payment' },
  eduRefundRecord: { __table: 'refund' },
  eduFeeSchedule: { __table: 'schedule' },
}))

vi.mock('../../db/index.js', () => {
  const resolveRows = (table: Row | undefined, projection: Row | undefined): Row[] => {
    switch (table?.__table) {
      case 'enrollment':
        return projection && 'n' in projection ? state.siblingRows : state.enrollmentRows
      case 'payment':
        return state.paymentRows
      case 'refund':
        return state.refundRows
      case 'schedule':
        return state.scheduleRows
      default:
        return []
    }
  }

  const createChain = (projection: Row | undefined) => {
    let rows: Row[] = []
    const chain: Record<string, unknown> = {}
    chain.from = (table: Row) => {
      rows = resolveRows(table, projection)
      return chain
    }
    chain.where = () => chain
    chain.leftJoin = () => chain
    chain.groupBy = () => chain
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected)
    return chain
  }

  return {
    db: {
      select: vi.fn((projection?: Row) => {
        state.selectCalls += 1
        return createChain(projection)
      }),
    },
  }
})

import { loadEnrollmentLedgers } from '../edu-ledger.js'

describe('DB-20 家长账单账目批量读取', () => {
  beforeEach(() => {
    state.selectCalls = 0
    state.enrollmentRows = []
    state.siblingRows = []
    state.paymentRows = []
    state.refundRows = []
    state.scheduleRows = []
  })

  it('两条报名只发 5 条查询，且逐条账目口径正确', async () => {
    state.enrollmentRows = [
      { id: 'e1', totalFee: 1000, studentId: 's1', classId: 'c1' },
      { id: 'e2', totalFee: 500, studentId: 's1', classId: 'c2' },
    ]
    // 两个 student×class 都只有一条有效报名 ⇒ 无归属流水可被认领
    state.siblingRows = [
      { studentId: 's1', classId: 'c1', n: 1 },
      { studentId: 's1', classId: 'c2', n: 1 },
    ]
    state.paymentRows = [
      {
        id: 'p1',
        amount: 600,
        status: 'paid',
        scheduleId: 'sc1',
        enrollmentId: 'e1',
        studentId: 's1',
        classId: 'c1',
      },
      // 无归属流水：靠 student×class 唯一报名认领到 e2
      {
        id: 'p2',
        amount: 200,
        status: 'paid',
        scheduleId: null,
        enrollmentId: null,
        studentId: 's1',
        classId: 'c2',
      },
    ]
    state.refundRows = [
      {
        amount: 50,
        status: 'approved',
        scheduleId: 'sc1',
        enrollmentId: 'e1',
        studentId: 's1',
        classId: 'c1',
      },
    ]
    state.scheduleRows = [
      {
        id: 'sc1',
        enrollmentId: 'e1',
        dueDate: '2026-01-01',
        graceDays: 0,
        amountDue: 500,
        status: 'pending',
      },
      {
        id: 'sc2',
        enrollmentId: 'e2',
        dueDate: '2026-12-01',
        graceDays: 0,
        amountDue: 500,
        status: 'pending',
      },
    ]

    const ledgers = await loadEnrollmentLedgers(['e1', 'e2'])

    // N 条报名也只有 5 条 SQL：报名行 / 兄弟计数 / 支付 / 退费 / 账期
    expect(state.selectCalls).toBe(5)
    expect(ledgers.size).toBe(2)
    expect(ledgers.get('e1')).toMatchObject({
      totalFee: 1000,
      creditedAmount: 600,
      settledRefund: 50,
      paidAmount: 550,
      arrears: 450,
    })
    expect(ledgers.get('e2')).toMatchObject({
      totalFee: 500,
      creditedAmount: 200,
      paidAmount: 200,
      arrears: 300,
    })
  })

  it('空入参不发任何查询', async () => {
    await loadEnrollmentLedgers([])
    expect(state.selectCalls).toBe(0)
  })
})
