// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 把 drizzle sql`` 片段还原成可读 SQL 文本(F-369:用于断言原子累加表达式)。 */
function sqlText(value: unknown): string {
  const chunks = (value as { queryChunks?: unknown[] } | null)?.queryChunks
  if (!Array.isArray(chunks)) return String(value)
  return chunks
    .map((chunk) => {
      if (typeof chunk === 'number' || typeof chunk === 'string') return String(chunk)
      const inner = (chunk as { value?: unknown }).value
      if (Array.isArray(inner)) return inner.join('')
      return typeof inner === 'string' ? inner : String(inner)
    })
    .join('')
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

const { mockDbReadSelect, mockDbInsert, mockDbUpdate, mockTxSelect, mockTxFor, txSelectQueue } =
  vi.hoisted(() => ({
    mockDbReadSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    // db.transaction 内 tx.select 的 mock:按队列返回(默认空 = 无已发放流水)
    mockTxSelect: vi.fn(),
    // 记录 tx.select 是否用了 FOR UPDATE(DB-03 并发正确性关键)
    mockTxFor: vi.fn(),
    txSelectQueue: [] as unknown[],
  }))

/** 事务内链式查询:支持 .from().where().orderBy().limit().for('update') */
function txChain(returnValue: unknown) {
  const promise: any = Promise.resolve(returnValue)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.leftJoin = vi.fn().mockReturnValue(promise)
  promise.from = vi.fn().mockReturnValue(promise)
  promise.for = vi.fn((mode: string) => {
    mockTxFor(mode)
    return promise
  })
  return promise
}

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

// SDB-04:窗口型套餐(任一 limit=-1)会在激活后创建订阅实例;这里替身化,
// 让用例只聚焦"配额计算 + Key 余额落库",不连真实订阅库。
vi.mock('../src/services/subscription-window-service.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, createSubscriptionForOrder: vi.fn(async () => null) }
})

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
    txSelectQueue.length = 0
    mockTxSelect.mockImplementation(() => txChain(txSelectQueue.shift() ?? []))
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
      // 第 2 次:事务内查用户 active Key(DB-03:必须带 FOR UPDATE 读最新余额)
      txSelectQueue.push([{ id: 'key-1', tokenBalance: 1000 }])
      // db.update 链(事务内 tx.update)
      const updateResult = updateChain()
      mockDbUpdate.mockReturnValueOnce(updateResult)

      const result = await activateApiSubscription('user-1', 'plan-1')
      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-1')
      expect(result.tokenQuota).toBe(500000)
      // DB-03:余额必须在事务内锁定读取,不能用事务外快照
      expect(mockTxFor).toHaveBeenCalledWith('update')
      // F-369:余额改成数据库侧原子累加表达式,不再写快照+quota 的绝对值
      const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>
      expect(sqlText(setArg.tokenBalance)).toBe(
        'CASE WHEN token_balance = -1 THEN -1 ELSE token_balance + 500000 END',
      )
      expect(setArg.tokenBalance).not.toBe(501000)
    })

    it('无 active Key → 自动创建默认 Key,token_balance = quota', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-1', name: 'API Pro', features: ['2000000 tokens/month'] }]),
      )
      // 查 active Key 返回空
      txSelectQueue.push([])
      // db.insert 链(事务内 tx.insert)
      const insertResult = insertChain([{ id: 'new-key-1' }])
      mockDbInsert.mockReturnValueOnce(insertResult)

      const result = await activateApiSubscription('user-2', 'plan-1')
      expect(result.success).toBe(true)
      expect(result.keyId).toBe('new-key-1')
      expect(result.tokenQuota).toBe(2000000)
      // 验证 insert 入参 tokenBalance = 2000000
      const valuesArg = insertResult.values.mock.calls[0]![0]
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
      txSelectQueue.push([{ id: 'key-1', tokenBalance: 1000 }])
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
      txSelectQueue.push([{ id: 'key-1', tokenBalance: -1 }])

      const result = await activateApiSubscription('user-1', 'plan-1')
      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-1')
      // 已是无限额度,不调 update
      expect(mockDbUpdate).not.toHaveBeenCalled()
    })

    // =========================================================================
    // SDB-04(2026-11-08):窗口语义 -1 = 不限,不得参与 Math.max
    // 缺陷:日=-1 且周/月=0 时 tokenQuota 被算成 0 ⇒ 新 Key 余额 0 ⇒
    // relay 余额闸恒拒(付费套餐 100% 不可用),且购买流程显示成功。
    // =========================================================================
    it('SDB-04:仅日窗口 = -1(不限)→ tokenQuota=-1,已有 Key 置为无限', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-unlimited',
            name: 'API 不限量',
            features: ['10 QPS'],
            validityDays: 30,
            dailyTokenLimit: -1,
            weeklyTokenLimit: 0,
            monthlyTokenLimit: 0,
            modelWhitelist: null,
            billingGroupCode: null,
          },
        ]),
      )
      txSelectQueue.push([{ id: 'key-1', tokenBalance: 1000 }])
      const updateResult = updateChain()
      mockDbUpdate.mockReturnValueOnce(updateResult)

      const result = await activateApiSubscription('user-1', 'plan-unlimited')

      expect(result.success).toBe(true)
      expect(result.tokenQuota).toBe(-1)
      expect(updateResult.set).toHaveBeenCalledWith(expect.objectContaining({ tokenBalance: -1 }))
    })

    it('SDB-04:仅月窗口 = -1(不限)→ tokenQuota=-1,新 Key token_balance=-1', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-unlimited-m',
            name: 'API 月度不限',
            features: [],
            validityDays: 30,
            dailyTokenLimit: 0,
            weeklyTokenLimit: 0,
            monthlyTokenLimit: -1,
            modelWhitelist: null,
            billingGroupCode: null,
          },
        ]),
      )
      txSelectQueue.push([]) // 无 active Key
      const insertResult = insertChain([{ id: 'new-key-u' }])
      mockDbInsert.mockReturnValueOnce(insertResult)

      const result = await activateApiSubscription('user-2', 'plan-unlimited-m')

      expect(result.success).toBe(true)
      expect(result.tokenQuota).toBe(-1)
      const valuesArg = insertResult.values.mock.calls[0]![0]
      expect(valuesArg.tokenBalance).toBe(-1)
    })

    it('SDB-04 混合:任一日窗口 = -1 + 月窗口有限 → 总额仍为不限(-1)', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-mixed',
            name: 'API 日不限/月限',
            features: [],
            validityDays: 30,
            dailyTokenLimit: -1,
            weeklyTokenLimit: 0,
            monthlyTokenLimit: 200000,
            modelWhitelist: null,
            billingGroupCode: null,
          },
        ]),
      )
      txSelectQueue.push([]) // 无 active Key
      const insertResult = insertChain([{ id: 'new-key-mixed' }])
      mockDbInsert.mockReturnValueOnce(insertResult)

      const result = await activateApiSubscription('user-3', 'plan-mixed')

      expect(result.success).toBe(true)
      expect(result.tokenQuota).toBe(-1)
      const valuesArg = insertResult.values.mock.calls[0]![0]
      expect(valuesArg.tokenBalance).toBe(-1)
    })

    it('SDB-04 正向对照:窗口全为 >0 时仍取最大值(有限窗口求和结果不变)', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'plan-capped',
            name: 'API 多档限额',
            features: [],
            validityDays: 30,
            dailyTokenLimit: 5000,
            weeklyTokenLimit: 8000,
            monthlyTokenLimit: 2000,
            modelWhitelist: null,
            billingGroupCode: null,
          },
        ]),
      )
      txSelectQueue.push([{ id: 'key-1', tokenBalance: 1000 }])
      const updateResult = updateChain()
      mockDbUpdate.mockReturnValueOnce(updateResult)

      const result = await activateApiSubscription('user-1', 'plan-capped')

      expect(result.success).toBe(true)
      expect(result.tokenQuota).toBe(8000)
      // F-369:原子累加表达式,参数即 quota(不再传快照 1000+8000=9000 的绝对值)
      const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>
      expect(sqlText(setArg.tokenBalance)).toBe(
        'CASE WHEN token_balance = -1 THEN -1 ELSE token_balance + 8000 END',
      )
    })

    // =========================================================================
    // SDB-05(2026-11-11):无限配额支路也必须落 token_flows 幂等流水,
    // balance_after 写该支路真实结余(-1 = 无限),不能用 0 冒充"耗尽"。
    // =========================================================================
    it('SDB-05:无限配额激活 → 写流水,quantity/balanceAfter 均为 -1', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-ent', name: 'API Enterprise', features: ['unlimited tokens'] }]),
      )
      // 事务外幂等查询:该订单无历史流水
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      // 事务内:先二次幂等查询(空),再查 active Key(FOR UPDATE)
      txSelectQueue.push([], [{ id: 'key-1', tokenBalance: 1000 }])
      mockDbUpdate.mockReturnValueOnce(updateChain())
      const flowInsert = insertChain([])
      mockDbInsert.mockReturnValueOnce(flowInsert)

      const result = await activateApiSubscription('user-1', 'plan-ent', 'order-u-1')

      expect(result.success).toBe(true)
      expect(result.tokenQuota).toBe(-1)
      const flowValues = flowInsert.values.mock.calls[0]![0]
      expect(flowValues).toEqual(
        expect.objectContaining({
          opType: 6,
          quantity: -1,
          // -1 = 该 Key 落库后的真实余额(无限),不能是 0
          balanceAfter: -1,
          relatedOrderNo: 'order-u-1',
        }),
      )
    })

    it('SDB-05:Key 已无限再购有限套餐 → 仍写流水(quantity=0,balanceAfter=-1)', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-1', name: 'API Starter', features: ['500000 tokens/month'] }]),
      )
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      txSelectQueue.push([], [{ id: 'key-1', tokenBalance: -1 }])
      const flowInsert = insertChain([])
      mockDbInsert.mockReturnValueOnce(flowInsert)

      const result = await activateApiSubscription('user-1', 'plan-1', 'order-u-3')

      expect(result.success).toBe(true)
      // 余额本就是无限,未发生变更
      expect(mockDbUpdate).not.toHaveBeenCalled()
      const flowValues = flowInsert.values.mock.calls[0]![0]
      expect(flowValues).toEqual(
        expect.objectContaining({
          opType: 6,
          quantity: 0,
          balanceAfter: -1,
          relatedOrderNo: 'order-u-3',
        }),
      )
    })

    it('SDB-05:同一幂等键重复调用(无限配额)→ 只有一条流水', async () => {
      const planRow = {
        id: 'plan-ent',
        name: 'API Enterprise',
        features: ['unlimited tokens'],
      }
      mockDbReadSelect.mockReturnValueOnce(chain([planRow]))
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      txSelectQueue.push([], [{ id: 'key-1', tokenBalance: 1000 }])
      mockDbUpdate.mockReturnValueOnce(updateChain())
      const flowInsert = insertChain([])
      mockDbInsert.mockReturnValueOnce(flowInsert)

      const first = await activateApiSubscription('user-1', 'plan-ent', 'order-u-2')
      expect(first.success).toBe(true)

      // 回调重放:幂等查询命中已发放流水 → 直接返回,不再写第二条
      mockDbReadSelect.mockReturnValueOnce(chain([planRow]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'flow-1' }]))
      const second = await activateApiSubscription('user-1', 'plan-ent', 'order-u-2')

      expect(second.success).toBe(false)
      expect(second.reason).toBe('already_activated')
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('SDB-05 对照:有限配额流水与改前一致(quantity=quota,balanceAfter=累加后余额)', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([{ id: 'plan-1', name: 'API Starter', features: ['500000 tokens/month'] }]),
      )
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      txSelectQueue.push([], [{ id: 'key-1', tokenBalance: 1000 }])
      mockDbUpdate.mockReturnValueOnce(updateChain())
      const flowInsert = insertChain([])
      mockDbInsert.mockReturnValueOnce(flowInsert)

      const result = await activateApiSubscription('user-1', 'plan-1', 'order-f-1')

      expect(result.success).toBe(true)
      const flowValues = flowInsert.values.mock.calls[0]![0]
      expect(flowValues).toEqual(
        expect.objectContaining({
          opType: 6,
          quantity: 500000,
          balanceAfter: 501000,
          relatedOrderNo: 'order-f-1',
        }),
      )
    })

    it('SDB-05:同一 orderNo 先无限后有限 → 按既有幂等语义拦截,不写第二条', async () => {
      const unlimitedPlan = {
        id: 'plan-ent',
        name: 'API Enterprise',
        features: ['unlimited tokens'],
      }
      const finitePlan = { id: 'plan-1', name: 'API Starter', features: ['500000 tokens/month'] }

      mockDbReadSelect.mockReturnValueOnce(chain([unlimitedPlan]))
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      txSelectQueue.push([], [{ id: 'key-1', tokenBalance: 1000 }])
      mockDbUpdate.mockReturnValueOnce(updateChain())
      mockDbInsert.mockReturnValueOnce(insertChain([]))

      const first = await activateApiSubscription('user-1', 'plan-ent', 'order-same')
      expect(first.success).toBe(true)

      // 同 orderNo 换套餐再激活:幂等键只认 orderNo + op_type=6,应被拦截
      mockDbReadSelect.mockReturnValueOnce(chain([finitePlan]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'flow-1' }]))
      const second = await activateApiSubscription('user-1', 'plan-1', 'order-same')

      expect(second.success).toBe(false)
      expect(second.reason).toBe('already_activated')
      // 只有无限那笔落库,有限套餐未再发放/未再写流水
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
