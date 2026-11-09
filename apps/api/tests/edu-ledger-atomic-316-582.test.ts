// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-316 + F-582 回归锁:账本「读快照 → 绝对值写回」必须整体收进同一事务,
 * 且在同一事务内先 FOR UPDATE 锁报名行、再读账、再写回。
 *
 * 本机没有可用测试库(无 .env.test),用内存假库 + 事务互斥模拟 PG 串行化:
 *  - db.transaction 回调整体串行(等价行锁下的串行执行);
 *  - 记录事件顺序,断言 forUpdate 在读之前、读写都在 tx:begin/tx:commit 之间。
 * 改前:缴费 insert 在事务外、重算先读后开事务 → 事件序列里出现 tx 外的读写,断言变红。
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
  schedules: [] as Array<Record<string, unknown>>,
  events: [] as string[],
  mutex: Promise.resolve() as Promise<unknown>,
}))

const tableName = (t: unknown): string =>
  (t as Record<symbol, string>)?.[Symbol.for('drizzle:Name')] ?? 'unknown'

vi.mock('../src/db/index.js', () => {
  const selectRows = (table: unknown, fields: Record<string, unknown>) => {
    const name = tableName(table)
    state.events.push(`select:${name}`)
    if (name === 'edu_enrollment') {
      if ('n' in fields) return [{ n: 1 }]
      return [{ ...state.enrollment }]
    }
    if (name === 'edu_payment_record') return state.payments.map((p) => ({ ...p }))
    if (name === 'edu_fee_schedule') return state.schedules.map((s) => ({ ...s }))
    return []
  }

  const select = (fields: Record<string, unknown>) => {
    let table: unknown
    const b: Record<string, unknown> = {
      from: (t: unknown) => {
        table = t
        return b
      },
      where: () => b,
      orderBy: () => b,
      limit: () => b,
      groupBy: () => b,
      leftJoin: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(selectRows(table, fields)).then(res, rej),
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
        Promise.resolve()
          .then(() => {
            const name = tableName(table)
            state.events.push(`insert:${name}`)
            if (name === 'edu_payment_record') {
              const row: FakePayment = {
                id: `p${state.payments.length + 1}`,
                enrollmentId: values.enrollmentId as string,
                studentId: values.studentId as string,
                classId: values.classId as string,
                amount: values.amount as number,
                status: (values.status as string) ?? 'paid',
                scheduleId: (values.scheduleId as string | null) ?? null,
                deletedAt: null,
              }
              state.payments.push(row)
              return [{ id: row.id }]
            }
            return []
          })
          .then(res, rej),
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
        Promise.resolve()
          .then(() => {
            const name = tableName(table)
            state.events.push(`update:${name}`)
            if (name === 'edu_enrollment') {
              state.enrollment.paidAmount = Number(set.paidAmount)
              state.enrollment.nextDueDate = (set.nextDueDate as string | null) ?? null
            }
            return []
          })
          .then(res, rej),
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

  // 事务互斥:回调整体串行,等价 PostgreSQL 行锁下的串行执行
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

import { recordPayment, recomputeEnrollment } from '../src/services/edu-ledger.js'

const base = {
  enrollmentId: 'e1',
  studentId: 's1',
  classId: 'c1',
  paymentDate: '2026-11-08',
  paymentMethod: 'cash',
}

beforeEach(() => {
  state.enrollment.paidAmount = 0
  state.enrollment.nextDueDate = null
  state.payments.length = 0
  state.events.length = 0
  state.mutex = Promise.resolve()
})

describe('F-316 缴费落库与重算同一事务', () => {
  it('缴费 insert 与账目读/写都发生在 tx 内(旧实现 insert 在事务外)', async () => {
    await recordPayment({ ...base, amount: 300 })

    expect(state.events[0]).toBe('tx:begin')
    expect(state.events.at(-1)).toBe('tx:commit')
    const begin = state.events.indexOf('tx:begin')
    const commit = state.events.indexOf('tx:commit')
    const insertAt = state.events.indexOf('insert:edu_payment_record')
    const updateAt = state.events.indexOf('update:edu_enrollment')
    expect(insertAt).toBeGreaterThan(begin)
    expect(updateAt).toBeGreaterThan(insertAt)
    expect(updateAt).toBeLessThan(commit)
  })
})

describe('F-582 重算先锁行、再读账、再写回', () => {
  it('FOR UPDATE 必须早于账本读取,且整段在事务内', async () => {
    state.payments.push({
      id: 'p0',
      enrollmentId: 'e1',
      studentId: 's1',
      classId: 'c1',
      amount: 200,
      status: 'paid',
      scheduleId: null,
      deletedAt: null,
    })

    await recomputeEnrollment('e1')

    const begin = state.events.indexOf('tx:begin')
    const lockAt = state.events.indexOf('execute:forUpdate')
    const readAt = state.events.indexOf('select:edu_enrollment')
    const writeAt = state.events.indexOf('update:edu_enrollment')
    const commit = state.events.indexOf('tx:commit')
    expect(begin).toBeGreaterThanOrEqual(0)
    expect(lockAt).toBeGreaterThan(begin)
    expect(readAt).toBeGreaterThan(lockAt)
    expect(writeAt).toBeGreaterThan(readAt)
    expect(commit).toBeGreaterThan(writeAt)
    expect(state.enrollment.paidAmount).toBe(200)
  })
})

describe('并发与重放', () => {
  it('两条真并发各 300 ⇒ 终值 600,且每次事务都先锁后读', async () => {
    const [a, b] = await Promise.all([
      recordPayment({ ...base, amount: 300 }),
      recordPayment({ ...base, amount: 300 }),
    ])

    expect(state.enrollment.paidAmount).toBe(600)
    expect(state.payments).toHaveLength(2)
    expect(a.ledger?.paidAmount).toBe(300)
    expect(b.ledger?.paidAmount).toBe(600)

    // 事务被串行化:每个事务内先落缴费行(允许),随后 forUpdate 抢锁,再读账
    const beginIdx = state.events.flatMap((e, i) => (e === 'tx:begin' ? [i] : []))
    expect(beginIdx).toHaveLength(2)
    for (const i of beginIdx) {
      const lockAt = state.events.indexOf('execute:forUpdate', i)
      const readAt = state.events.indexOf('select:edu_enrollment', i)
      const commitAt = state.events.indexOf('tx:commit', i)
      expect(lockAt).toBeGreaterThan(i)
      expect(readAt).toBeGreaterThan(lockAt)
      expect(commitAt).toBeGreaterThan(readAt)
    }
  })

  it('顺序重放 300 + 500 ⇒ 累计 800(可从任一步重算重建,不依赖增量写)', async () => {
    await recordPayment({ ...base, amount: 300 })
    const second = await recordPayment({ ...base, amount: 500 })

    expect(state.enrollment.paidAmount).toBe(800)
    expect(second.ledger?.paidAmount).toBe(800)
    const rebuilt = await recomputeEnrollment('e1')
    expect(rebuilt?.paidAmount).toBe(800)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
