// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-375 回归锁(2026-11-13,P2):事务提交后的附属步骤无补偿,成功码下权益缺失。
 *
 * 病灶:activateApiSubscription 的 Key 授信 + 发放流水在主事务里提交,之后才调用
 * 订阅实例续期与计费分组入组;这两步跑在事务外,失败只打一行 warn 就照常返回成功,
 * 用户付了钱却拿不到窗口额度/折扣,而重放又被 token_flows 幂等挡掉,无法自愈。
 *
 * 本文件锁:
 *   ① 正常路径完全不变:不带 status/warnings/compensationEventId,不写补偿任务;
 *   ② 附属步骤抛错(入组失败)→ status='partial' + warning,并登记补偿任务(outbox);
 *   ③ 窗口实例创建抛错 → 同样 partial + 补偿,不再静默降级;
 *   ④ 补偿任务本身登记失败 → 追加 compensation_register_failed,仍是 partial,不吞错;
 *   ⑤ 配置类缺失(缺周期)只告警、不灌无效补偿任务,但也不得返回纯成功。
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / 下游附属服务,全部用内存桩,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000

const h = vi.hoisted(() => ({
  planRows: [] as Array<Record<string, unknown>>,
  keyRows: [] as Array<Record<string, unknown>>,
  groupRows: [] as Array<Record<string, unknown>>,
  subscriptionRows: [] as Array<Record<string, unknown>>,
  /** 捕获 outbox_events 的落库值(补偿任务) */
  outboxInserts: [] as Array<Record<string, unknown>>,
  /** true = 模拟 outbox 写库失败(补偿登记也失败的最坏情况) */
  outboxInsertFails: false,
  warn: vi.fn(),
  error: vi.fn(),
  assignUserToGroup: vi.fn(),
  createSubscriptionForOrder: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  /** 按表名返回内存桩数据(drizzle 的 where/orderBy 在本桩里不参与求值)。 */
  function resolveRows(table: string | undefined): Array<Record<string, unknown>> {
    switch (table) {
      case 'plans':
        return h.planRows
      case 'developer_api_keys':
        return h.keyRows
      case 'user_billing_groups':
        return h.groupRows
      case 'api_subscriptions':
        return h.subscriptionRows
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
    p.limit = () => p
    p.for = () => p
    p.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(resolveRows(table)).then(onFulfilled, onRejected)
    return p
  }

  /** insert 桩:只记录 outbox_events 的落库值,并按需模拟写失败。 */
  function insertBuilder(table: string | undefined) {
    return {
      values(values: Record<string, unknown>) {
        if (table === 'outbox_events') {
          if (h.outboxInsertFails) throw new Error('outbox unavailable')
          h.outboxInserts.push(values)
        }
        return {
          returning: () => Promise.resolve([{ id: 'outbox-1' }]),
          then: (onFulfilled: any, onRejected: any) =>
            Promise.resolve(values).then(onFulfilled, onRejected),
        }
      },
    }
  }

  function updateBuilder() {
    return { set: () => ({ where: () => Promise.resolve(undefined) }) }
  }

  const tx = {
    select: selectChain,
    insert: (t: { __t?: string }) => insertBuilder(t?.__t),
    update: updateBuilder,
  }

  return {
    db: {
      select: selectChain,
      insert: (t: { __t?: string }) => insertBuilder(t?.__t),
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
    features: 'features',
    modelWhitelist: 'model_whitelist',
    validityDays: 'validity_days',
    dailyTokenLimit: 'daily_token_limit',
    weeklyTokenLimit: 'weekly_token_limit',
    monthlyTokenLimit: 'monthly_token_limit',
    billingGroupCode: 'billing_group_code',
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
    __t: 'user_billing_groups',
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
  outboxEvents: {
    id: 'id',
    type: 'type',
    payload: 'payload',
    status: 'status',
    attempts: 'attempts',
    lastError: 'last_error',
    lastAttemptAt: 'last_attempt_at',
    createdAt: 'created_at',
    processedAt: 'processed_at',
    __t: 'outbox_events',
  },
}))

vi.mock('../src/services/subscription-window-service.js', () => ({
  createSubscriptionForOrder: h.createSubscriptionForOrder,
  getSubscriptionWindowView: vi.fn(async () => ({ subscription: null, windows: [] })),
}))

vi.mock('../src/services/user-billing-group-service.js', () => ({
  assignUserToGroup: h.assignUserToGroup,
  getUserBillingGroup: vi.fn(async () => null),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: h.warn, error: h.error, info: vi.fn(), debug: vi.fn() },
}))

import { activateApiSubscription } from '../src/services/api-subscription-service.js'

/** 套餐基线:默认只有 token 配额,附属步骤按用例逐项打开。 */
function planFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'plan-f375',
    name: 'API F375',
    features: ['5000 tokens/month'],
    modelWhitelist: null,
    validityDays: 30,
    dailyTokenLimit: 0,
    weeklyTokenLimit: 0,
    monthlyTokenLimit: 0,
    billingGroupCode: null,
    ...overrides,
  }
}

describe('F-375 事务提交后的附属步骤失败必须可观测且可补偿', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.planRows.length = 0
    h.keyRows.length = 0
    h.groupRows.length = 0
    h.subscriptionRows.length = 0
    h.outboxInserts.length = 0
    h.outboxInsertFails = false
    h.keyRows.push({ id: 'key-1', tokenBalance: 1000 })
    h.createSubscriptionForOrder.mockResolvedValue({
      id: 'sub-1',
      endAt: new Date(Date.now() + 30 * DAY_MS),
    })
    h.assignUserToGroup.mockResolvedValue(undefined)
  })

  it('① 正常路径:窗口实例 + 入组都成功 → 返回值结构不变,不登记补偿', async () => {
    h.planRows.push(planFixture({ dailyTokenLimit: 5000, billingGroupCode: 'vip' }))
    h.groupRows.push({ id: 'group-vip' })

    const result = await activateApiSubscription('user-f375-ok', 'plan-f375', 'order-f375-ok')

    expect(result.success).toBe(true)
    // 成功路径兼容:不新增 status/warnings/compensationEventId 字段
    expect(Object.keys(result).sort()).toEqual(['keyId', 'success', 'tokenQuota'])
    expect(h.outboxInserts).toHaveLength(0)
    expect(h.createSubscriptionForOrder).toHaveBeenCalledTimes(1)
    expect(h.assignUserToGroup).toHaveBeenCalledTimes(1)
    expect(h.error).not.toHaveBeenCalled()
  })

  it('② 入组抛错 → partial + 告警 + 补偿任务登记(不再是纯成功)', async () => {
    h.planRows.push(planFixture({ billingGroupCode: 'vip' }))
    h.groupRows.push({ id: 'group-vip' })
    h.assignUserToGroup.mockRejectedValueOnce(new Error('members write failed'))

    const result = await activateApiSubscription('user-f375-group', 'plan-f375', 'order-f375-group')

    // 主事务(配额)已提交,不能假装整单成功
    expect(result.success).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.warnings?.map((w) => w.code)).toContain('billing_group_assign_failed')
    expect(result.warnings?.[0]?.message).toContain('members write failed')
    expect(result.compensationEventId).toBe('outbox-1')

    expect(h.outboxInserts).toHaveLength(1)
    const event = h.outboxInserts[0]!
    expect(event.type).toBe('subscription.activation.compensation')
    expect(event.status).toBe('pending')
    expect(event.attempts).toBe(0)
    expect(event.payload).toEqual(
      expect.objectContaining({
        userId: 'user-f375-group',
        planId: 'plan-f375',
        orderNo: 'order-f375-group',
        keyId: 'key-1',
        warnings: [expect.objectContaining({ code: 'billing_group_assign_failed' })],
      }),
    )
    expect(h.error).toHaveBeenCalledWith(
      '[api-subscription] 订阅入组失败,已转入补偿',
      expect.objectContaining({ userId: 'user-f375-group', groupName: 'vip' }),
    )
  })

  it('③ 窗口订阅实例创建抛错 → partial + 补偿,不再静默降级为仅余额', async () => {
    h.planRows.push(planFixture({ dailyTokenLimit: 5000 }))
    h.createSubscriptionForOrder.mockRejectedValueOnce(new Error('window insert failed'))

    const result = await activateApiSubscription('user-f375-win', 'plan-f375', 'order-f375-win')

    expect(result.success).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.warnings?.map((w) => w.code)).toEqual(['subscription_window_failed'])
    expect(result.warnings?.[0]?.step).toBe('subscription_window')
    expect(result.compensationEventId).toBe('outbox-1')
    expect(h.outboxInserts).toHaveLength(1)
    expect(h.error).toHaveBeenCalledWith(
      '[api-subscription] 订阅实例创建/续期异常,已转入补偿',
      expect.objectContaining({ userId: 'user-f375-win' }),
    )
  })

  it('④ 补偿任务登记也失败 → 追加 compensation_register_failed,仍返回 partial 不吞错', async () => {
    h.planRows.push(planFixture({ billingGroupCode: 'vip' }))
    h.groupRows.push({ id: 'group-vip' })
    h.assignUserToGroup.mockRejectedValueOnce(new Error('members write failed'))
    h.outboxInsertFails = true

    const result = await activateApiSubscription('user-f375-outbox', 'plan-f375', 'order-f375-outbox')

    expect(result.success).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.compensationEventId).toBeNull()
    expect(result.warnings?.map((w) => w.code)).toEqual([
      'billing_group_assign_failed',
      'compensation_register_failed',
    ])
    expect(h.error).toHaveBeenCalledWith(
      '[api-subscription] 附属步骤失败且补偿任务登记失败,需人工核对',
      expect.objectContaining({ userId: 'user-f375-outbox' }),
    )
  })

  it('⑤ 配置类缺失(缺周期)→ 明确 partial,但不写永远无法成功的补偿任务', async () => {
    h.planRows.push(planFixture({ billingGroupCode: 'vip', validityDays: -1 }))
    h.groupRows.push({ id: 'group-vip' })

    const result = await activateApiSubscription('user-f375-cfg', 'plan-f375', 'order-f375-cfg')

    expect(result.success).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.warnings?.map((w) => w.code)).toEqual(['billing_group_missing_period'])
    expect(result.compensationEventId).toBeNull()
    expect(h.outboxInserts).toHaveLength(0)
    // F-374 既有告警文案保持不变
    expect(h.warn).toHaveBeenCalledWith(
      '[api-subscription] 套餐缺少有效订阅周期,拒绝写入计费分组',
      expect.objectContaining({ reason: 'missing_period', groupName: 'vip' }),
    )
  })
})
