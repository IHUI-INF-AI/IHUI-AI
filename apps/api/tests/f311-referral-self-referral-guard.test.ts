// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * F-311 回归锁 —— 裂变券自荐防护:分享人 ≠ 领取人。
 *
 * 缺陷:claimResolvedCoupon 的裂变段只校验 referrerCoupon.couponId === coupon.id,
 * 未校验 referrerCoupon.userId !== userId。用户 A 正常领 1 张得 userCoupon X 后,
 * 对同一券码 claimCoupon(A, code, referrerUserCouponId=X) ⇒ referrerUserId=A;
 * referrerGets='credit' 时 rewardReferrerTx 直接给 A 的 API Key 加 referralValue 余额,
 * 可反复(perUserLimit=0 时无限),且无充值流水可对账 —— 免费刷 API Key 余额。
 *
 * 修法:裂变段判定分享人===领取人 ⇒ 不记 referrerUserId ⇒ 不触发 rewardReferrerTx。
 *
 * 本夹具零连库:vi.mock db/dbRead,聚焦「自荐 ⇒ referrerUserId 被判空 ⇒ 无 credit 加值」。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbTransaction, mockDbReadSelect } = vi.hoisted(() => ({
  mockDbTransaction: vi.fn(),
  mockDbReadSelect: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockDbTransaction, insert: vi.fn(), update: vi.fn(), select: vi.fn() },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  promoCoupons: {
    id: 'id', code: 'code', perUserLimit: 'per_user_limit', totalQuota: 'total_quota',
    issuedCount: 'issued_count', enabled: 'enabled', startsAt: 'starts_at',
    expiresAt: 'expires_at', type: 'type', referrerGets: 'referrer_gets',
    referralValue: 'referral_value', value: 'value', minSpend: 'min_spend',
    applicableModels: 'applicable_models',
  },
  userCoupons: {
    id: 'id', userId: 'user_id', couponId: 'coupon_id', status: 'status',
    referrerUserId: 'referrer_user_id', referredBy: 'referred_by', createdAt: 'created_at',
  },
  developerApiKeys: {
    id: 'id', userId: 'user_id', status: 'status',
    costBalanceCents: 'cost_balance_cents', createdAt: 'created_at',
  },
}))

import { claimCoupon } from '../src/services/coupon-service.js'

const USER_A = 'user-aaaa'
const COUPON_ID = 'coupon-311'

/** 裂变券(referrerGets=credit)状态。 */
let couponState: Record<string, unknown>
/** 分享人 user_coupon(被传入的 referrerUserCouponId 指向它)。 */
let referrerCouponRow: Record<string, unknown> | undefined
/** rewardReferrerTx credit 路径是否被触发(抓 developerApiKeys 的 update set)。 */
let creditUpdateCalled: boolean
let creditUpdateAmount: number | null

function buildSelectChain(returnValue: unknown): any {
  const promise: any = Promise.resolve(returnValue)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.for = vi.fn().mockReturnValue(promise)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  const from = vi.fn().mockReturnValue(promise)
  return { from }
}

describe('F-311 裂变券自荐防护', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    creditUpdateCalled = false
    creditUpdateAmount = null

    couponState = {
      id: COUPON_ID,
      code: 'IHUI-REF-311',
      perUserLimit: 0, // 无限:正是缺陷里可反复刷的形态
      totalQuota: null,
      issuedCount: 0,
      enabled: true,
      startsAt: new Date('2020-01-01'),
      expiresAt: new Date('2030-12-31'),
      type: 'referral',
      referrerGets: 'credit',
      referralValue: 500, // 5 元,自刷即加 500 分
      value: '0.00',
      minSpend: null,
      applicableModels: null,
    }

    // dbRead.select 被调两次:① by code 查券 ② 裂变段查 referrer 的 user_coupon
    let readCall = 0
    mockDbReadSelect.mockImplementation(() => {
      readCall++
      if (readCall === 1) return buildSelectChain([couponState]) // 查 promoCoupons by code
      // 第二次是裂变段查 user_coupons by id(share 人的那枚)
      return buildSelectChain(referrerCouponRow ? [referrerCouponRow] : [])
    })

    mockDbTransaction.mockImplementation(async (fn: any) => {
      const mockTx: any = {
        select: vi.fn().mockImplementation((cols?: any) => {
          if (cols && typeof cols === 'object' && !Array.isArray(cols)) {
            return buildSelectChain([{ c: 0 }])
          }
          return buildSelectChain([{ ...couponState }])
        }),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((obj: any) => ({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: COUPON_ID }]),
            }),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([
              { id: 'uc-new', userId: USER_A, couponId: COUPON_ID, status: 'unused' },
            ]),
          })),
        })),
      }
      // 抓 credit 加余额:update(developerApiKeys).set({ costBalanceCents: sql`... + N` })
      const origUpdate = mockTx.update
      mockTx.update = vi.fn().mockImplementation((table: any) => {
        const chain = origUpdate(table)
        const origSet = chain.set
        chain.set = vi.fn().mockImplementation((obj: any) => {
          if (obj && obj.costBalanceCents !== undefined) {
            creditUpdateCalled = true
            // sql`... + ${N}` 产出对象,参数在 .values 数组里;兜底再试字符串匹配
            const v = obj.costBalanceCents
            const param = Array.isArray(v?.values)
              ? v.values.find((x: unknown) => typeof x === 'number')
              : undefined
            if (typeof param === 'number') creditUpdateAmount = param
            else {
              const m = String(v).match(/\+\s*(\d+)/)
              creditUpdateAmount = m ? Number(m[1]) : null
            }
          }
          return origSet(obj)
        })
        return chain
      })
      return fn(mockTx)
    })
  })

  it('分享人 ≠ 领取人(正常裂变) ⇒ 记 referrerUserId,触发 credit 加值', async () => {
    referrerCouponRow = { id: 'uc-share', userId: 'user-BBBB', couponId: COUPON_ID }
    const r = await claimCoupon(USER_A, 'IHUI-REF-311', 'uc-share')
    expect(r.success).toBe(true)
    // 只验"credit 更新是否触发",不验具体金额(sql 模板参数结构不稳定,核心信号已足够)
    expect(creditUpdateCalled).toBe(true)
  })

  it('分享人 = 领取人(自荐) ⇒ 不记 referrerUserId,不触发 credit 加值(防刷余额)', async () => {
    // A 拿自己已领的 user_coupon 当 referrerUserCouponId
    referrerCouponRow = { id: 'uc-self', userId: USER_A, couponId: COUPON_ID }
    const r = await claimCoupon(USER_A, 'IHUI-REF-311', 'uc-self')
    expect(r.success).toBe(true) // 券照领,但分享人奖励不得发给自己
    expect(creditUpdateCalled).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
