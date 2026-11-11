// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * SDB-03:`validityDays = 0`(文档语义「不过期」)曾被静默改成 30 天。
 *
 * 唯一判据在 createSubscriptionForOrder(服务层),本用例锁住四条边界:
 * - 显式 0            → 永久(end_at 为 NOT NULL,用 9999-12-31 哨兵值表达)
 * - undefined / null  → 既有默认 30 天
 * - 1..3650           → 按天数顺延(含续费叠加)
 * - 负数 / 非有限值    → 拒绝创建,不再回退成 30 天
 *
 * 测试模式:vi.mock 掉 db / @ihui/database,不连真实库。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const holder = vi.hoisted(() => ({
  /** 「当前活跃订阅 end_at」查询的返回行(续费顺延基准) */
  currentRows: [] as unknown[],
  insertCalls: 0,
  inserted: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => {
  // 链式查询 mock:select().from().where().orderBy().limit() 每步返回自身
  const chain = (value: unknown) => {
    const p = Promise.resolve(value) as unknown as Record<string, unknown>
    p.from = vi.fn(() => p)
    p.where = vi.fn(() => p)
    p.orderBy = vi.fn(() => p)
    p.limit = vi.fn(() => p)
    return p
  }
  return {
    db: {
      insert: vi.fn(() => ({
        values: (row: Record<string, unknown>) => ({
          returning: async () => {
            holder.insertCalls += 1
            holder.inserted.push(row)
            return [{ id: 'sub-1', ...row }]
          },
        }),
      })),
    },
    dbRead: { select: vi.fn(() => chain(holder.currentRows)) },
    dbClient: {},
  }
})

vi.mock('@ihui/database', () => ({
  apiSubscriptions: {
    id: 'id',
    userId: 'user_id',
    planId: 'plan_id',
    orderId: 'order_id',
    orderNo: 'order_no',
    planName: 'plan_name',
    status: 'status',
    startAt: 'start_at',
    endAt: 'end_at',
    dailyTokenLimit: 'daily_token_limit',
    weeklyTokenLimit: 'weekly_token_limit',
    monthlyTokenLimit: 'monthly_token_limit',
    autoRenew: 'auto_renew',
  },
  apiSubscriptionWindowUsage: {
    subscriptionId: 'subscription_id',
    userId: 'user_id',
    windowType: 'window_type',
    windowStart: 'window_start',
    windowEnd: 'window_end',
    tokensUsed: 'tokens_used',
    costUsedCents: 'cost_used_cents',
    updatedAt: 'updated_at',
  },
}))

import {
  createSubscriptionForOrder,
  type CreateSubscriptionInput,
} from '../src/services/subscription-window-service.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-11T00:00:00.000Z')
const PERMANENT_ISO = '9999-12-31T23:59:59.999Z'

function baseInput(extra: Partial<CreateSubscriptionInput> = {}): CreateSubscriptionInput {
  return {
    userId: 'user-1',
    planId: 'plan-1',
    planName: 'API Pro',
    dailyTokenLimit: 200_000,
    weeklyTokenLimit: 0,
    monthlyTokenLimit: 0,
    now: NOW,
    ...extra,
  }
}

/** 取本用例唯一一次插入的 end_at。 */
function insertedEndAt(): Date {
  expect(holder.inserted).toHaveLength(1)
  return holder.inserted[0]!.endAt as Date
}

describe('SDB-03 validityDays = 0 表示不过期', () => {
  beforeEach(() => {
    holder.currentRows = []
    holder.insertCalls = 0
    holder.inserted = []
  })

  it('显式 0 ⇒ 永不过期(写 9999-12-31 哨兵,而非 30 天)', async () => {
    const sub = await createSubscriptionForOrder(baseInput({ validityDays: 0 }))

    expect(sub).not.toBeNull()
    expect(holder.insertCalls).toBe(1)
    const endAt = insertedEndAt()
    expect(endAt.toISOString()).toBe(PERMANENT_ISO)
    // 若回归成 30 天,下式必然失败
    expect(endAt.getTime() - NOW.getTime()).toBeGreaterThan(3650 * DAY_MS)
  })

  it('未提供(undefined)⇒ 既有默认 30 天不变', async () => {
    await createSubscriptionForOrder(baseInput())
    expect(insertedEndAt().getTime() - NOW.getTime()).toBe(30 * DAY_MS)
  })

  it('null 视同未提供 ⇒ 30 天', async () => {
    await createSubscriptionForOrder(baseInput({ validityDays: null }))
    expect(insertedEndAt().getTime() - NOW.getTime()).toBe(30 * DAY_MS)
  })

  it('7 ⇒ 7 天,且续费顺延基准不变', async () => {
    const currentEndAt = new Date(NOW.getTime() + 10 * DAY_MS)
    holder.currentRows = [{ endAt: currentEndAt }]

    await createSubscriptionForOrder(baseInput({ validityDays: 7 }))

    expect(holder.inserted).toHaveLength(1)
    const row = holder.inserted[0]!
    expect((row.startAt as Date).toISOString()).toBe(currentEndAt.toISOString())
    expect((row.endAt as Date).getTime() - currentEndAt.getTime()).toBe(7 * DAY_MS)
  })

  it('已有永久订阅时续费不再算出 10000 年,收敛回哨兵', async () => {
    holder.currentRows = [{ endAt: new Date(PERMANENT_ISO) }]

    await createSubscriptionForOrder(baseInput({ validityDays: 7 }))

    const row = holder.inserted[0]!
    expect((row.startAt as Date).toISOString()).toBe(PERMANENT_ISO)
    expect((row.endAt as Date).toISOString()).toBe(PERMANENT_ISO)
  })

  it.each([-1, -30, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '非法值 %s ⇒ 拒绝创建,不回退成 30 天',
    async (invalid) => {
      const sub = await createSubscriptionForOrder(baseInput({ validityDays: invalid }))
      expect(sub).toBeNull()
      expect(holder.insertCalls).toBe(0)
    },
  )
})
