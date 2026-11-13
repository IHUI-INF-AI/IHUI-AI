// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-374 回归锁(2026-11-13,P2):subEndAt 缺失被写成 expiresAt:null,折扣变永久。
 *
 * 病灶:套餐只绑计费分组、未配窗口限额时,激活流程拿不到 subEndAt(undefined),
 * assignUserToGroup 把它落成 expiresAt=null;折扣判定又把 null 当「永久有效」,
 * 于是缺周期的一次误配 = 永久折扣,且没有到期回收路径。
 *
 * 本文件锁四条:
 *   ① 缺周期(非法有效期)⇒ 拒绝入组,不写任何成员关系,更不写 null;
 *   ② 显式永久(0 天)⇒ 写入既有 9999 哨兵(非 null),语义与订阅实例一致;
 *   ③ 正常有周期 ⇒ 写入真实到期日,行为不变;
 *   ④ 折扣判定:null 不再按永久处理(回退默认组),只有明确未来到期日才生效。
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / logger / subscription-window-service,
 * 用内存桩捕获写入值,不连接真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000

const h = vi.hoisted(() => ({
  planRows: [] as Array<Record<string, unknown>>,
  keyRows: [] as Array<Record<string, unknown>>,
  memberRows: [] as Array<Record<string, unknown>>,
  /** user_billing_groups 查询结果队列(按调用顺序:组成员组 → 默认组) */
  groupQueue: [] as Array<Array<Record<string, unknown>>>,
  /** 捕获 insert().values() 的落库值 */
  insertValues: [] as Array<Record<string, unknown>>,
  /** 捕获 upsert 的 set 值 */
  upsertSets: [] as Array<Record<string, unknown>>,
  updateSets: [] as Array<Record<string, unknown>>,
  warn: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  /** 按表名返回内存桩数据(drizzle 的 where/orderBy 在本桩里不参与求值)。 */
  function resolveRows(table: string | undefined): Array<Record<string, unknown>> {
    switch (table) {
      case 'plans':
        return h.planRows
      case 'developer_api_keys':
        return h.keyRows
      case 'user_billing_group_members':
        return h.memberRows
      case 'user_billing_groups':
        return h.groupQueue.shift() ?? []
      default:
        return []
    }
  }

  /** 链式查询桩:.from().where().orderBy().limit().for() 任意组合均可 await。 */
  function selectChain() {
    let table: string | undefined
    const p: any = {}
    p.from = (t: { __t?: string }) => {
      table = t?.__t
      return p
    }
    p.where = () => p
    p.orderBy = () => p
    p.leftJoin = () => p
    p.groupBy = () => p
    p.limit = () => p
    p.for = () => p
    p.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(resolveRows(table)).then(onFulfilled, onRejected)
    return p
  }

  /** insert 桩:捕获 values 与 onConflictDoUpdate.set。 */
  function insertBuilder() {
    return {
      values(values: Record<string, unknown>) {
        h.insertValues.push(values)
        return {
          onConflictDoUpdate(cfg: { set?: Record<string, unknown> }) {
            if (cfg?.set) h.upsertSets.push(cfg.set)
            return Promise.resolve(undefined)
          },
          returning() {
            return Promise.resolve([values])
          },
          then(onFulfilled: any, onRejected: any) {
            return Promise.resolve(values).then(onFulfilled, onRejected)
          },
        }
      },
    }
  }

  /** update 桩:捕获 set。 */
  function updateBuilder() {
    return {
      set(values: Record<string, unknown>) {
        h.updateSets.push(values)
        return { where: () => Promise.resolve(undefined) }
      },
    }
  }

  const tx = {
    select: selectChain,
    insert: insertBuilder,
    update: updateBuilder,
  }

  return {
    db: {
      select: selectChain,
      insert: insertBuilder,
      update: updateBuilder,
      transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
    },
    dbRead: { select: selectChain },
    dbClient: {},
  }
})

vi.mock('@ihui/database', () => ({
  plans: {
    id: 'id',
    name: 'name',
    description: 'description',
    price: 'price',
    interval: 'interval',
    features: 'features',
    modelWhitelist: 'model_whitelist',
    validityDays: 'validity_days',
    dailyTokenLimit: 'daily_token_limit',
    weeklyTokenLimit: 'weekly_token_limit',
    monthlyTokenLimit: 'monthly_token_limit',
    billingGroupCode: 'billing_group_code',
    sortOrder: 'sort_order',
    billingPeriod: 'billing_period',
    isActive: 'is_active',
    isForSale: 'is_for_sale',
    __t: 'plans',
  },
  orders: {
    id: 'id',
    orderNo: 'order_no',
    userId: 'user_id',
    planId: 'plan_id',
    amount: 'amount',
    paidAt: 'paid_at',
    status: 'status',
    orderType: 'order_type',
    createdAt: 'created_at',
    __t: 'orders',
  },
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    tokenBalance: 'token_balance',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
    name: 'name',
    key: 'key',
    secret: 'secret',
    permissions: 'permissions',
    rateLimit: 'rate_limit',
    allowedModels: 'allowed_models',
    updatedAt: 'updated_at',
    __t: 'developer_api_keys',
  },
  tokenFlows: {
    id: 'id',
    userId: 'user_id',
    opType: 'op_type',
    quantity: 'quantity',
    balanceAfter: 'balance_after',
    remark: 'remark',
    relatedOrderNo: 'related_order_no',
    __t: 'token_flows',
  },
  userBillingGroups: {
    id: 'id',
    name: 'name',
    enabled: 'enabled',
    isDefault: 'is_default',
    defaultMultiplier: 'default_multiplier',
    rateLimitQpm: 'rate_limit_qpm',
    __t: 'user_billing_groups',
  },
  userBillingGroupMembers: {
    id: 'id',
    userId: 'user_id',
    groupId: 'group_id',
    assignedReason: 'assigned_reason',
    assignedAt: 'assigned_at',
    expiresAt: 'expires_at',
    __t: 'user_billing_group_members',
  },
  userBillingGroupModelMultipliers: {
    groupId: 'group_id',
    modelId: 'model_id',
    multiplier: 'multiplier',
    __t: 'user_billing_group_model_multipliers',
  },
  apiSubscriptions: {
    id: 'id',
    userId: 'user_id',
    planId: 'plan_id',
    status: 'status',
    startAt: 'start_at',
    endAt: 'end_at',
    __t: 'api_subscriptions',
  },
}))

vi.mock('../src/services/subscription-window-service.js', () => ({
  createSubscriptionForOrder: vi.fn(async () => null),
  getSubscriptionWindowView: vi.fn(async () => ({ subscription: null, windows: [] })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: h.warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { activateApiSubscription } from '../src/services/api-subscription-service.js'
import {
  assignUserToGroup,
  getUserBillingGroup,
} from '../src/services/user-billing-group-service.js'

/** 「永久」哨兵,必须与 subscription-window-service 的 PERMANENT_END_AT 一致。 */
const PERMANENT_END_AT = new Date('9999-12-31T23:59:59.999Z')

/** 套餐基线:仅绑定计费分组,不配窗口限额(即触发 F-374 的那条路径)。 */
function basePlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'plan-vip',
    name: 'API 分组套餐',
    features: [],
    validityDays: 30,
    dailyTokenLimit: 0,
    weeklyTokenLimit: 0,
    monthlyTokenLimit: 0,
    modelWhitelist: null,
    billingGroupCode: 'vip',
    ...overrides,
  }
}

describe('F-374 缺失周期不得冒充永久', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.planRows.length = 0
    h.keyRows.length = 0
    h.memberRows.length = 0
    h.groupQueue.length = 0
    h.insertValues.length = 0
    h.upsertSets.length = 0
    h.updateSets.length = 0
  })

  it('① 缺周期(非法有效期)→ 拒绝入组,绝不写 expiresAt:null', async () => {
    h.planRows.push(basePlan({ validityDays: -1 }))
    h.keyRows.push({ id: 'key-1', tokenBalance: 1000 })
    h.groupQueue.push([{ id: 'group-vip' }])

    const result = await activateApiSubscription('user-f374-1', 'plan-vip')

    // 配额照常发放(钱已付),但折扣权益拒绝授予
    expect(result.success).toBe(true)
    expect(h.insertValues).toHaveLength(0)
    expect(h.upsertSets).toHaveLength(0)
    expect(h.warn).toHaveBeenCalledWith(
      '[api-subscription] 套餐缺少有效订阅周期,拒绝写入计费分组',
      expect.objectContaining({ reason: 'missing_period', groupName: 'vip' }),
    )
  })

  it('② 显式永久(0 天)→ 写入 9999 哨兵,不是 null', async () => {
    h.planRows.push(basePlan({ validityDays: 0 }))
    h.keyRows.push({ id: 'key-1', tokenBalance: 1000 })
    h.groupQueue.push([{ id: 'group-vip' }])

    const result = await activateApiSubscription('user-f374-2', 'plan-vip')

    expect(result.success).toBe(true)
    expect(h.insertValues).toHaveLength(1)
    const written = h.insertValues[0]!
    expect(written.assignedReason).toBe('subscription')
    expect(written.expiresAt).not.toBeNull()
    expect((written.expiresAt as Date).toISOString()).toBe(PERMANENT_END_AT.toISOString())
    // upsert 分支同样不得回退成 null
    expect(h.upsertSets[0]!.expiresAt).not.toBeNull()
    expect((h.upsertSets[0]!.expiresAt as Date).toISOString()).toBe(PERMANENT_END_AT.toISOString())
  })

  it('③ 正常有周期(30 天)→ 写真实到期日,行为不变', async () => {
    h.planRows.push(basePlan({ validityDays: 30 }))
    h.keyRows.push({ id: 'key-1', tokenBalance: 1000 })
    h.groupQueue.push([{ id: 'group-vip' }])

    const before = Date.now()
    const result = await activateApiSubscription('user-f374-3', 'plan-vip')
    const after = Date.now()

    expect(result.success).toBe(true)
    expect(h.insertValues).toHaveLength(1)
    const expiresAt = h.insertValues[0]!.expiresAt as Date
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS)
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 30 * DAY_MS)
  })

  it('③-2 有效期未配置 → 沿用既有 30 天默认,不是 null', async () => {
    h.planRows.push(basePlan({ validityDays: undefined }))
    h.keyRows.push({ id: 'key-1', tokenBalance: 1000 })
    h.groupQueue.push([{ id: 'group-vip' }])

    const before = Date.now()
    await activateApiSubscription('user-f374-4', 'plan-vip')
    const after = Date.now()

    const expiresAt = h.insertValues[0]!.expiresAt as Date
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS)
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 30 * DAY_MS)
  })

  it('④ subscription 入组缺 expiresAt → 直接拒绝,不发 insert', async () => {
    await expect(assignUserToGroup('user-f374-5', 'group-vip', 'subscription')).rejects.toThrow(
      /expiresAt/,
    )
    await expect(
      assignUserToGroup('user-f374-5', 'group-vip', 'subscription', null),
    ).rejects.toThrow(/expiresAt/)
    expect(h.insertValues).toHaveLength(0)
    expect(h.upsertSets).toHaveLength(0)
  })

  it('⑤ subscription 入组带明确日期 → 原值写入(insert 与 upsert 一致)', async () => {
    const endAt = new Date('2026-12-31T00:00:00.000Z')

    await assignUserToGroup('user-f374-6', 'group-vip', 'subscription', endAt)

    expect(h.insertValues).toHaveLength(1)
    expect(h.insertValues[0]!.expiresAt).toBe(endAt)
    expect(h.upsertSets).toHaveLength(1)
    expect(h.upsertSets[0]!.expiresAt).toBe(endAt)
  })

  it('⑥ 非订阅入组(manual)保持既有语义:允许 null', async () => {
    await assignUserToGroup('user-f374-7', 'group-vip', 'manual')
    expect(h.insertValues[0]!.expiresAt).toBeNull()
  })

  it('⑦ 折扣判定:expiresAt=null → 不按永久,回退默认组', async () => {
    h.memberRows.push({ groupId: 'group-vip', expiresAt: null })
    h.groupQueue.push([{ id: 'group-default', isDefault: true, enabled: true }])

    const group = await getUserBillingGroup('user-f374-8')

    expect(group?.id).toBe('group-default')
  })

  it('⑧ 折扣判定:明确未来到期日 → 仍按订阅组生效', async () => {
    h.memberRows.push({ groupId: 'group-vip', expiresAt: new Date(Date.now() + DAY_MS) })
    h.groupQueue.push([{ id: 'group-vip', enabled: true }])

    const group = await getUserBillingGroup('user-f374-9')

    expect(group?.id).toBe('group-vip')
  })

  it('⑨ 折扣判定:已过期 → 回退默认组', async () => {
    h.memberRows.push({ groupId: 'group-vip', expiresAt: new Date(Date.now() - DAY_MS) })
    h.groupQueue.push([{ id: 'group-default', isDefault: true, enabled: true }])

    const group = await getUserBillingGroup('user-f374-10')

    expect(group?.id).toBe('group-default')
  })
})
