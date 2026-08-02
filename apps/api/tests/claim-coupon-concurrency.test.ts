/**
 * claimCoupon 并发安全回归测试(2026-08-02 立)。
 *
 * 验证上轮 P0/P1 修复:
 * - Bug: claimCoupon 的 perUserLimit TOCTOU + issued_count 超发
 *   (并发领取时,perUserLimit 检查与 INSERT 非原子 → 超限领取;issued_count 递增与 INSERT 非原子 → 超发)
 * - 修复: FOR UPDATE 锁券 + 事务内 perUserLimit 校验 + 原子递增 issued_count
 *   (UPDATE ... WHERE issuedCount < totalQuota RETURNING,0 行 = sold_out)
 *
 * 测试模式: vi.mock db.transaction 串行化(模拟 FOR UPDATE 行锁)+ 内存状态模拟原子语义。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// =============================================================================
// Mock 声明
// =============================================================================
const { mockDbTransaction, mockDbReadSelect } = vi.hoisted(() => ({
  mockDbTransaction: vi.fn(),
  mockDbReadSelect: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    transaction: mockDbTransaction,
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
  dbRead: {
    select: mockDbReadSelect,
  },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  promoCoupons: {
    id: 'id',
    code: 'code',
    perUserLimit: 'per_user_limit',
    totalQuota: 'total_quota',
    issuedCount: 'issued_count',
    enabled: 'enabled',
    startsAt: 'starts_at',
    expiresAt: 'expires_at',
    type: 'type',
    referrerGets: 'referrer_gets',
    referralValue: 'referral_value',
    value: 'value',
    minSpend: 'min_spend',
    applicableModels: 'applicable_models',
  },
  userCoupons: {
    id: 'id',
    userId: 'user_id',
    couponId: 'coupon_id',
    status: 'status',
    referrerUserId: 'referrer_user_id',
    referredBy: 'referred_by',
    createdAt: 'created_at',
  },
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    costBalanceCents: 'cost_balance_cents',
    createdAt: 'created_at',
  },
}))

import { claimCoupon } from '../src/services/coupon-service.js'

// =============================================================================
// 内存状态(模拟 DB)
// =============================================================================
interface CouponState {
  id: string
  code: string
  perUserLimit: number
  totalQuota: number | null
  issuedCount: number
  enabled: boolean
  startsAt: Date
  expiresAt: Date
  type: string
  referrerGets: string | null
  referralValue: number | null
  value: string | null
  minSpend: number | null
  applicableModels: string[] | null
}

let couponState: CouponState
let userClaimsTotal: number // 成功领取的总次数(场景 1:同一用户)
let txChain: Promise<unknown> = Promise.resolve()
let insertCounter = 0

// =============================================================================
// mockTx:模拟事务内的原子操作
// =============================================================================
const mockTx: any = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}

/** 构建 select 链:support where/for/limit/orderBy(全部返回同一 Promise)。 */
function buildSelectChain(returnValue: unknown): any {
  const promise: any = Promise.resolve(returnValue)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.for = vi.fn().mockReturnValue(promise)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  const from = vi.fn().mockReturnValue(promise)
  return { from }
}

describe('claimCoupon 并发安全', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txChain = Promise.resolve()
    userClaimsTotal = 0
    insertCounter = 0

    // 默认券状态(场景 1 用)
    couponState = {
      id: 'coupon-1',
      code: 'IHUI-COUPON-TEST',
      perUserLimit: 1,
      totalQuota: 100,
      issuedCount: 0,
      enabled: true,
      startsAt: new Date('2020-01-01'),
      expiresAt: new Date('2030-12-31'),
      type: 'discount',
      referrerGets: null,
      referralValue: null,
      value: '0.80',
      minSpend: null,
      applicableModels: null,
    }

    // dbRead.select:事务外预查券(by code) → 返回当前 couponState
    mockDbReadSelect.mockImplementation(() => {
      const chain = buildSelectChain([couponState])
      return chain
    })

    // mockTx.select:区分"查券(for update)"和"查 count"
    mockTx.select.mockImplementation((cols?: any) => {
      // count 查询:select({ c: count }).from(userCoupons).where(...)
      if (cols && typeof cols === 'object' && !Array.isArray(cols)) {
        return buildSelectChain([{ c: userClaimsTotal }])
      }
      // 查券:select().from(promoCoupons).where(...).for('update')
      return buildSelectChain([{ ...couponState }])
    })

    // mockTx.update:原子递增 issued_count WHERE issuedCount < totalQuota
    mockTx.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            // 原子递增:检查 issuedCount < totalQuota
            if (
              couponState.totalQuota !== null &&
              couponState.issuedCount >= couponState.totalQuota
            ) {
              return Promise.resolve([]) // sold_out
            }
            couponState.issuedCount++
            return Promise.resolve([{ id: couponState.id }])
          }),
        }),
      }),
    }))

    // mockTx.insert:插入 user_coupon,返回新记录
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((obj: any) => {
        insertCounter++
        const newUserCoupon = {
          id: `uc-${insertCounter}`,
          userId: obj.userId,
          couponId: obj.couponId,
          status: obj.status ?? 'unused',
          createdAt: new Date(),
        }
        // 更新用户领取次数(场景 1:同一用户)
        userClaimsTotal++
        return { returning: vi.fn().mockResolvedValue([newUserCoupon]) }
      }),
    }))

    // db.transaction 串行化执行(模拟 FOR UPDATE 行锁,事务不交错)
    mockDbTransaction.mockImplementation(async (fn: any) => {
      const next = txChain.then(() => fn(mockTx))
      txChain = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    })
  })

  it('场景 1:perUserLimit=1,同一用户并发领取 3 次,只成功 1 次(防 TOCTOU 超限)', async () => {
    couponState.perUserLimit = 1
    couponState.totalQuota = 100
    couponState.issuedCount = 0

    const results = await Promise.all([
      claimCoupon('user-A', 'IHUI-COUPON-TEST'),
      claimCoupon('user-A', 'IHUI-COUPON-TEST'),
      claimCoupon('user-A', 'IHUI-COUPON-TEST'),
    ])

    // 修复后:事务内 perUserLimit 校验(FOR UPDATE 锁券后)
    // 请求1:count=0 < 1 → 通过 → insert(count→1)
    // 请求2:count=1 >= 1 → per_user_limit_exceeded
    // 请求3:同上
    const successCount = results.filter((r) => r.success).length
    expect(successCount).toBe(1)

    const failed = results.filter((r) => !r.success)
    expect(failed).toHaveLength(2)
    expect(failed.every((r) => r.reason === 'per_user_limit_exceeded')).toBe(true)

    // issued_count 只递增 1 次(只有 1 次成功领取)
    expect(couponState.issuedCount).toBe(1)
    // userClaimsTotal = 1(只 insert 了 1 次)
    expect(userClaimsTotal).toBe(1)
  })

  it('场景 2:totalQuota=1,3 个不同用户并发领取,只成功 1 次(防 issued_count 超发)', async () => {
    couponState.perUserLimit = 0 // 不限每用户
    couponState.totalQuota = 1
    couponState.issuedCount = 0

    const results = await Promise.all([
      claimCoupon('user-A', 'IHUI-COUPON-TEST'),
      claimCoupon('user-B', 'IHUI-COUPON-TEST'),
      claimCoupon('user-C', 'IHUI-COUPON-TEST'),
    ])

    // 修复后:原子递增 issued_count WHERE issuedCount < totalQuota RETURNING
    // 请求1:0 < 1 → 递增成功 → insert(issuedCount→1)
    // 请求2:1 >= 1 → 递增返回 0 行 → sold_out
    // 请求3:同上
    const successCount = results.filter((r) => r.success).length
    expect(successCount).toBe(1)

    const failed = results.filter((r) => !r.success)
    expect(failed).toHaveLength(2)
    expect(failed.every((r) => r.reason === 'sold_out')).toBe(true)

    // issued_count 最终 = 1(不超发)
    expect(couponState.issuedCount).toBe(1)
  })

  it('场景 3:totalQuota=null(无限库存),3 个不同用户并发领取,全部成功', async () => {
    couponState.perUserLimit = 0
    couponState.totalQuota = null // 无限库存
    couponState.issuedCount = 0

    const results = await Promise.all([
      claimCoupon('user-A', 'IHUI-COUPON-TEST'),
      claimCoupon('user-B', 'IHUI-COUPON-TEST'),
      claimCoupon('user-C', 'IHUI-COUPON-TEST'),
    ])

    // 无限库存:全部成功
    expect(results.every((r) => r.success)).toBe(true)
    // issued_count = 3(都递增了)
    expect(couponState.issuedCount).toBe(3)
  })
})
