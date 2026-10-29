// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 领券中心用户面两条端点(2026-10-29 立):
 * - GET  /api/coupons/available     现在可领的券模板列表(剔除 code)
 * - POST /api/coupons/:couponId/claim 按券模板 id 领取(主体只认鉴权结果)
 *
 * 口径:全程 vi.mock 掉碰库的 coupon-service 出口 ⇒ 不触任何真实数据库连接(§5 测试隔离)。
 * 但 `claimFailureReasonOf` 刻意保留真身(importOriginal 展开),列表过滤与入口预检用的是
 * 生产判据本身 —— 在测试里复制一份过滤条件就等于把判据漂移藏起来(§0.6 / §22c)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { PromoCoupon, UserCoupon } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const COUPON_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_COUPON_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
/** 券码是领取凭据:任何用户面列表响应里都不许出现 */
const SECRET_CODE = 'IHUI-COUPON-SECRET4242'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_A
    return { userId: USER_A } as never
  }),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 只桩掉碰库的三个出口;判据(claimFailureReasonOf)保留生产实现
vi.mock('../../services/coupon-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/coupon-service.js')>()
  return {
    ...actual,
    listUserCoupons: vi.fn(),
    listAvailableCoupons: vi.fn(),
    claimCouponById: vi.fn(),
  }
})

import miscRoutes from '../user/misc-routes.js'
import { claimCouponById, listAvailableCoupons } from '../../services/coupon-service.js'

function setAuthed(userId: string) {
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    return { userId } as never
  })
}

function setUnauthed() {
  mockAuthenticate.mockImplementation(async () => {
    const err = new Error('Authentication required') as Error & { statusCode: number }
    err.statusCode = 401
    throw err
  })
}

/** 券模板夹具:默认「现在可领、限量 100 已领 3」 */
function couponFixture(over: Partial<PromoCoupon> = {}): PromoCoupon {
  const now = Date.now()
  return {
    id: COUPON_ID,
    code: SECRET_CODE,
    name: '满 10 减 2',
    type: 'deduction',
    value: '2.00',
    minSpend: 1000,
    referrerGets: null,
    referralValue: null,
    applicableModels: null,
    applicableScope: 'relay',
    totalQuota: 100,
    issuedCount: 3,
    perUserLimit: 1,
    startsAt: new Date(now - 3_600_000),
    expiresAt: new Date(now + 86_400_000),
    enabled: true,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    ...over,
  }
}

/** 用户券夹具(领取成功的返回值形状) */
function userCouponFixture(over: Partial<UserCoupon> = {}): UserCoupon {
  return {
    id: USER_COUPON_ID,
    userId: USER_A,
    couponId: COUPON_ID,
    status: 'unused',
    referrerUserId: null,
    referredBy: null,
    usedAt: null,
    usedOnOrderId: null,
    usedOnCallLogId: null,
    discountCents: null,
    createdAt: new Date('2026-10-29T00:00:00.000Z'),
    ...over,
  }
}

describe('GET /api/coupons/available — 领券中心列表', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(miscRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    setAuthed(USER_A)
    vi.mocked(listAvailableCoupons).mockResolvedValue({ items: [couponFixture()], total: 1 })
  })

  it('未登录 401,且不发出任何列表查询(副作用没发生)', async () => {
    setUnauthed()
    const res = await app.inject({ method: 'GET', url: '/api/coupons/available' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toHaveProperty('code', 401)
    expect(listAvailableCoupons).not.toHaveBeenCalled()
  })

  it('剔除 code:响应里搜不到券码值,行内也没有 code 键(券码是领取凭据)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/coupons/available' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('code', 0)
    expect(JSON.stringify(body)).not.toContain(SECRET_CODE)
    expect(JSON.stringify(body)).not.toContain('IHUI-COUPON-')
    const row = body.data.list[0]
    expect(row).not.toHaveProperty('code')
    expect(Object.keys(row).sort()).toEqual(
      ['expiresAt', 'id', 'minSpend', 'name', 'perUserLimit', 'remaining', 'startsAt', 'type', 'value'].sort(),
    )
  })

  it('过滤正确:停用 / 未开始 / 已过期 / 售罄 的一行都不出现,可领的留下', async () => {
    const now = Date.now()
    const good = couponFixture({ id: COUPON_ID })
    const disabled = couponFixture({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', enabled: false })
    const notStarted = couponFixture({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      startsAt: new Date(now + 3_600_000),
    })
    const expired = couponFixture({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      expiresAt: new Date(now - 1_000),
    })
    const soldOut = couponFixture({
      id: '99999999-9999-4999-8999-999999999999',
      totalQuota: 5,
      issuedCount: 5,
    })
    vi.mocked(listAvailableCoupons).mockResolvedValue({
      items: [good, disabled, notStarted, expired, soldOut],
      total: 5,
    })

    const res = await app.inject({ method: 'GET', url: '/api/coupons/available' })
    expect(res.statusCode).toBe(200)
    const list = res.json().data.list as Array<{ id: string }>
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(COUPON_ID)
  })

  it('remaining:限量券 = totalQuota - issuedCount,不限量券(totalQuota=null)回 null', async () => {
    vi.mocked(listAvailableCoupons).mockResolvedValue({
      items: [
        couponFixture({ id: COUPON_ID, totalQuota: 100, issuedCount: 3 }),
        couponFixture({
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          totalQuota: null,
          issuedCount: 42,
        }),
      ],
      total: 2,
    })

    const res = await app.inject({ method: 'GET', url: '/api/coupons/available' })
    expect(res.statusCode).toBe(200)
    const list = res.json().data.list as Array<{ id: string; remaining: number | null }>
    expect(list[0]!.remaining).toBe(97)
    expect(list[1]!.remaining).toBeNull()
  })

  it('分页参数逐字透传,响应带 { list, total, page, pageSize }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/coupons/available?page=2&pageSize=15',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('total', 1)
    expect(body.data).toHaveProperty('page', 2)
    expect(body.data).toHaveProperty('pageSize', 15)
    expect(listAvailableCoupons).toHaveBeenCalledTimes(1)
    expect(listAvailableCoupons).toHaveBeenCalledWith({ page: 2, pageSize: 15 })
  })

  it('非法分页(page=0)400,列表查询不发出', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/coupons/available?page=0' })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('code', 400)
    expect(listAvailableCoupons).not.toHaveBeenCalled()
  })
})

describe('POST /api/coupons/:couponId/claim — 按 id 领取', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(miscRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    setAuthed(USER_A)
    vi.mocked(claimCouponById).mockResolvedValue({
      success: true,
      userCoupon: { ...userCouponFixture(), coupon: couponFixture() },
    })
  })

  it('未登录 401,领取不发出(副作用没发生)', async () => {
    setUnauthed()
    const res = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(res.statusCode).toBe(401)
    expect(claimCouponById).not.toHaveBeenCalled()
  })

  it('正向对照:登录主体 200,返回 user_coupon 的 id/couponId/status/createdAt', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('code', 0)
    expect(body.data).toEqual({
      id: USER_COUPON_ID,
      couponId: COUPON_ID,
      status: 'unused',
      createdAt: '2026-10-29T00:00:00.000Z',
    })
    expect(claimCouponById).toHaveBeenCalledWith(USER_A, COUPON_ID, undefined)
  })

  it('成功后再领一次:per_user_limit_exceeded 映射 409(同一主体、同一券)', async () => {
    vi.mocked(claimCouponById)
      .mockResolvedValueOnce({
        success: true,
        userCoupon: { ...userCouponFixture(), coupon: couponFixture() },
      })
      .mockResolvedValueOnce({ success: false, reason: 'per_user_limit_exceeded' })

    const first = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(second.statusCode).toBe(409)
    expect(second.json()).toHaveProperty('code', 409)
    expect(second.json()).toHaveProperty('message', '已超过每人限领数量')
    expect(claimCouponById).toHaveBeenCalledTimes(2)
    expect(claimCouponById).toHaveBeenNthCalledWith(2, USER_A, COUPON_ID, undefined)
  })

  it('配额边界:sold_out 映射 410(文案「优惠券已发放完毕」)', async () => {
    vi.mocked(claimCouponById).mockResolvedValue({ success: false, reason: 'sold_out' })
    const res = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(res.statusCode).toBe(410)
    expect(res.json()).toHaveProperty('message', '优惠券已发放完毕')
  })

  it('停用券:disabled 映射 403', async () => {
    vi.mocked(claimCouponById).mockResolvedValue({ success: false, reason: 'disabled' })
    const res = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toHaveProperty('message', '优惠券已被禁用')
  })

  it('券不存在:code_not_found 映射 404', async () => {
    vi.mocked(claimCouponById).mockResolvedValue({ success: false, reason: 'code_not_found' })
    const res = await app.inject({ method: 'POST', url: `/api/coupons/${COUPON_ID}/claim` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty('message', '优惠券不存在')
  })

  it('越权:body 自报 userId 被 .strict() 拒(400),领取不发出', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/coupons/${COUPON_ID}/claim`,
      payload: { userId: USER_B },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('code', 400)
    expect(claimCouponById).not.toHaveBeenCalled()
  })

  it('越权:query 自报 userId 被忽略,主体仍只认鉴权结果', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/coupons/${COUPON_ID}/claim?userId=${USER_B}`,
    })
    expect(res.statusCode).toBe(200)
    expect(claimCouponById).toHaveBeenCalledTimes(1)
    expect(claimCouponById).toHaveBeenCalledWith(USER_A, COUPON_ID, undefined)
    expect(claimCouponById).not.toHaveBeenCalledWith(USER_B, COUPON_ID, undefined)
  })

  it('裂变券来源券 id 透传(referrerUserCouponId 是唯一的合法 body 字段)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/coupons/${COUPON_ID}/claim`,
      payload: { referrerUserCouponId: USER_COUPON_ID },
    })
    expect(res.statusCode).toBe(200)
    expect(claimCouponById).toHaveBeenCalledWith(USER_A, COUPON_ID, USER_COUPON_ID)
  })

  it('非法 couponId 400,领取不发出', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/coupons/not-a-uuid/claim' })
    expect(res.statusCode).toBe(400)
    expect(claimCouponById).not.toHaveBeenCalled()
  })
})
