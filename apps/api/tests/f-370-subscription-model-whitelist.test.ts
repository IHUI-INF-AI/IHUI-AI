// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-370 回归锁(2026-11-13,P2):订阅模型白名单在两条分支被跳过,套餐限制形同虚设。
 *
 * 病灶:activateApiSubscription 把 allowedModels 写库嵌在「累加额度」单一分支里,
 * 于是 quota=-1(无限套餐)与「Key 已是 -1」两支只改余额 ⇒ 套餐 modelWhitelist
 * 永不落库 ⇒ 低价套餐的 Key 仍可调用任意模型(按模型分级计费 = 免费升级)。
 *
 * 本文件锁:
 *   ① 无限额度分支:余额写 -1 的同时必须落白名单,白名单外模型被既有鉴权规则拒绝;
 *   ② Key 已是 -1 分支:余额不变,但白名单同样必须落库,白名单外模型被拒绝;
 *   ③ 白名单内模型放行(精确 + 既有通配符语义);
 *   ④ 空白名单(未配置 / 空数组)语义按现状:不写 allowedModels,全放行;
 *   ⑤ 源锁:所有写 Key 的分支都调用同一出口 applyKeyGrant,分支内不再内联 allowedModels。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// =============================================================================
// 链式 mock 工具(对齐 f-369 / api-subscription-service.test.ts)
// =============================================================================

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

const { mockDbReadSelect, mockTxSelect, mockTxFor, mockDbUpdate, mockDbInsert, txSelectQueue } =
  vi.hoisted(() => ({
    mockDbReadSelect: vi.fn(),
    mockTxSelect: vi.fn(),
    mockTxFor: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbInsert: vi.fn(),
    txSelectQueue: [] as unknown[],
  }))

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
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

// 注:api-key-auth(既有白名单判定)也会读 users / apiKeyQuotas,一并给出替身。
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
    allowedModels: 'allowed_models',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
    name: 'name',
    key: 'key',
    secret: 'secret',
    permissions: 'permissions',
    rateLimit: 'rate_limit',
    expiresAt: 'expires_at',
    allowedIps: 'allowed_ips',
    maxTokensPerReq: 'max_tokens_per_req',
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
  users: { id: 'id', status: 'status' },
  apiKeyQuotas: {
    apiKeyId: 'api_key_id',
    hourlyUsed: 'hourly_used',
    dailyUsed: 'daily_used',
    windowStart: 'window_start',
  },
}))

vi.mock('../src/utils/api-key-hash.js', () => ({
  generateApiKey: () => ({ key: 'ihui_test_key', secret: 'sk_test_secret' }),
  hashSecret: () => 'sha256:hashed_secret',
  verifySecret: vi.fn(() => true),
}))

// api-key-auth 依赖的上游配额工具,替身化避免真实 DB 访问
vi.mock('../src/utils/api-key-quota.js', () => ({
  ApiKeyQuota: vi.fn(() => ({
    checkAndConsume: vi.fn(() => ({ allowed: true, resetAt: new Date() })),
  })),
  DEFAULT_HOURLY_LIMIT: 1000,
  DEFAULT_DAILY_LIMIT: 10000,
}))

vi.mock('../src/services/subscription-window-service.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, createSubscriptionForOrder: vi.fn(async () => null) }
})

import { activateApiSubscription } from '../src/services/api-subscription-service.js'
import { checkAllowedModels } from '../src/plugins/api-key-auth.js'

// =============================================================================
// 测试
// =============================================================================

/** 套餐 fixture:features 决定额度分支,modelWhitelist 决定白名单。 */
function planFixture(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'plan-f370',
    name: 'API F370',
    features: ['unlimited tokens'],
    modelWhitelist: ['gpt-4o-mini'],
    validityDays: 30,
    dailyTokenLimit: 0,
    weeklyTokenLimit: 0,
    monthlyTokenLimit: 0,
    billingGroupCode: null,
    ...overrides,
  }
}

/** 安排一次「已有活跃 Key」的激活,返回事务内 update 的替身。 */
function arrangeActiveKey(plan: Record<string, unknown>, keyBalance: number) {
  mockDbReadSelect.mockReturnValueOnce(chain([plan]))
  txSelectQueue.push([{ id: 'key-f370', tokenBalance: keyBalance }])
  const updateResult = updateChain()
  mockDbUpdate.mockReturnValueOnce(updateResult)
  return updateResult
}

describe('F-370 订阅套餐模型白名单必须在所有额度分支落库', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    txSelectQueue.length = 0
    mockTxSelect.mockImplementation(() => txChain(txSelectQueue.shift() ?? []))
  })

  it('① 无限额度分支(quota=-1):余额写 -1 同时落白名单,白名单外模型被拒绝', async () => {
    const plan = planFixture({
      features: ['unlimited tokens'],
      // 非字符串条目应被规范化过滤;通配符条目保留
      modelWhitelist: ['gpt-4o-mini', 123, 'claude-3-haiku*'],
    })
    const updateResult = arrangeActiveKey(plan, 1000)

    const result = await activateApiSubscription('user-f370', String(plan.id))

    expect(result.success).toBe(true)
    expect(result.tokenQuota).toBe(-1)
    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg.tokenBalance).toBe(-1)
    expect(setArg.allowedModels).toEqual(['gpt-4o-mini', 'claude-3-haiku*'])

    // 落库的白名单必须能被既有鉴权规则直接消费
    const persisted = setArg.allowedModels as string[]
    expect(checkAllowedModels(persisted, 'gpt-5.6')).toEqual({
      ok: false,
      reason: '模型不在白名单',
    })
    expect(checkAllowedModels(persisted, 'gpt-4o-mini')).toEqual({ ok: true })
    expect(checkAllowedModels(persisted, 'claude-3-haiku-20240307')).toEqual({ ok: true })
  })

  it('② Key 已是 -1 分支:余额不变,但白名单仍落库,白名单外模型被拒绝', async () => {
    const plan = planFixture({
      features: ['5000 tokens/month'],
      modelWhitelist: ['gpt-4o-mini'],
    })
    const updateResult = arrangeActiveKey(plan, -1)

    const result = await activateApiSubscription('user-f370', String(plan.id))

    expect(result.success).toBe(true)
    expect(result.tokenQuota).toBe(5000)
    // 余额无变更(不写 tokenBalance),但为白名单写了一次
    expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg).not.toHaveProperty('tokenBalance')
    expect(setArg.allowedModels).toEqual(['gpt-4o-mini'])

    const persisted = setArg.allowedModels as string[]
    expect(checkAllowedModels(persisted, 'gpt-5.6')).toEqual({
      ok: false,
      reason: '模型不在白名单',
    })
    expect(checkAllowedModels(persisted, 'gpt-4o-mini')).toEqual({ ok: true })
  })

  it('③ quota=0 分支:余额不变,白名单同样落库并拒绝白名单外模型', async () => {
    const plan = planFixture({
      features: [],
      modelWhitelist: ['gpt-4o-mini'],
    })
    const updateResult = arrangeActiveKey(plan, 800)

    const result = await activateApiSubscription('user-f370', String(plan.id))

    expect(result.success).toBe(true)
    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg).not.toHaveProperty('tokenBalance')
    expect(setArg.allowedModels).toEqual(['gpt-4o-mini'])
    expect(checkAllowedModels(setArg.allowedModels as string[], 'gpt-5.6')).toEqual({
      ok: false,
      reason: '模型不在白名单',
    })
  })

  it('④ 空白名单语义按现状:未配置/空数组 → 不写 allowedModels,全放行', async () => {
    // 未配置(null)+ 无限额度:只写余额
    const nullPlan = planFixture({ features: ['unlimited tokens'], modelWhitelist: null })
    const nullUpdate = arrangeActiveKey(nullPlan, 1000)
    await activateApiSubscription('user-f370', String(nullPlan.id))
    const nullSet = nullUpdate.set.mock.calls[0]![0] as Record<string, unknown>
    expect(nullSet.tokenBalance).toBe(-1)
    expect(nullSet).not.toHaveProperty('allowedModels')
    expect(checkAllowedModels((nullSet.allowedModels as string[] | undefined) ?? null, 'gpt-5.6'))
      .toEqual({ ok: true })

    // 空数组 + Key 已无限:余额与白名单都不变 ⇒ 不触发 update
    mockDbUpdate.mockClear()
    const emptyPlan = planFixture({ features: ['5000 tokens/month'], modelWhitelist: [] })
    arrangeActiveKey(emptyPlan, -1)
    const result = await activateApiSubscription('user-f370', String(emptyPlan.id))
    expect(result.success).toBe(true)
    expect(mockDbUpdate).not.toHaveBeenCalled()
    expect(checkAllowedModels(null, 'gpt-5.6')).toEqual({ ok: true })

    // 新建 Key 且未配置白名单:不写 allowedModels
    const newKeyPlan = planFixture({ features: ['5000 tokens/month'], modelWhitelist: [] })
    mockDbReadSelect.mockReturnValueOnce(chain([newKeyPlan]))
    txSelectQueue.push([])
    const insertResult = insertChain([{ id: 'new-key-f370' }])
    mockDbInsert.mockReturnValueOnce(insertResult)
    const created = await activateApiSubscription('user-f370', String(newKeyPlan.id))
    expect(created.success).toBe(true)
    const values = insertResult.values.mock.calls[0]![0] as Record<string, unknown>
    expect(values).not.toHaveProperty('allowedModels')
  })

  it('⑤ 源锁:两条病灶分支都调用同一出口 applyKeyGrant,分支内不再内联 allowedModels', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/api-subscription-service.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf('export async function activateApiSubscription')
    const end = src.indexOf('// 工具函数')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)

    // 出口只有一份定义
    expect(src.match(/async function applyKeyGrant\(/g)).toHaveLength(1)

    // 两条病灶分支(无限额度 / Key 已是 -1)都必须显式调用同一出口
    const unlimitedStart = block.indexOf('if (tokenQuota === -1)')
    const infiniteStart = block.indexOf('if (Number(activeKey.tokenBalance) === -1)')
    const accumulateStart = block.indexOf('F-369(P1)')
    expect(unlimitedStart).toBeGreaterThan(-1)
    expect(infiniteStart).toBeGreaterThan(unlimitedStart)
    expect(accumulateStart).toBeGreaterThan(infiniteStart)
    expect(block.slice(unlimitedStart, infiniteStart)).toContain('applyKeyGrant(')
    expect(block.slice(infiniteStart, accumulateStart)).toContain('applyKeyGrant(')

    // 每个写 Key 的分支都走同一出口(无限 / 已无限 / 累加 / quota=0）
    expect(block.match(/applyKeyGrant\(\s*tx,/g)?.length ?? 0).toBeGreaterThanOrEqual(4)

    // 分支内不再出现内联的 allowedModels 写入(只能经唯一出口)
    expect(block).not.toMatch(/allowedModels\s*:/)
  })
})
