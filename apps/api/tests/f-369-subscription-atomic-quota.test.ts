// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-369 回归锁(P1,2026-11-13):订阅激活发配额用快照余额做绝对值 SET,
 * 覆盖并发扣费 ⇒ 已消耗额度被静默恢复(免扣费/双花)。
 *
 * 锁点:
 *  1. 累加支路写库必须是 `token_balance = CASE WHEN token_balance = -1 THEN -1
 *     ELSE token_balance + quota END` 的原子表达式(SQL 片段 + 参数),不是绝对值;
 *  2. 余额已是 -1(无限)时,同一表达式求值仍为 -1,且实例上「已无限再购有限套餐」
 *     仍不触发 update(既有 -1 语义不放宽);
 *  3. 并发语义:事务读到旧快照 10000、真实行已被扣成 1000,激活 quota=5000 后
 *     DB 结果为 6000,而不是快照派生的 15000;
 *  4. 更新语句里不含任何快照派生数字,唯一数值参数就是 quota。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// =============================================================================
// 链式 mock 工具(对齐 api-subscription-service.test.ts)
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

/** 把 drizzle sql`` 片段还原成可读 SQL 文本。 */
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

/** 取 sql 片段里的数值参数(本地测试不含真实列,数值 chunk 即绑定参数)。 */
function numericParams(value: unknown): number[] {
  const chunks = (value as { queryChunks?: unknown[] } | null)?.queryChunks
  if (!Array.isArray(chunks)) return []
  return chunks.filter((chunk): chunk is number => typeof chunk === 'number')
}

/**
 * 按 Postgres 对表达式的语义求值:
 * CASE WHEN token_balance = -1 THEN -1 ELSE token_balance + <quota> END
 * currentBalance = 更新前该行的真实余额(模拟并发扣费后的值)。
 */
function evalBalanceExpression(setValue: unknown, currentBalance: number): number {
  const text = sqlText(setValue)
  if (!text.includes('CASE WHEN') || !text.includes('THEN -1')) {
    throw new Error(`余额不是 CASE 原子表达式:${text}`)
  }
  if (currentBalance === -1) return -1
  const params = numericParams(setValue)
  if (params.length !== 1) throw new Error(`期望唯一 quota 参数,实际 ${params.join(',')}`)
  return currentBalance + params[0]!
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
}))

vi.mock('../src/utils/api-key-hash.js', () => ({
  generateApiKey: () => ({ key: 'ihui_test_key', secret: 'sk_test_secret' }),
  hashSecret: () => 'sha256:hashed_secret',
}))

vi.mock('../src/services/subscription-window-service.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, createSubscriptionForOrder: vi.fn(async () => null) }
})

import { activateApiSubscription } from '../src/services/api-subscription-service.js'

/** 有限额度套餐:5000 tokens/month。 */
const limitedPlan = {
  id: 'plan-f369',
  name: 'API F369',
  features: ['5000 tokens/month'],
  modelWhitelist: null,
  validityDays: 0,
  dailyTokenLimit: 0,
  weeklyTokenLimit: 0,
  monthlyTokenLimit: 0,
  billingGroupCode: null,
}

/** 运行一次「已有 Key + 累加额度」激活,返回 update 的 set 载荷。 */
async function runActivation(snapshotBalance: number) {
  mockDbReadSelect.mockReturnValueOnce(chain([limitedPlan]))
  txSelectQueue.push([{ id: 'key-f369', tokenBalance: snapshotBalance }])
  const updateResult = updateChain()
  mockDbUpdate.mockReturnValueOnce(updateResult)
  const result = await activateApiSubscription('user-f369', 'plan-f369')
  return { result, updateResult }
}

describe('F-369 订阅发配额必须是数据库侧原子累加', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    txSelectQueue.length = 0
    mockTxSelect.mockImplementation(() => txChain(txSelectQueue.shift() ?? []))
  })

  it('累加支路:set 里是 token_balance + quota 表达式,不是绝对值', async () => {
    const { result, updateResult } = await runActivation(10000)

    expect(result.success).toBe(true)
    expect(result.tokenQuota).toBe(5000)
    // 并发正确性前提:事务内锁行读余额
    expect(mockTxFor).toHaveBeenCalledWith('update')

    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>
    const expression = sqlText(setArg.tokenBalance)
    // ① 原子表达式形态
    expect(expression).toBe('CASE WHEN token_balance = -1 THEN -1 ELSE token_balance + 5000 END')
    expect(numericParams(setArg.tokenBalance)).toEqual([5000])
    // ② 不再是快照 + quota 的绝对值
    expect(updateResult.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenBalance: 15000 }),
    )
    expect(updateResult.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenBalance: 501000 }),
    )
    // WHERE 精确到该 Key
    expect(updateResult.whereMock).toHaveBeenCalledTimes(1)
  })

  it('无限行保护:表达式对 token_balance = -1 求值仍为 -1', async () => {
    const { updateResult } = await runActivation(10000)
    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>

    expect(evalBalanceExpression(setArg.tokenBalance, -1)).toBe(-1)
    expect(evalBalanceExpression(setArg.tokenBalance, 10000)).toBe(15000)
  })

  it('已无限(Key 余额 -1)+ 有限套餐 → 不触发 update,语义不变', async () => {
    mockDbReadSelect.mockReturnValueOnce(chain([limitedPlan]))
    txSelectQueue.push([{ id: 'key-f369', tokenBalance: -1 }])

    const result = await activateApiSubscription('user-f369', 'plan-f369')

    expect(result.success).toBe(true)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('unlimited 套餐(quota=-1)→ 余额仍写 -1', async () => {
    mockDbReadSelect.mockReturnValueOnce(
      chain([{ ...limitedPlan, features: ['unlimited tokens'] }]),
    )
    txSelectQueue.push([{ id: 'key-f369', tokenBalance: 1000 }])
    const updateResult = updateChain()
    mockDbUpdate.mockReturnValueOnce(updateResult)

    const result = await activateApiSubscription('user-f369', 'plan-f369')

    expect(result.success).toBe(true)
    expect(result.tokenQuota).toBe(-1)
    expect(updateResult.set).toHaveBeenCalledWith(expect.objectContaining({ tokenBalance: -1 }))
  })

  it('并发语义:快照 10000、真实余额已被扣成 1000 → 激活 quota=5000 后为 6000', async () => {
    const { updateResult } = await runActivation(10000)
    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>

    // 事务读到的是快照 10000,但真实行在写库时已是 1000(并发扣费已提交);
    // 原子表达式以行内值为基准 ⇒ 6000,而不是 10000 + 5000 = 15000。
    const after = evalBalanceExpression(setArg.tokenBalance, 1000)
    expect(after).toBe(6000)
    expect(after).not.toBe(15000)
  })

  it('事务外/快照数字不进入 update 的 set', async () => {
    const { updateResult } = await runActivation(10000)
    const setArg = updateResult.set.mock.calls[0]![0] as Record<string, unknown>

    // 唯一数值参数是 quota;快照 10000 与派生值 15000 都不得出现
    expect(numericParams(setArg.tokenBalance)).toEqual([5000])
    expect(sqlText(setArg.tokenBalance)).not.toContain('10000')
    expect(JSON.stringify(numericParams(setArg.tokenBalance))).not.toContain('15000')
    expect(typeof setArg.tokenBalance).not.toBe('number')
  })
})
