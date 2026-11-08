// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-583 + F-584 回归锁(数字对照):
 *  - F-583:配置 `EDU_ARREAR_REMIND_CHANNELS=sms` 时不得再外发微信。
 *    改前:2 报名 × 2 收件人 = 4 条微信 + 4 条短信(计费外发 8 条)；改后:仅 4 条短信。
 *  - F-584:留痕先 pending、按实际送达落 sent/failed,去重只认 sent。
 *    改前:首轮全失败仍记为可去重,同日补跑 `skippedToday=3`、重试覆盖 0 元欠费；
 *    改后:首轮落 failed,同日补跑重试 3 条、覆盖欠费 100+200+300 = 600 元。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  arrears: {} as Record<string, number>,
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
  events: [] as string[],
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

  const selectRows = (table: unknown, fields: Record<string, unknown>, cond: unknown) => {
    const name = tableName(table)
    const keys = Object.keys(fields)
    state.events.push(`select:${name}`)
    const q = render(cond)
    const params = q.params.map((p) => String(p))

    if (name === 'edu_enrollment') return state.enrollments.map((e) => ({ ...e }))
    if (name === 'edu_fee_reminder') {
      // 去重查询:字段={enrollmentId}。按渲染出的 WHERE 判断是否带 status='sent'。
      // 改前没有该条件 ⇒ 返回当日全部行(失败行也挡重放),用例据此变红。
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
    // 其它表(班期等)本轮不涉及
    if (keys.length === 0) return []
    return []
  }

  const select = (fields: Record<string, unknown>) => {
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
        Promise.resolve(selectRows(table, fields, cond)).then(res, rej),
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
        Promise.resolve().then(() => {
          const name = tableName(table)
          state.events.push(`insert:${name}`)
          if (name !== 'edu_fee_reminder') return []
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
        }).then(res, rej),
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
        Promise.resolve().then(() => {
          const name = tableName(table)
          state.events.push(`update:${name}`)
          const q = render(cond)
          const id = String(q.params[0] ?? '')
          const row = state.reminders.find((r) => r.id === id)
          if (row) Object.assign(row, set)
          return undefined
        }).then(res, rej),
    }
    return b
  }

  return { db: { select, insert, update, execute: async () => [] } }
})

vi.mock('../src/db/notification-queries.js', () => ({ createNotification: vi.fn() }))

vi.mock('../src/services/edu-ledger.js', () => ({
  DUE_SOON_LEAD_DAYS: 7,
  hasArrearsCond: () => ({ __arrears: true }),
  loadEnrollmentLedger: vi.fn(),
}))

vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => true),
  getWechatMiniOpenId: vi.fn(async (id: string) => `openid-${id}`),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../src/services/sms.js', () => ({
  isArrearSmsConfigured: vi.fn(() => true),
  sendArrearSms: vi.fn(async () => ({ success: true })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { scanAndRemindArrears } from '../src/services/edu-arrear-remind-service.js'
import { createNotification } from '../src/db/notification-queries.js'
import {
  isSubscribeMessageConfigured,
  sendSubscribeMessage,
} from '../src/services/wechat-subscribe-message.js'
import { isArrearSmsConfigured, sendArrearSms } from '../src/services/sms.js'
import { loadEnrollmentLedger } from '../src/services/edu-ledger.js'

function seedEnrollment(
  enrollmentId: string,
  studentId: string,
  name: string,
  arrears: number,
  opts?: { parentId?: string },
) {
  state.enrollments.push({ enrollmentId, studentId, studentName: name })
  state.arrears[enrollmentId] = arrears
  state.users.push({ id: studentId, phone: '13800000000', nickname: name })
  if (opts?.parentId) {
    state.bindings.push({ studentId, parentId: opts.parentId })
    state.users.push({ id: opts.parentId, phone: '13900000000', nickname: `${name}家长` })
  }
}

beforeEach(() => {
  state.arrears = {}
  state.enrollments = []
  state.reminders = []
  state.bindings = []
  state.users = []
  state.events = []
  state.seq = 0
  vi.clearAllMocks()
  vi.mocked(isSubscribeMessageConfigured).mockReturnValue(true)
  vi.mocked(sendSubscribeMessage).mockResolvedValue({ ok: true })
  vi.mocked(isArrearSmsConfigured).mockReturnValue(true)
  vi.mocked(sendArrearSms).mockResolvedValue({ success: true })
  vi.mocked(createNotification).mockResolvedValue(undefined as never)
  vi.mocked(loadEnrollmentLedger).mockImplementation((async (enrollmentId: string) => ({
    arrears: state.arrears[enrollmentId] ?? 0,
    schedules: [{ overdueDays: 3 }],
    dueSoonCount: 0,
    nextDueDate: null,
  })) as never)
})

describe('F-583 渠道开关', () => {
  it('channels=[sms] 时微信外发条数 = 0（改前 4 条）', async () => {
    seedEnrollment('e1', 's1', '甲', 100, { parentId: 'p1' })
    seedEnrollment('e2', 's2', '乙', 200, { parentId: 'p2' })

    const r = await scanAndRemindArrears({ channels: ['sms'] })

    // 收件人 = 2 报名 ×（学员+家长）= 4 人。改前会发 4 条微信（计费敞口），改后 0 条。
    expect(sendSubscribeMessage).toHaveBeenCalledTimes(0)
    expect(r.wxSent).toBe(0)
    // 计费短信仍按配置发 4 条
    expect(r.smsSent).toBe(4)
    expect(sendArrearSms).toHaveBeenCalledTimes(4)
  })
})

describe('F-584 失败当日可重放（金额口径）', () => {
  it('全通道失败：同日补跑覆盖欠费 600 元（改前 0 元）', async () => {
    seedEnrollment('e1', 's1', '甲', 100)
    seedEnrollment('e2', 's2', '乙', 200)
    seedEnrollment('e3', 's3', '丙', 300)
    // 微信未配置、站内信写库失败 ⇒ 首轮零送达
    vi.mocked(isSubscribeMessageConfigured).mockReturnValue(false)
    vi.mocked(createNotification).mockRejectedValue(new Error('通知库不可用'))

    const first = await scanAndRemindArrears({ channels: ['wechat'] })
    expect(first.reminded).toBe(3)
    expect(state.reminders.map((r) => r.status)).toEqual(['failed', 'failed', 'failed'])

    // 同日下午补跑(通知库恢复)
    vi.mocked(createNotification).mockResolvedValue(undefined as never)
    const before = state.reminders.length
    const second = await scanAndRemindArrears({ channels: ['wechat'] })

    // 改前:failed 行也占当日去重 ⇒ skippedToday=3、重试 0 条、覆盖 0 元
    expect(second.skippedToday).toBe(0)
    expect(second.reminded).toBe(3)
    const retried = state.reminders.slice(before)
    expect(retried.map((r) => r.dueAmount).reduce((a, b) => a + b, 0)).toBe(600)
    expect(retried.map((r) => r.status)).toEqual(['sent', 'sent', 'sent'])
  })

  it('微信送达时 channel=wechat（改前恒 in_app）', async () => {
    seedEnrollment('e1', 's1', '甲', 100)
    vi.mocked(createNotification).mockRejectedValue(new Error('通知库不可用'))

    const r = await scanAndRemindArrears({ channels: ['wechat'] })

    expect(r.wxSent).toBe(1)
    expect(state.reminders[0]?.status).toBe('sent')
    expect(state.reminders[0]?.channel).toBe('wechat')
  })

  it('仅短信送达时 channel=sms（改前恒 in_app）', async () => {
    seedEnrollment('e1', 's1', '甲', 100)
    vi.mocked(createNotification).mockRejectedValue(new Error('通知库不可用'))

    const r = await scanAndRemindArrears({ channels: ['sms'] })

    expect(sendSubscribeMessage).toHaveBeenCalledTimes(0)
    expect(r.smsSent).toBe(1)
    expect(state.reminders[0]?.status).toBe('sent')
    expect(state.reminders[0]?.channel).toBe('sms')
  })

  it('仅站内信送达时 channel=in_app、status=sent', async () => {
    seedEnrollment('e1', 's1', '甲', 100)

    const r = await scanAndRemindArrears({ channels: [] })

    expect(sendSubscribeMessage).toHaveBeenCalledTimes(0)
    expect(sendArrearSms).toHaveBeenCalledTimes(0)
    expect(r.reminded).toBe(1)
    expect(state.reminders[0]?.status).toBe('sent')
    expect(state.reminders[0]?.channel).toBe('in_app')
  })

  it('当日已有 sent 行 ⇒ skippedToday=1，不再插新行（重放幂等）', async () => {
    seedEnrollment('e1', 's1', '甲', 100)
    state.reminders.push({
      id: 'seed',
      enrollmentId: 'e1',
      studentId: 's1',
      status: 'sent',
      channel: 'in_app',
      dueAmount: 100,
      message: null,
      delivery: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const r = await scanAndRemindArrears({ channels: [] })

    expect(r.skippedToday).toBe(1)
    expect(state.reminders.length).toBe(1)
  })

  it('当日 pending 行不占去重名额（改前会被拦下）', async () => {
    seedEnrollment('e1', 's1', '甲', 100)
    state.reminders.push({
      id: 'seed',
      enrollmentId: 'e1',
      studentId: 's1',
      status: 'pending',
      channel: 'in_app',
      dueAmount: 100,
      message: null,
      delivery: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const r = await scanAndRemindArrears({ channels: [] })

    expect(r.skippedToday).toBe(0)
    expect(state.reminders.length).toBe(2)
    expect(state.reminders[1]?.status).toBe('sent')
  })
})
