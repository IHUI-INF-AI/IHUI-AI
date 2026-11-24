// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-317 回归锁(2026-11-13)。
 *
 * 病灶:催费文案取"全部账期最大逾期天数",已缴清的历史账期(2025-12-01)
 * 把未到期欠费说成"逾期 347 天";同时 dueSoonCount 被 overdueDays===0 短路,
 * 到期提醒漏发。根因是 edu-ledger 对已缴清账期也无条件算 overdueDays。
 *
 * 修后口径:
 *  ① 催费侧只取 s.overdue === true 的账期;
 *  ② dueSoonCount 不再被最大逾期天数短路;
 *  ③ 账目出口对已缴清账期把 overdueDays 归零(overdue 布尔语义不变)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

interface ScheduleSeed {
  id: string
  dueDate: string
  graceDays: number
  amountDue: number
  status: string
}
interface LedgerSeed {
  totalFee: number
  schedules: ScheduleSeed[]
  payments: Array<{ id: string; amount: number; status: string; scheduleId: string | null }>
  refunds: Array<{ amount: number; status: string; scheduleId: string | null }>
}

const state = vi.hoisted(() => ({
  enrollments: [] as Array<{ enrollmentId: string; studentId: string; studentName: string }>,
  reminders: [] as Array<{
    id: string
    enrollmentId: string
    studentId: string
    status: string
    channel: string
    dueAmount: number
    message: string | null
    delivery: unknown
    createdAt: Date
    updatedAt: Date
  }>,
  bindings: [] as Array<{ studentId: string; parentId: string }>,
  users: [] as Array<{ id: string; phone: string | null; nickname: string | null }>,
  ledgers: {} as Record<string, LedgerSeed>,
  seq: 0,
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const render = (cond: unknown) => {
    try {
      return dialect.sqlToQuery(cond as never)
    } catch {
      return { sql: '', params: [] as unknown[] }
    }
  }
  const tableName = (t: unknown): string =>
    (t as Record<symbol, string>)?.[Symbol.for('drizzle:Name')] ?? 'unknown'

  const selectRows = (table: unknown, cond: unknown) => {
    const name = tableName(table)
    const q = render(cond)
    const params = q.params.map((p) => String(p))

    if (name === 'edu_enrollment') return state.enrollments.map((e) => ({ ...e }))
    if (name === 'edu_fee_reminder') {
      // 去重查询只认 status='sent';本文件每个用例都是空表起步
      const onlySent = q.sql.includes('"status" =') && params.includes('sent')
      const rows = onlySent ? state.reminders.filter((r) => r.status === 'sent') : state.reminders
      return rows.map((r) => ({ enrollmentId: r.enrollmentId, status: r.status }))
    }
    if (name === 'edu_parent_student_binding') {
      return state.bindings
        .filter((b) => params.includes(b.studentId))
        .map((b) => ({ parentId: b.parentId }))
    }
    if (name === 'users') {
      const ids = new Set(params)
      return state.users
        .filter((u) => ids.has(u.id))
        .map((u) => ({ id: u.id, phone: u.phone, nickname: u.nickname }))
    }
    return []
  }

  const select = (_fields: Record<string, unknown>) => {
    let table: unknown
    let cond: unknown
    const b: Record<string, unknown> = {
      from: (t: unknown) => {
        table = t
        return b
      },
      innerJoin: () => b,
      leftJoin: () => b,
      where: (c: unknown) => {
        cond = c
        return b
      },
      orderBy: () => b,
      limit: () => b,
      groupBy: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(selectRows(table, cond)).then(res, rej),
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
      onConflictDoNothing: () => b,
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            if (tableName(table) !== 'edu_fee_reminder') return []
            const row = {
              id: `r${++state.seq}`,
              enrollmentId: (values.enrollmentId as string) ?? '',
              studentId: (values.studentId as string) ?? '',
              status: (values.status as string) ?? 'sent',
              channel: (values.channel as string) ?? 'in_app',
              dueAmount: Number(values.dueAmount ?? 0),
              message: (values.message as string | null) ?? null,
              delivery: values.delivery ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            state.reminders.push(row)
            return [{ id: row.id }]
          })
          .then(res, rej),
    }
    return b
  }

  const update = (table: unknown) => {
    let set: Record<string, unknown> = {}
    let cond: unknown
    const b: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        set = v
        return b
      },
      where: (c: unknown) => {
        cond = c
        return b
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            if (tableName(table) !== 'edu_fee_reminder') return undefined
            const id = String(render(cond).params[0] ?? '')
            const row = state.reminders.find((r) => r.id === id)
            if (row) Object.assign(row, set)
            return undefined
          })
          .then(res, rej),
    }
    return b
  }

  return { db: { select, insert, update, execute: async () => [] } }
})

vi.mock('../src/db/notification-queries.js', () => ({ createNotification: vi.fn() }))

// 保留真实 deriveEnrollmentLedger(用于锁账目口径),只桩掉查库入口
vi.mock('../src/services/edu-ledger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EduLedgerModule>()
  return { ...actual, loadEnrollmentLedger: vi.fn() }
})

vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: false, errcode: 0 })),
}))

vi.mock('../src/services/sms.js', () => ({
  isArrearSmsConfigured: vi.fn(() => false),
  sendArrearSms: vi.fn(async () => ({ success: false, error: 'not_configured' })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type * as EduLedgerModule from '../src/services/edu-ledger.js'
import { scanAndRemindArrears } from '../src/services/edu-arrear-remind-service.js'
import { deriveEnrollmentLedger, loadEnrollmentLedger } from '../src/services/edu-ledger.js'

/** 固定基准日:账期天数断言必须可复算,不得随运行日期漂移 */
const TODAY = '2026-11-13'

function seedEnrollment(enrollmentId: string, studentId: string, name: string, ledger: LedgerSeed) {
  state.enrollments.push({ enrollmentId, studentId, studentName: name })
  state.users.push({ id: studentId, phone: '13800000000', nickname: name })
  state.ledgers[enrollmentId] = ledger
}

/** 「账期 1 已缴清(到期日很早)+ 账期 2 未到期」—— 缺陷票里的原始场景 */
const PAID_HISTORY_THEN_UPCOMING: LedgerSeed = {
  totalFee: 1000,
  schedules: [
    { id: 'a', dueDate: '2025-12-01', graceDays: 0, amountDue: 500, status: 'active' },
    { id: 'b', dueDate: '2026-11-20', graceDays: 0, amountDue: 500, status: 'active' },
  ],
  payments: [{ id: 'p1', amount: 500, status: 'paid', scheduleId: 'a' }],
  refunds: [],
}

beforeEach(() => {
  state.enrollments = []
  state.reminders = []
  state.bindings = []
  state.users = []
  state.ledgers = {}
  state.seq = 0
  vi.clearAllMocks()
  vi.mocked(loadEnrollmentLedger).mockImplementation((async (enrollmentId: string) => {
    const seed = state.ledgers[enrollmentId]
    return seed ? deriveEnrollmentLedger({ ...seed, today: TODAY }) : null
  }) as never)
})

describe('F-317 催费文案的逾期口径', () => {
  it('① 已缴清历史账期(2025-12-01)不再把未到期欠费说成逾期', async () => {
    seedEnrollment('e1', 's1', '甲', PAID_HISTORY_THEN_UPCOMING)

    const r = await scanAndRemindArrears({ channels: [] })

    const msg = state.reminders[0]?.message ?? ''
    // 改前:文案为"已逾期 347 天未缴清",且不出现真实到期日
    expect(msg).not.toContain('逾期')
    expect(msg).not.toContain('2025-12-01')
    expect(msg).toContain('2026-11-20 到期')
    expect(r.overdueCount).toBe(0)
    // 未到期欠费落在 DUE_SOON_LEAD_DAYS=7 窗口内(11-20 距 11-13 恰 7 天)
    expect(r.dueSoonCount).toBe(1)
    expect(state.reminders[0]?.status).toBe('sent')
  })

  it('② 仅有未到期欠费且在提醒窗口内 ⇒ 到期提醒正常计数并发文', async () => {
    seedEnrollment('e2', 's2', '乙', {
      totalFee: 500,
      schedules: [
        { id: 'a', dueDate: '2026-11-18', graceDays: 0, amountDue: 500, status: 'active' },
      ],
      payments: [],
      refunds: [],
    })

    const r = await scanAndRemindArrears({ channels: [] })

    expect(r.overdueCount).toBe(0)
    expect(r.dueSoonCount).toBe(1)
    const msg = state.reminders[0]?.message ?? ''
    expect(msg).toContain('2026-11-18 到期')
    expect(msg).not.toContain('逾期')
  })

  it('③ 确有逾期账期时仍报该账期的真实天数(73 天)', async () => {
    seedEnrollment('e3', 's3', '丙', {
      totalFee: 1000,
      schedules: [
        { id: 'a', dueDate: '2026-09-01', graceDays: 0, amountDue: 500, status: 'active' },
        { id: 'b', dueDate: '2026-11-20', graceDays: 0, amountDue: 500, status: 'active' },
      ],
      payments: [],
      refunds: [],
    })

    const r = await scanAndRemindArrears({ channels: [] })

    expect(r.overdueCount).toBe(1)
    expect(state.reminders[0]?.message).toContain('已逾期 73 天未缴清')
  })
})

describe('F-317 账目出口逾期天数口径', () => {
  it('④ 已缴清账期的 overdueDays 归零,未逾期账期不为已结清期次背锅', () => {
    const ledger = deriveEnrollmentLedger({ ...PAID_HISTORY_THEN_UPCOMING, today: TODAY })
    const paid = ledger.schedules.find((s) => s.id === 'a')
    const upcoming = ledger.schedules.find((s) => s.id === 'b')

    // 改前:paid.overdueDays = 347,是催费文案"逾期 347 天"的唯一来源
    expect(paid?.status).toBe('paid')
    expect(paid?.overdue).toBe(false)
    expect(paid?.overdueDays).toBe(0)
    expect(upcoming?.overdue).toBe(false)
    expect(upcoming?.overdueDays).toBe(0)
    expect(ledger.overdueCount).toBe(0)
    expect(ledger.dueSoonCount).toBe(1)
  })
})
