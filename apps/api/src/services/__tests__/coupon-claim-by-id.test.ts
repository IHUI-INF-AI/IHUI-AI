// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * claimCouponById(按券模板 id 领取)与 claimCoupon(按券码)共用同一份事务体的回归测试
 * (2026-10-29 立)。
 *
 * 模式同 tests/claim-coupon-concurrency.test.ts:vi.mock db.transaction 串行化(模拟
 * FOR UPDATE 行锁)+ 内存状态模拟原子语义 ⇒ 不连任何真实数据库(§5 测试隔离)。
 * 断言面覆盖:按 id 定位、非 uuid 形状闸零查库、每人限领、配额边界 sold_out、
 * 裂变券 referrer 奖励、以及按码入口在抽取后行为不变。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbTransaction, mockDbReadSelect } = vi.hoisted(() => ({
  mockDbTransaction: vi.fn(),
  mockDbReadSelect: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
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

import { claimCoupon, claimCouponById } from '../coupon-service.js'

const COUPON_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REFERRER_UC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

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
let userClaimsTotal: number
let insertCounter: number
let txChain: Promise<unknown> = Promise.resolve()

const mockTx: any = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}

/** 构建 select 链:支持 where/for/limit/orderBy/offset(全部返回同一 Promise)。 */
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

/** 让事务外的券预查按顺序返回:第 1 次是券行,后续(裂变券)是 referrer 的 user_coupon */
function stubCouponReads(referrer?: { id: string; userId: string; couponId: string }) {
  mockDbReadSelect.mockImplementationOnce(() => buildSelectChain([couponState]))
  if (referrer) {
    mockDbReadSelect.mockImplementationOnce(() => buildSelectChain([referrer]))
  }
}

describe('claimCouponById — 按 id 领取(与按码入口共用事务体)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清掉上一轮残留的 *Once 队列(clearAllMocks 只清调用记录,不清排队实现)
    mockDbReadSelect.mockReset()
    mockTx.select.mockReset()
    mockTx.update.mockReset()
    mockTx.insert.mockReset()
    mockDbTransaction.mockReset()
    txChain = Promise.resolve()
    userClaimsTotal = 0
    insertCounter = 0

    couponState = {
      id: COUPON_ID,
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

    // mockTx.select:区分「查券(for update)」与「查已领数 count」
    mockTx.select.mockImplementation((cols?: any) => {
      if (cols && typeof cols === 'object' && !Array.isArray(cols)) {
        return buildSelectChain([{ c: userClaimsTotal }])
      }
      return buildSelectChain([{ ...couponState }])
    })

    // mockTx.update:原子递增 issued_count WHERE issuedCount < totalQuota
    mockTx.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
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
        userClaimsTotal++
        return { returning: vi.fn().mockResolvedValue([newUserCoupon]) }
      }),
    }))

    // db.transaction 串行化执行(模拟 FOR UPDATE 行锁)
    mockDbTransaction.mockImplementation(async (fn: any) => {
      const next = txChain.then(() => fn(mockTx))
      txChain = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    })
  })

  it('按 id 领取成功:结果形状与按码入口一致(userCoupon 带 coupon)', async () => {
    stubCouponReads()
    const result = await claimCouponById('user-A', COUPON_ID)

    expect(result.success).toBe(true)
    expect(result.userCoupon).toMatchObject({
      id: 'uc-1',
      userId: 'user-A',
      couponId: COUPON_ID,
      status: 'unused',
    })
    expect(result.userCoupon?.coupon.id).toBe(COUPON_ID)
    expect(mockDbReadSelect).toHaveBeenCalledTimes(1)
    expect(couponState.issuedCount).toBe(1)
  })

  it('非 uuid 的 couponId:回 code_not_found 且零查库(形状闸排在进 SQL 之前)', async () => {
    const result = await claimCouponById('user-A', 'not-a-uuid')

    expect(result).toEqual({ success: false, reason: 'code_not_found' })
    expect(mockDbReadSelect).not.toHaveBeenCalled()
    expect(mockDbTransaction).not.toHaveBeenCalled()
  })

  it('id 查不到券:code_not_found,事务不开启', async () => {
    mockDbReadSelect.mockImplementation(() => buildSelectChain([]))
    const result = await claimCouponById('user-A', COUPON_ID)

    expect(result).toEqual({ success: false, reason: 'code_not_found' })
    expect(mockDbTransaction).not.toHaveBeenCalled()
  })

  it('成功后再领一次:perUserLimit=1 ⇒ per_user_limit_exceeded(事务体共用)', async () => {
    stubCouponReads()
    stubCouponReads()

    const first = await claimCouponById('user-A', COUPON_ID)
    const second = await claimCouponById('user-A', COUPON_ID)

    expect(first.success).toBe(true)
    expect(second).toEqual({ success: false, reason: 'per_user_limit_exceeded' })
    expect(couponState.issuedCount).toBe(1)
    expect(insertCounter).toBe(1)
  })

  it('配额边界:totalQuota=1 时第二个人领到 sold_out(事务内原子 UPDATE 裁决,不超发)', async () => {
    couponState.totalQuota = 1
    couponState.perUserLimit = 0
    // 并发模型:第二个请求的事务外预查与第一个请求同时发生,看到的是 issuedCount=0 的旧快照,
    // 真正拦住超发的必须是事务内的条件 UPDATE(0 行命中 ⇒ sold_out)
    const staleSnapshot = { ...couponState }
    stubCouponReads()
    mockDbReadSelect.mockImplementationOnce(() => buildSelectChain([staleSnapshot]))

    const first = await claimCouponById('user-A', COUPON_ID)
    const second = await claimCouponById('user-B', COUPON_ID)

    expect(first.success).toBe(true)
    expect(second).toEqual({ success: false, reason: 'sold_out' })
    expect(couponState.issuedCount).toBe(1)
    expect(insertCounter).toBe(1)
  })

  it('按码入口零改动:claimCoupon 仍按券码领取成功(抽取后行为不变)', async () => {
    stubCouponReads()
    const result = await claimCoupon('user-A', 'ihui-coupon-test')

    expect(result.success).toBe(true)
    expect(result.userCoupon?.coupon.code).toBe('IHUI-COUPON-TEST')
    expect(couponState.issuedCount).toBe(1)
  })

  it('裂变券:referrerUserCouponId 透传到共享事务体,分享人同事务得券', async () => {
    couponState.type = 'referral'
    couponState.referrerGets = 'duplicate'
    stubCouponReads({ id: REFERRER_UC_ID, userId: 'user-sharer', couponId: COUPON_ID })

    const result = await claimCouponById('user-B', COUPON_ID, REFERRER_UC_ID)

    expect(result.success).toBe(true)
    // 被分享人的券 + 分享人的奖励券 = 两次 insert;issued_count 同步 +2
    expect(insertCounter).toBe(2)
    expect(couponState.issuedCount).toBe(2)
    expect(mockTx.insert).toHaveBeenCalledTimes(2)
  })
})
