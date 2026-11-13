// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-233 回归锁(2026-11-13)。
 *
 * 病灶:checkSubscriptionWindowQuota 读 dbRead 副本且 `catch { return null }`,
 * 把「查询失败/副本延迟」与「确无订阅」合并 ⇒ 订阅用户日/周/月窗口额度在
 * 副本抖动时被当成无订阅直接放行(免费超用);consumeSubscriptionWindowUsage
 * 同样读副本,续费后会把用量记到旧订阅行(双重超额)。
 *
 * 本文件锁:
 *   ① 查询抛错 → fail-closed 拒绝(allowed=false + retryable),且不累加任何用量;
 *   ② 查询成功且确无订阅 → 按既有规则放行,返回体与失败路径可区分;
 *   ③ 窗口内正常调用 → 放行;结算把用量累加到当前订阅;
 *   ④ 源锁:配额判定与用量累计只走主库 db,不再出现 dbRead。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  dbReadSelect: vi.fn(),
  dbInsert: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: mocks.dbSelect, insert: mocks.dbInsert },
  dbRead: { select: mocks.dbReadSelect },
  dbClient: {},
}))

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
  checkSubscriptionWindowQuota,
  consumeSubscriptionWindowUsage,
} from '../src/services/subscription-window-service.js'

/** 链式查询替身:select().from().where().orderBy().limit() 每步返回自身 */
function chain(value: unknown) {
  const p = Promise.resolve(value) as unknown as Record<string, unknown>
  p.from = vi.fn(() => p)
  p.where = vi.fn(() => p)
  p.orderBy = vi.fn(() => p)
  p.limit = vi.fn(() => p)
  return p
}

/** 判定时刻:UTC+8 2026-11-13 12:00 */
const AT = new Date('2026-11-13T04:00:00.000Z')

/** 当前(刚续费后的)活跃订阅:仅日窗口配置了 1000 上限 */
const SUB = {
  id: 'sub-new',
  userId: 'user-f233',
  planId: 'plan-pro',
  planName: 'API Pro',
  status: 'active',
  startAt: new Date('2026-11-01T00:00:00.000Z'),
  endAt: new Date('2026-12-01T00:00:00.000Z'),
  dailyTokenLimit: 1000,
  weeklyTokenLimit: 0,
  monthlyTokenLimit: 0,
  autoRenew: false,
}

const inserted: Array<Record<string, unknown>> = []

describe('F-233 订阅窗口配额:查询失败 fail-closed,判定与记账读主库', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inserted.length = 0
    mocks.dbInsert.mockReturnValue({
      values: vi.fn((row: Record<string, unknown>) => ({
        onConflictDoUpdate: vi.fn(async () => {
          inserted.push(row)
        }),
      })),
    })
  })

  it('① 查询抛错 → fail-closed 拒绝并且不累加用量', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.dbSelect.mockImplementation(() => {
      throw new Error('primary db down')
    })

    const result = await checkSubscriptionWindowQuota('user-f233', 100, AT)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('subscription_check_failed')
    expect(result.retryable).toBe(true)
    expect(result.blockedWindow).toBeUndefined()
    // 判定不读副本
    expect(mocks.dbReadSelect).not.toHaveBeenCalled()

    // 记账路径同样解析失败 ⇒ 一行都不写,绝不会落到旧订阅
    const consumed = await consumeSubscriptionWindowUsage('user-f233', 100, 1, AT)
    expect(consumed).toBe(false)
    expect(mocks.dbInsert).not.toHaveBeenCalled()

    // 订阅查到了但用量查询失败 ⇒ 仍 fail-closed(不得当成用量 0 放行)
    mocks.dbSelect.mockReset()
    mocks.dbSelect.mockReturnValueOnce(chain([SUB])).mockImplementationOnce(() => {
      throw new Error('usage table unavailable')
    })
    const result2 = await checkSubscriptionWindowQuota('user-f233', 100, AT)
    expect(result2.allowed).toBe(false)
    expect(result2.reason).toBe('subscription_check_failed')
    expect(result2.retryable).toBe(true)

    errorSpy.mockRestore()
  })

  it('② 确无订阅(查询成功返回空)→ 按既有规则放行,且与失败路径可区分', async () => {
    mocks.dbSelect.mockReturnValueOnce(chain([]))

    const result = await checkSubscriptionWindowQuota('user-f233', 100, AT)
    // 与 ① 的失败体不同:无 reason / 无 retryable
    expect(result).toEqual({ allowed: true })
    expect(mocks.dbSelect).toHaveBeenCalledTimes(1)
    expect(mocks.dbReadSelect).not.toHaveBeenCalled()
  })

  it('③ 窗口内正常调用 → 放行;结算把用量累加到当前订阅', async () => {
    mocks.dbSelect
      .mockReturnValueOnce(chain([SUB]))
      .mockReturnValueOnce(chain([{ windowType: 'daily', windowStart: AT, tokensUsed: 400 }]))

    const result = await checkSubscriptionWindowQuota('user-f233', 100, AT)
    expect(result.allowed).toBe(true)
    // 订阅 + 用量两次查询都走主库 db,副本 dbRead 一次都不碰
    expect(mocks.dbSelect).toHaveBeenCalledTimes(2)
    expect(mocks.dbReadSelect).not.toHaveBeenCalled()

    mocks.dbSelect.mockReturnValueOnce(chain([SUB]))
    const consumed = await consumeSubscriptionWindowUsage('user-f233', 100, 2, AT)
    expect(consumed).toBe(true)
    // weekly/monthly 未配置(0)不记账,只有 daily 一行
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      subscriptionId: 'sub-new',
      userId: 'user-f233',
      windowType: 'daily',
      tokensUsed: 100,
      costUsedCents: 2,
    })
    expect(mocks.dbReadSelect).not.toHaveBeenCalled()
  })

  it('④ 源锁:配额判定与用量累计只读主库 db,不再出现 dbRead', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/subscription-window-service.ts', import.meta.url)),
      'utf8',
    )
    const quotaStart = src.indexOf('export async function checkSubscriptionWindowQuota')
    const consumeStart = src.indexOf('export async function consumeSubscriptionWindowUsage')
    const createStart = src.indexOf('// 订阅实例创建')
    expect(quotaStart).toBeGreaterThan(-1)
    expect(consumeStart).toBeGreaterThan(quotaStart)
    expect(createStart).toBeGreaterThan(consumeStart)

    const quotaBlock = src.slice(quotaStart, consumeStart)
    const consumeBlock = src.slice(consumeStart, createStart)

    expect(quotaBlock).toContain('fetchActiveSubscription(db,')
    expect(quotaBlock).toContain('fetchWindowUsageMap(db,')
    expect(quotaBlock).toContain('retryable: true')
    expect(quotaBlock).not.toContain('dbRead')
    expect(consumeBlock).toContain('fetchActiveSubscription(db,')
    expect(consumeBlock).not.toContain('dbRead')
  })
})
