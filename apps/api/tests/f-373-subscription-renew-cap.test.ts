// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-373 回归锁(2026-11-13,P2):无额度套餐叠加有效期无上限,重复激活可无限延长。
 *
 * 病灶:激活时按「当前结束时间 + 一个周期」累加,缺少「同一套餐串行续期」判据,
 * 也没有累计上限 —— 同一无限套餐换 orderNo 反复激活即可无限延长有效期
 * (叠加 F-371 退款不回收后被放大)。
 *
 * 本文件锁:
 *   ① 未到期续费:从原到期日 max(now, endAt) 叠加一个周期,不是 now + 周期;
 *   ② 累计上限:到期不超过 now + 5 年,超限截断并告警;
 *   ③ 已顶到上限:重复激活幂等,不推进 endAt、不发 UPDATE;
 *   ④ 并发同 plan:行锁串行,每个订单各延长一个周期,不丢周期也不重复叠加;
 *   ⑤ 跨套餐:剩余时长 1:1 折算后顺延,旧套餐行不被覆盖;
 *   ⑥ 永久套餐(0 天)沿用哨兵语义,不参与截断;负数有效期直接拒绝;
 *   ⑦ 跨套餐同受累计上限约束。
 *
 * 只 mock db / @ihui/database / logger / subscription-window-service,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 测试桩:内存订阅表 + 捕获 update set 值 + 可注入 now。
 * lock 用于把 db.transaction 串行化(等价于真实的行锁语义)。
 */
const h = vi.hoisted(() => ({
  now: new Date('2026-11-13T00:00:00.000Z'),
  subs: [] as Array<{ id: string; planId: string | null; endAt: Date }>,
  updateSets: [] as Array<Record<string, unknown>>,
  createCalls: [] as Array<Record<string, unknown>>,
  createResult: null as null | { id: string; endAt: Date },
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  lock: Promise.resolve() as Promise<unknown>,
  forCalls: 0,
}))

vi.mock('../src/db/index.js', () => {
  /** 每次调用都取当前内存快照,等价于「锁行后读取最新提交值」。 */
  function selectChain() {
    const rows = h.subs.map((s) => ({ id: s.id, planId: s.planId, endAt: s.endAt }))
    const p: any = Promise.resolve(rows)
    p.from = () => p
    p.where = () => p
    p.orderBy = () => p
    p.limit = () => p
    p.for = () => {
      h.forCalls += 1
      return p
    }
    return p
  }

  /** 捕获 update set 值并落到内存表(模拟 UPDATE 提交)。 */
  function updateBuilder() {
    return {
      set(values: Record<string, unknown>) {
        h.updateSets.push(values)
        const endAt = values.endAt as Date
        for (const sub of h.subs) sub.endAt = endAt
        return { where: () => Promise.resolve(undefined) }
      },
    }
  }

  return {
    db: {
      select: selectChain,
      update: updateBuilder,
      insert: vi.fn(),
      transaction: (cb: (tx: unknown) => unknown) => {
        const run = h.lock.then(() =>
          cb({ select: selectChain, update: updateBuilder, insert: vi.fn() }),
        )
        h.lock = run.then(
          () => undefined,
          () => undefined,
        )
        return run
      },
    },
    dbRead: { select: selectChain },
    dbClient: {},
  }
})

vi.mock('@ihui/database', () => ({
  plans: {
    id: 'id',
    name: 'name',
    features: 'features',
    modelWhitelist: 'model_whitelist',
    validityDays: 'validity_days',
    dailyTokenLimit: 'daily_token_limit',
    weeklyTokenLimit: 'weekly_token_limit',
    monthlyTokenLimit: 'monthly_token_limit',
    billingGroupCode: 'billing_group_code',
    isActive: 'is_active',
    isForSale: 'is_for_sale',
  },
  orders: { id: 'id', userId: 'user_id', planId: 'plan_id', orderNo: 'order_no' },
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    tokenBalance: 'token_balance',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
  },
  tokenFlows: {
    id: 'id',
    userId: 'user_id',
    opType: 'op_type',
    quantity: 'quantity',
    balanceAfter: 'balance_after',
    remark: 'remark',
    relatedOrderNo: 'related_order_no',
  },
  userBillingGroups: { id: 'id', name: 'name', enabled: 'enabled' },
  apiSubscriptions: {
    id: 'id',
    userId: 'user_id',
    planId: 'plan_id',
    status: 'status',
    startAt: 'start_at',
    endAt: 'end_at',
  },
}))

vi.mock('../src/services/subscription-window-service.js', () => ({
  createSubscriptionForOrder: vi.fn(async (input: Record<string, unknown>) => {
    h.createCalls.push(input)
    return h.createResult
  }),
  getSubscriptionWindowView: vi.fn(async () => ({ subscription: null, windows: [] })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: h.warn, error: h.error, info: h.info, debug: vi.fn() },
}))

import {
  MAX_SUBSCRIPTION_DAYS,
  MAX_SUBSCRIPTION_YEARS,
  computeRenewalPeriod,
  extendApiSubscriptionPeriod,
} from '../src/services/api-subscription-service.js'

type RenewalInput = Parameters<typeof extendApiSubscriptionPeriod>[0]

/** 续费入参基线(未配置项集中在这里,用例只覆盖差异)。 */
function baseInput(overrides: Partial<RenewalInput> = {}): RenewalInput {
  return {
    userId: 'user-f373',
    planId: 'plan-pro',
    planName: 'API Pro',
    validityDays: 30,
    dailyTokenLimit: 0,
    weeklyTokenLimit: 0,
    monthlyTokenLimit: 200000,
    now: h.now,
    ...overrides,
  }
}

describe('F-373 订阅续期:max(now, 到期日) + 累计上限', () => {
  beforeEach(() => {
    h.now = new Date('2026-11-13T00:00:00.000Z')
    h.subs.length = 0
    h.updateSets.length = 0
    h.createCalls.length = 0
    h.createResult = null
    h.warn.mockClear()
    h.error.mockClear()
    h.info.mockClear()
    h.lock = Promise.resolve()
    h.forCalls = 0
  })

  it('① 未到期续费:从原到期日叠加一个周期,不是 now + 周期', async () => {
    const currentEndAt = new Date('2026-12-01T00:00:00.000Z')
    h.subs.push({ id: 'sub-1', planId: 'plan-pro', endAt: currentEndAt })

    const period = computeRenewalPeriod({ now: h.now, validityDays: 30, currentEndAt })
    expect(period.startAt.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(period.endAt.toISOString()).toBe('2026-12-31T00:00:00.000Z')

    const result = await extendApiSubscriptionPeriod(baseInput())
    expect(result.ok).toBe(true)
    expect(result.truncated).toBe(false)
    expect(h.updateSets).toHaveLength(1)
    expect((h.updateSets[0]!.endAt as Date).toISOString()).toBe('2026-12-31T00:00:00.000Z')
    // 不是 now(2026-11-13)+ 30 天
    expect(h.updateSets[0]!.endAt).not.toEqual(new Date('2026-12-13T00:00:00.000Z'))
    expect(h.subs[0]!.endAt.toISOString()).toBe('2026-12-31T00:00:00.000Z')
    expect(h.warn).not.toHaveBeenCalled()
    expect(h.createCalls).toHaveLength(0)
  })

  it('② 累计上限:超过 now + 5 年即截断并告警', async () => {
    const capAt = new Date(h.now.getTime() + MAX_SUBSCRIPTION_DAYS * DAY_MS)
    h.subs.push({
      id: 'sub-1',
      planId: 'plan-pro',
      endAt: new Date(h.now.getTime() + 1700 * DAY_MS),
    })

    const result = await extendApiSubscriptionPeriod(baseInput({ validityDays: 365 }))

    expect(MAX_SUBSCRIPTION_YEARS).toBe(5)
    expect(result.ok).toBe(true)
    expect(result.truncated).toBe(true)
    expect(result.endAt!.toISOString()).toBe(capAt.toISOString())
    expect((h.updateSets[0]!.endAt as Date).toISOString()).toBe(capAt.toISOString())
    expect(h.warn).toHaveBeenCalledTimes(1)
    expect(h.warn.mock.calls[0]![1]).toMatchObject({ capDays: MAX_SUBSCRIPTION_DAYS })
  })

  it('③ 已顶到上限:重复激活幂等,不推进 endAt 也不发 UPDATE', async () => {
    const capAt = new Date(h.now.getTime() + MAX_SUBSCRIPTION_DAYS * DAY_MS)
    h.subs.push({ id: 'sub-1', planId: 'plan-pro', endAt: capAt })

    const result = await extendApiSubscriptionPeriod(baseInput())

    expect(result.ok).toBe(true)
    expect(result.truncated).toBe(true)
    expect(result.endAt!.toISOString()).toBe(capAt.toISOString())
    expect(h.updateSets).toHaveLength(0)
    expect(h.subs[0]!.endAt.toISOString()).toBe(capAt.toISOString())
  })

  it('④ 并发同 plan:行锁串行,两个订单各延长一个周期', async () => {
    h.subs.push({
      id: 'sub-1',
      planId: 'plan-pro',
      endAt: new Date('2026-12-01T00:00:00.000Z'),
    })

    const [a, b] = await Promise.all([
      extendApiSubscriptionPeriod(baseInput({ orderNo: 'order-a' })),
      extendApiSubscriptionPeriod(baseInput({ orderNo: 'order-b' })),
    ])

    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(h.forCalls).toBe(2) // 两次续期都先锁行
    expect(h.updateSets).toHaveLength(2)
    expect((h.updateSets[0]!.endAt as Date).toISOString()).toBe('2026-12-31T00:00:00.000Z')
    expect((h.updateSets[1]!.endAt as Date).toISOString()).toBe('2027-01-30T00:00:00.000Z')
    expect(h.subs[0]!.endAt.toISOString()).toBe('2027-01-30T00:00:00.000Z')
  })

  it('⑤ 跨套餐:剩余时长 1:1 折算后顺延,旧套餐行不被覆盖', async () => {
    const oldEndAt = new Date(h.now.getTime() + 10 * DAY_MS)
    h.subs.push({ id: 'sub-old', planId: 'plan-basic', endAt: oldEndAt })
    h.createResult = { id: 'sub-new', endAt: new Date(oldEndAt.getTime() + 30 * DAY_MS) }

    const result = await extendApiSubscriptionPeriod(baseInput({ planId: 'plan-pro' }))

    expect(result.ok).toBe(true)
    expect(result.subscriptionId).toBe('sub-new')
    expect(h.updateSets).toHaveLength(0)
    expect(h.createCalls).toHaveLength(1)
    expect(h.createCalls[0]!.validityDays).toBe(30)
    expect((h.createCalls[0]!.now as Date).toISOString()).toBe(oldEndAt.toISOString())
  })

  it('⑥ 永久套餐(0 天)不参与截断;负数有效期直接拒绝', async () => {
    h.subs.push({
      id: 'sub-1',
      planId: 'plan-pro',
      endAt: new Date(h.now.getTime() + 10 * DAY_MS),
    })

    const permanent = await extendApiSubscriptionPeriod(baseInput({ validityDays: 0 }))
    expect(permanent.ok).toBe(true)
    expect(permanent.truncated).toBe(false)
    expect(permanent.endAt!.toISOString()).toBe(
      new Date('9999-12-31T23:59:59.999Z').toISOString(),
    )
    expect(h.warn).not.toHaveBeenCalled()

    h.updateSets.length = 0
    const invalid = await extendApiSubscriptionPeriod(baseInput({ validityDays: -5 }))
    expect(invalid.ok).toBe(false)
    expect(invalid.reason).toBe('invalid_validity')
    expect(h.updateSets).toHaveLength(0)
  })

  it('⑦ 跨套餐同受累计上限约束:折算天数截断到 now + 5 年', async () => {
    h.subs.push({
      id: 'sub-old',
      planId: 'plan-basic',
      endAt: new Date(h.now.getTime() + 1800 * DAY_MS),
    })
    h.createResult = {
      id: 'sub-new',
      endAt: new Date(h.now.getTime() + MAX_SUBSCRIPTION_DAYS * DAY_MS),
    }

    const result = await extendApiSubscriptionPeriod(
      baseInput({ planId: 'plan-pro', validityDays: 365 }),
    )

    expect(result.ok).toBe(true)
    expect(result.truncated).toBe(true)
    // 剩余可用 1825 - 1800 = 25 天
    expect(h.createCalls[0]!.validityDays).toBe(25)
    expect(h.warn).toHaveBeenCalledTimes(1)
  })
})
