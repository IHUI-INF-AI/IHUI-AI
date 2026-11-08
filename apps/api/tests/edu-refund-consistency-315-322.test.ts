// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-315 + F-322 回归锁:
 *  - F-322:退费必须校验「流水归属」与「累计不超过流水金额」,并锁流水行串行校验(真并发只放过一笔);
 *  - F-315:全额退满后流水必须推离 'paid';汇总收入按「已缴 − 已退」冲减,净缴为 0 的学员不计已缴人数。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

interface FakePayment {
  id: string
  enrollmentId: string
  studentId: string
  classId: string
  amount: number
  status: string
  scheduleId: string | null
  deletedAt: null
}
interface FakeRefund {
  id: string
  enrollmentId: string
  paymentId: string | null
  studentId: string
  classId: string
  amount: number
  status: string
  scheduleId: null
  deletedAt: null
}

const state = vi.hoisted(() => ({
  enrollment: {
    id: 'e1',
    totalFee: 1000,
    studentId: 's1',
    classId: 'c1',
    paidAmount: 0,
    nextDueDate: null as string | null,
  },
  payments: [] as FakePayment[],
  refunds: [] as FakeRefund[],
  events: [] as string[],
  mutex: Promise.resolve() as Promise<unknown>,
}))

const tableName = (t: unknown): string =>
  (t as Record<symbol, string>)?.[Symbol.for('drizzle:Name')] ?? 'unknown'

const countedRefundSum = (paymentId?: string) =>
  state.refunds
    .filter(
      (r) =>
        (!paymentId || r.paymentId === paymentId) &&
        !r.deletedAt &&
        ['pending', 'approved', 'completed'].includes(r.status),
    )
    .reduce((n, r) => n + Number(r.amount), 0)

const settledRefundSum = (paymentId?: string) =>
  state.refunds
    .filter(
      (r) =>
        (!paymentId || r.paymentId === paymentId) &&
        !r.deletedAt &&
        ['approved', 'completed'].includes(r.status),
    )
    .reduce((n, r) => n + Number(r.amount), 0)

vi.mock('../src/db/index.js', () => {
  const resolveRows = (table: unknown, fields: Record<string, unknown>, grouped: boolean) => {
    const name = tableName(table)
    const keys = Object.keys(fields)
    state.events.push(`select:${name}`)

    if (name === 'edu_enrollment') {
      if (keys.includes('n')) return [{ n: 1 }]
      return [{ ...state.enrollment }]
    }
    if (name === 'edu_payment_record') {
      if (keys.includes('total')) {
        if (grouped) {
          const byStudent = new Map<string, number>()
          for (const p of state.payments.filter((x) => x.status === 'paid')) {
            byStudent.set(p.studentId, (byStudent.get(p.studentId) ?? 0) + Number(p.amount))
          }
          return [...byStudent.entries()].map(([studentId, total]) => ({ studentId, total }))
        }
        return [
          {
            total: state.payments
              .filter((x) => x.status === 'paid')
              .reduce((n, p) => n + Number(p.amount), 0),
          },
        ]
      }
      if (keys.includes('enrollmentId') && keys.includes('studentId')) {
        return state.payments[0] ? [{ ...state.payments[0] }] : []
      }
      if (keys.includes('amount') && keys.includes('status') && !keys.includes('id')) {
        return state.payments[0]
          ? [{ amount: state.payments[0].amount, status: state.payments[0].status }]
          : []
      }
      return state.payments.map((p) => ({ ...p }))
    }
    if (name === 'edu_refund_record') {
      if (keys.includes('sum')) {
        return [{ sum: countedRefundSum(keys.includes('paymentId') ? undefined : undefined) }]
      }
      if (keys.includes('total')) {
        if (grouped) {
          const byStudent = new Map<string, number>()
          for (const r of state.refunds.filter(
            (x) => !x.deletedAt && ['approved', 'completed'].includes(x.status),
          )) {
            byStudent.set(r.studentId, (byStudent.get(r.studentId) ?? 0) + Number(r.amount))
          }
          return [...byStudent.entries()].map(([studentId, total]) => ({ studentId, total }))
        }
        return [{ total: settledRefundSum() }]
      }
      if (keys.includes('enrollmentId') && keys.includes('paymentId')) {
        return state.refunds[0] ? [{ ...state.refunds[0] }] : []
      }
      return state.refunds.map((r) => ({ ...r }))
    }
    if (name === 'edu_fee_schedule') return []
    return []
  }

  const select = (fields: Record<string, unknown>) => {
    let table: unknown
    let grouped = false
    const b: Record<string, unknown> = {
      from: (t: unknown) => {
        table = t
        return b
      },
      where: () => b,
      orderBy: () => b,
      limit: () => b,
      leftJoin: () => b,
      groupBy: () => {
        grouped = true
        return b
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(resolveRows(table, fields, grouped)).then(res, rej),
    }
    return b
  }

  const insert = (table: unknown) => {
    let values: Record<string, unknown> = {}
    const b: Record<string, unknown> = {
      values: (v: Record<string, unknown>) => {
        values = v
        return b
      },
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => {
          const name = tableName(table)
          state.events.push(`insert:${name}`)
          const row: FakeRefund = {
            id: `r${state.refunds.length + 1}`,
            enrollmentId: (values.enrollmentId as string) ?? 'e1',
            paymentId: (values.paymentId as string | null) ?? null,
            studentId: values.studentId as string,
            classId: values.classId as string,
            amount: Number(values.amount),
            status: (values.status as string) ?? 'pending',
            scheduleId: null,
            deletedAt: null,
          }
          state.refunds.push(row)
          return [row]
        }).then(res, rej),
    }
    return b
  }

  const update = (table: unknown) => {
    let set: Record<string, unknown> = {}
    const b: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        set = v
        return b
      },
      where: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => {
          const name = tableName(table)
          state.events.push(`update:${name}`)
          if (name === 'edu_refund_record') {
            for (const r of state.refunds) Object.assign(r, set)
          }
          if (name === 'edu_payment_record') {
            for (const p of state.payments) if ('status' in set) p.status = set.status as string
          }
          if (name === 'edu_enrollment') {
            state.enrollment.paidAmount = Number(set.paidAmount)
            state.enrollment.nextDueDate = (set.nextDueDate as string | null) ?? null
          }
          return []
        }).then(res, rej),
    }
    return b
  }

  const fakeDb: Record<string, unknown> = {
    select,
    insert,
    update,
    delete: () => select({}),
    execute: () => {
      state.events.push('execute:forUpdate')
      return Promise.resolve([])
    },
  }

  fakeDb.transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
    const prev = state.mutex
    let release!: () => void
    state.mutex = new Promise((r) => {
      release = r as () => void
    })
    await prev
    state.events.push('tx:begin')
    try {
      const out = await fn(fakeDb)
      state.events.push('tx:commit')
      return out
    } catch (e) {
      state.events.push('tx:rollback')
      throw e
    } finally {
      release()
    }
  }

  return { db: fakeDb }
})

import {
  loadPaymentIncomeSummary,
  recordRefund,
  settleRefund,
} from '../src/services/edu-ledger.js'
import { db } from '../src/db/index.js'

const refundBase = {
  studentId: 's1',
  classId: 'c1',
  refundDate: '2026-11-08',
  reason: '测试退费',
}

function seedPayment(amount: number, overrides: Partial<FakePayment> = {}) {
  state.payments.push({
    id: 'p1',
    enrollmentId: 'e1',
    studentId: 's1',
    classId: 'c1',
    amount,
    status: 'paid',
    scheduleId: null,
    deletedAt: null,
    ...overrides,
  })
}

beforeEach(() => {
  state.enrollment.paidAmount = 0
  state.enrollment.nextDueDate = null
  state.payments.length = 0
  state.refunds.length = 0
  state.events.length = 0
  state.mutex = Promise.resolve()
})

describe('F-322 退费归属与额度校验', () => {
  it('学员/班级与流水不一致 ⇒ 400 且不落库', async () => {
    seedPayment(1000, { studentId: 's2' })

    await expect(
      recordRefund({ ...refundBase, amount: 100, paymentId: 'p1' }),
    ).rejects.toMatchObject({ statusCode: 400, errorCode: 'EDU_REFUND_OWNER_MISMATCH' })
    expect(state.refunds).toHaveLength(0)
  })

  it('超出剩余可退额度 ⇒ 400 且不落库', async () => {
    seedPayment(1000)
    state.refunds.push({
      id: 'r0',
      enrollmentId: 'e1',
      paymentId: 'p1',
      studentId: 's1',
      classId: 'c1',
      amount: 600,
      status: 'pending',
      scheduleId: null,
      deletedAt: null,
    })

    await expect(
      recordRefund({ ...refundBase, amount: 500, paymentId: 'p1' }),
    ).rejects.toMatchObject({ statusCode: 400, errorCode: 'EDU_REFUND_OVER_LIMIT' })
    expect(state.refunds).toHaveLength(1)
  })

  it('两条真并发各退 600(流水 1000)⇒ 只放过一笔,另一笔超限', async () => {
    seedPayment(1000)

    const results = await Promise.allSettled([
      recordRefund({ ...refundBase, amount: 600, paymentId: 'p1' }),
      recordRefund({ ...refundBase, amount: 600, paymentId: 'p1' }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ errorCode: 'EDU_REFUND_OVER_LIMIT' })
    expect(state.refunds).toHaveLength(1)
    expect(state.refunds[0].amount).toBe(600)
  })
})

describe('F-315 退满把流水推离 paid', () => {
  it('全额退费审批通过 ⇒ 关联流水 status=refunded', async () => {
    seedPayment(1000)
    state.refunds.push({
      id: 'r1',
      enrollmentId: 'e1',
      paymentId: 'p1',
      studentId: 's1',
      classId: 'c1',
      amount: 1000,
      status: 'pending',
      scheduleId: null,
      deletedAt: null,
    })

    await settleRefund({ refundId: 'r1', status: 'approved' })

    expect(state.refunds[0].status).toBe('approved')
    expect(state.payments[0].status).toBe('refunded')
  })

  it('部分退费审批通过 ⇒ 流水仍为 paid(未退部分继续计收)', async () => {
    seedPayment(1000)
    state.refunds.push({
      id: 'r1',
      enrollmentId: 'e1',
      paymentId: 'p1',
      studentId: 's1',
      classId: 'c1',
      amount: 400,
      status: 'pending',
      scheduleId: null,
      deletedAt: null,
    })

    await settleRefund({ refundId: 'r1', status: 'approved' })

    expect(state.refunds[0].status).toBe('approved')
    expect(state.payments[0].status).toBe('paid')
  })
})

describe('F-315 汇总冲减退费', () => {
  it('总收入=已缴-已退,净缴为 0 的学员不计已缴人数', async () => {
    // s1:缴 1000、退 600(净 400);s2:缴 500、退 500(净 0);s3:流水已 refunded(不计)
    seedPayment(1000, { id: 'p1', studentId: 's1' })
    seedPayment(500, { id: 'p2', studentId: 's2' })
    seedPayment(300, { id: 'p3', studentId: 's3', status: 'refunded' })
    state.refunds.push(
      {
        id: 'r1',
        enrollmentId: 'e1',
        paymentId: 'p1',
        studentId: 's1',
        classId: 'c1',
        amount: 600,
        status: 'approved',
        scheduleId: null,
        deletedAt: null,
      },
      {
        id: 'r2',
        enrollmentId: 'e1',
        paymentId: 'p2',
        studentId: 's2',
        classId: 'c1',
        amount: 500,
        status: 'completed',
        scheduleId: null,
        deletedAt: null,
      },
      {
        id: 'r3',
        enrollmentId: 'e1',
        paymentId: 'p1',
        studentId: 's1',
        classId: 'c1',
        amount: 200,
        status: 'pending',
        scheduleId: null,
        deletedAt: null,
      },
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await loadPaymentIncomeSummary(db as any)

    expect(summary.totalIncome).toBe(400)
    expect(summary.paidStudentCount).toBe(1)
  })
})
