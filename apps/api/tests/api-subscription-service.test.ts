/**
 * api-subscription-service 单测(P0-6 中转站产品化,2026-07-31 立)。
 *
 * 覆盖点:
 * - parseTokenQuotaFromFeatures:正常解析 / unlimited 返回 -1 / 无 token 字段返回 0 / 多种格式
 * - activateApiSubscription:正常激活 / token 写入 Key / 无 Key 自动创建 / 幂等(重复激活跳过) / plan 不存在
 * - getUserSubscriptionStatus:有活跃订阅 / 无活跃订阅 / 剩余 token 计算(含 -1 无限)
 * - listApiSubscriptionPlans:返回方案列表
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / api-key-hash(对齐 redemption-code-service.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// =============================================================================
// Mock 工具:链式查询 mock(对齐 redemption-code-service.test.ts 模式)
// =============================================================================

/**
 * 构建链式 mock,支持所有 Drizzle 查询模式:
 * - select().from().where().limit()
 * - select().from().where().orderBy().limit()
 * - select().from().where()(直接 await)
 * - select().from().leftJoin().where().orderBy()(直接 await)
 * - select().from().where()(aggregate count)
 */
function chain(returnValue: unknown) {
  const promise: any = Promise.resolve(returnValue)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.leftJoin = vi.fn().mockReturnValue(promise)
  promise.from = vi.fn().mockReturnValue(promise)
  return { from: promise.from }
}

/** 构建 db.update 链:db.update(table).set(obj).where(cond) */
function updateChain(): { set: ReturnType<typeof vi.fn>; whereMock: ReturnType<typeof vi.fn> } {
  const whereMock = vi.fn().mockResolvedValue(undefined)
  const set = vi.fn().mockReturnValue({ where: whereMock })
  return { set, whereMock }
}

/** 构建 db.insert 链:db.insert(table).values(rows).returning() */
function insertChain(returnValue: unknown): { values: ReturnType<typeof vi.fn> } {
  const returning = vi.fn().mockResolvedValue(returnValue)
  const values = vi.fn().mockReturnValue({ returning })
  return { values }
}

// =============================================================================
// Mock 声明
// =============================================================================

const { mockDbReadSelect, mockDbInsert, mockDbUpdate, mockTxSelect } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  // db.transaction 内 tx.select 的 mock,默认返回空(无已发放流水)
  mockTxSelect: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: vi.fn((cb: (tx: any) => any) =>
      cb({
        select: mockTxSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
      }),
    ),
  },
  dbRead: {
    select: mockDbReadSelect,
  },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  plans: {
    id: 'id',
    name: 'name',
    description: 'description',
    price: 'price',
    interval: 'interval',
    features: 'features',
    isActive: 'is_active',
    sortOrder: 'sort_order',
    billingPeriod: 'billing_period',
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
}))

vi.mock('../src/utils/api-key-hash.js', () => ({
  generateApiKey: () => ({ key: 'ihui_test_key', secret: 'sk_test_secret' }),
  hashSecret: () => 'sha256:hashed_secret',
}))

import {
  parseTokenQuotaFromFeatures,
  activateApiSubscription,
  getUserSubscriptionStatus,
  listApiSubscriptionPlans,
} from '../src/services/api-subscription-service.js'

// =============================================================================
// 测试
// =============================================================================

describe('api-subscription-service — API 订阅核心 service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // ===========================================================================
  // 1. parseTokenQuotaFromFeatures
  // ===========================================================================
  describe('parseTokenQuotaFromFeatures', () => {
    it('正常解析 "500000 tokens/month" → 500000', () => {
      const features = ['500000 tokens/month', '10 QPS', 'email support']
      expect(parseTokenQuotaFromFeatures(features)).toBe(500000)
    })

    it('"1000000 tokens" 无 /month 后缀也能解析', () => {
      expect(parseTokenQuotaFromFeatures(['1000000 tokens'])).toBe(1000000)
    })

    it('"2000000 tokens/month" → 2000000', () => {
      expect(parseTokenQuotaFromFeatures(['2000000 tokens/month'])).toBe(2000000)
    })

    it('"unlimited tokens" → -1(无限额度)', () => {
      expect(parseTokenQuotaFromFeatures(['unlimited tokens', '898 models'])).toBe(-1)
    })

    it('"unlimited tokens/month" 也匹配 unlimited → -1', () => {
      expect(parseTokenQuotaFromFeatures(['unlimited tokens/month'])).toBe(-1)
    })

    it('无 token 字段 → 返回 0', () => {
      expect(parseTokenQuotaFromFeatures(['10 QPS', 'email support', 'community access'])).toBe(0)
    })

    it('非数组(features=null)→ 返回 0', () => {
      expect(parseTokenQuotaFromFeatures(null)).toBe(0)
    })

    it('数组中含非字符串元素 → 跳过,继续匹配字符串', () => {
      expect(parseTokenQuotaFromFeatures([123, true, '500000 tokens/month'])).toBe(500000)
    })

    it('空数组 → 返回 0', () => {
      expect(parseTokenQuotaFromFeatures([])).toBe(0)
    })
  })

  // ===========================================================================
  // 2. activateApiSubscription
  // ===========================================================================
  describe('activateApiSubscription', () => {
    it('plan 不存在 → 返回 plan_not_found', async () => {
      // 第 1 次 dbRead.select:查 plan,返回空数组
      mockDbReadSelect.mockReturnValueOnce(chain([]))

      const result = await activateApiSubscription('user-1', 'plan-not-exist')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('plan_not_found')
    })

    it('正常激活:有 active Key → 累加 token_balance', async () => {
      // 第 1 次:查 plan
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-1',
            name: 'API Starter',
            features: ['500000 tokens/month', '10 QPS'],
          },
        ]),
      )
      // 第 2 次:查用户 active Key
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'key-1', tokenBalance: 1000 }]))
      // db.update 链(事务内 tx.update)
      const updateResult = updateChain()
      mockDbUpdate.mockReturnValueOnce(updateResult)

      const result = await activateApiSubscription('user-1', 'plan-1')
      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-1')
      expect(result.tokenQuota).toBe(500000)
      // 验证 update 被调用(token_balance += 500000 → 501000)
      expect(updateResult.set).toHaveBeenCalledWith(
        expect.objectContaining({ tokenBalance: 501000 }),
      )
    })

    it('无 active Key → 自动创建默认 Key,token_balance = quota', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-1', name: 'API Pro', features: ['2000000 tokens/month'] }]),
      )
      // 查 active Key 返回空
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      // db.insert 链(事务内 tx.insert)
      const insertResult = insertChain([{ id: 'new-key-1' }])
      mockDbInsert.mockReturnValueOnce(insertResult)

      const result = await activateApiSubscription('user-2', 'plan-1')
      expect(result.success).toBe(true)
      expect(result.keyId).toBe('new-key-1')
      expect(result.tokenQuota).toBe(2000000)
      // 验证 insert 入参 tokenBalance = 2000000
      const valuesArg = insertResult.values.mock.calls[0][0]
      expect(valuesArg.tokenBalance).toBe(2000000)
      expect(valuesArg.userId).toBe('user-2')
    })

    it('幂等:已有激活流水(同 orderNo) → 跳过返回 already_activated', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-1', name: 'API Pro', features: ['2000000 tokens/month'] }]),
      )
      // 查 tokenFlows 发现已为该 orderNo 发放过配额流水 → already_activated
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'flow-1' }]))

      const result = await activateApiSubscription('user-1', 'plan-1', 'order-1')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('already_activated')
      // 不应调用 update / insert
      expect(mockDbUpdate).not.toHaveBeenCalled()
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('unlimited quota → token_balance 设为 -1', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          { id: 'plan-ent', name: 'API Enterprise', features: ['unlimited tokens', '99.9% SLA'] },
        ]),
      )
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'order-1' }]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ c: 1 }]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'key-1', tokenBalance: 1000 }]))
      const updateResult = updateChain()
      mockDbUpdate.mockReturnValueOnce(updateResult)

      const result = await activateApiSubscription('user-1', 'plan-ent')
      expect(result.success).toBe(true)
      expect(result.tokenQuota).toBe(-1)
      // 验证 update 设 tokenBalance = -1
      expect(updateResult.set).toHaveBeenCalledWith(expect.objectContaining({ tokenBalance: -1 }))
    })

    it('Key 已是 -1(无限额度)+ quota>0 → 保持 -1 不变更(不调 update)', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-1', name: 'API Starter', features: ['500000 tokens/month'] }]),
      )
      // 查 active Key 返回 tokenBalance=-1
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'key-1', tokenBalance: -1 }]))

      const result = await activateApiSubscription('user-1', 'plan-1')
      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-1')
      // 已是无限额度,不调 update
      expect(mockDbUpdate).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 3. getUserSubscriptionStatus
  // ===========================================================================
  describe('getUserSubscriptionStatus', () => {
    it('有活跃订阅:返回 activePlan + history + remainingTokens', async () => {
      // 第 1 次:查 orders leftJoin plans
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            orderId: 'order-1',
            orderNo: 'NO-001',
            planId: 'plan-1',
            planName: 'API Pro',
            amount: 2900,
            paidAt: new Date('2026-07-30'),
            status: 'paid',
            createdAt: new Date('2026-07-30'),
          },
        ]),
      )
      // 第 2 次:查 activePlan 详情(plans 表)
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-1',
            name: 'API Pro',
            description: '专业开发者',
            price: 2900,
            interval: 'month',
            features: ['2000000 tokens/month'],
            billingPeriod: 'month',
          },
        ]),
      )
      // 第 3 次:查用户 active Key 的 tokenBalance
      mockDbReadSelect.mockReturnValueOnce(chain([{ tokenBalance: 1500 }, { tokenBalance: 500 }]))

      const result = await getUserSubscriptionStatus('user-1')
      expect(result.activePlan).not.toBeNull()
      expect(result.activePlan?.name).toBe('API Pro')
      expect(result.history).toHaveLength(1)
      expect(result.history[0]?.orderNo).toBe('NO-001')
      expect(result.remainingTokens).toBe(2000)
    })

    it('无活跃订阅:activePlan=null,history 为空', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([])) // 无订单
      mockDbReadSelect.mockReturnValueOnce(chain([])) // 无 Key

      const result = await getUserSubscriptionStatus('user-2')
      expect(result.activePlan).toBeNull()
      expect(result.history).toHaveLength(0)
      expect(result.remainingTokens).toBe(0)
    })

    it('剩余 token 计算:含 -1 无限额度 Key → remainingTokens = -1', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ tokenBalance: 1000 }, { tokenBalance: -1 }]))

      const result = await getUserSubscriptionStatus('user-3')
      expect(result.remainingTokens).toBe(-1)
    })

    it('history 含已下架方案(planName 为 null → 显示 "(已下架方案)")', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            orderId: 'order-2',
            orderNo: 'NO-002',
            planId: 'plan-deleted',
            planName: null, // plan 已被删除,leftJoin 返回 null
            amount: 9900,
            paidAt: null,
            status: 'pending',
            createdAt: new Date('2026-07-31'),
          },
        ]),
      )
      mockDbReadSelect.mockReturnValueOnce(chain([]))

      const result = await getUserSubscriptionStatus('user-4')
      expect(result.history).toHaveLength(1)
      expect(result.history[0]?.planName).toBe('(已下架方案)')
      expect(result.history[0]?.status).toBe('pending')
    })
  })

  // ===========================================================================
  // 4. listApiSubscriptionPlans
  // ===========================================================================
  describe('listApiSubscriptionPlans', () => {
    it('返回 3 档方案,按 sortOrder 升序', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-starter',
            name: 'API Starter',
            description: '入门',
            price: 900,
            interval: 'month',
            features: ['500000 tokens/month', '10 QPS'],
            billingPeriod: 'month',
            sortOrder: 1,
          },
          {
            id: 'plan-pro',
            name: 'API Pro',
            description: '专业',
            price: 2900,
            interval: 'month',
            features: ['2000000 tokens/month', '60 QPS'],
            billingPeriod: 'month',
            sortOrder: 2,
          },
          {
            id: 'plan-ent',
            name: 'API Enterprise',
            description: '企业',
            price: 9900,
            interval: 'month',
            features: ['10000000 tokens/month', 'unlimited QPS'],
            billingPeriod: 'month',
            sortOrder: 3,
          },
        ]),
      )

      const result = await listApiSubscriptionPlans()
      expect(result).toHaveLength(3)
      expect(result[0]?.name).toBe('API Starter')
      expect(result[1]?.name).toBe('API Pro')
      expect(result[2]?.name).toBe('API Enterprise')
      // 验证 features 被规范化为 string[]
      expect(Array.isArray(result[0]?.features)).toBe(true)
      expect(result[0]?.features[0]).toBe('500000 tokens/month')
    })

    it('无方案时返回空数组', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      const result = await listApiSubscriptionPlans()
      expect(result).toHaveLength(0)
    })

    it('features 含非字符串元素 → 被过滤掉', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-x',
            name: 'API Starter',
            description: null,
            price: 900,
            interval: 'month',
            features: ['500000 tokens/month', 123, true, '10 QPS'],
            billingPeriod: 'month',
            sortOrder: 1,
          },
        ]),
      )
      const result = await listApiSubscriptionPlans()
      expect(result[0]?.features).toEqual(['500000 tokens/month', '10 QPS'])
    })
  })
})
