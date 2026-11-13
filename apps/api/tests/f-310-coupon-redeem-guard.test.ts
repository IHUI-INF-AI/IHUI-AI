// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-310 回归锁(2026-11-13)。
 *
 * 病灶:enabled / startsAt / applicableScope 只在支付页预览列表判定,
 * `redeemCoupon` 只校验归属、unused、expiresAt、applicableModels,且唯一调用方
 * 不传 context.model ⇒ 停用券、未到生效时间券、跨业务范围券都能绕过前端直接核销。
 *
 * 本文件锁:
 *   ① 已停用券核销被拒(disabled);
 *   ② 未到 startsAt 的券核销被拒(not_started);
 *   ③ 业务范围不匹配(relay 券用于 VIP 订单)核销被拒(scope_not_applicable);
 *   ④ 合法券正常核销成功(防误伤);
 *   ⑤ 预览与核销对同一券给同一判据(同一 assertCouponUsable / 同一错误码词汇)。
 *
 * 只 mock db / auth / order-service,不连真实 PG。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const UC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const NOW = Date.now()

const { state } = vi.hoisted(() => ({
  state: {
    readQueue: [] as unknown[][],
    updateQueue: [] as unknown[][],
    updateSets: [] as Array<Record<string, unknown>>,
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    return true
  },
}))

// 路由只用到发货函数;避开 order-service 的整条依赖链
vi.mock('../src/services/order-service.js', () => ({
  activateOrderSubscription: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  type Chain = Record<string, unknown>
  function readChain(): Chain {
    const c: Chain = {}
    for (const m of ['select', 'from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'offset']) {
      c[m] = () => c
    }
    const take = () => Promise.resolve(state.readQueue.shift() ?? [])
    c.limit = () => take()
    c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      take().then(resolve, reject)
    return c
  }
  function updateChain(): Chain {
    const c: Chain = {}
    c.set = (values: Record<string, unknown>) => {
      state.updateSets.push(values)
      return c
    }
    c.where = () => c
    const take = () => Promise.resolve(state.updateQueue.shift() ?? [])
    c.returning = () => take()
    c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      take().then(resolve, reject)
    return c
  }
  return {
    db: {
      select: readChain,
      update: updateChain,
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
    dbRead: { select: readChain },
    dbClient: {},
  }
})

import { assertCouponUsable, redeemCoupon } from '../src/services/coupon-service.js'
import { miniappPayRoutes } from '../src/routes/miniapp-pay-routes.js'

/** 一条 promo_coupons 行(默认合法:订阅范围、满减 2 元、当前生效) */
function coupon(over: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    code: 'IHUI-COUPON-TEST',
    name: '满减券',
    type: 'deduction',
    value: '200',
    minSpend: null,
    referrerGets: null,
    referralValue: null,
    applicableModels: null,
    applicableScope: 'subscription',
    totalQuota: null,
    issuedCount: 1,
    perUserLimit: 1,
    startsAt: new Date(NOW - 24 * 3600 * 1000),
    expiresAt: new Date(NOW + 24 * 3600 * 1000),
    enabled: true,
    createdAt: new Date(NOW - 24 * 3600 * 1000),
    updatedAt: new Date(NOW - 24 * 3600 * 1000),
    ...over,
  }
}

function userCoupon(over: Record<string, unknown> = {}) {
  return {
    id: UC_ID,
    userId: USER_ID,
    couponId: 'coupon-1',
    status: 'unused',
    referrerUserId: null,
    referredBy: null,
    usedAt: null,
    discountCents: null,
    usedOnOrderId: null,
    usedOnCallLogId: null,
    createdAt: new Date(NOW - 24 * 3600 * 1000),
    ...over,
  }
}

/** 核销读取(user_coupons ⋈ promo_coupons)入队 */
function queueRedeemRow(couponOver: Record<string, unknown> = {}) {
  state.readQueue.push([{ userCoupon: userCoupon(), coupon: coupon(couponOver) }])
}

function order(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderNo: 'ORD-F310',
    userId: USER_ID,
    status: 'pending',
    amount: 1000,
    originalPrice: 1000,
    discountAmount: 0,
    orderType: 2, // VIP
    productId: null,
    ...over,
  }
}

beforeEach(() => {
  state.readQueue = []
  state.updateQueue = []
  state.updateSets = []
})

describe('F-310 redeemCoupon 核销入口守卫', () => {
  it('① 已停用券核销被拒,且不落库', async () => {
    queueRedeemRow({ enabled: false })
    const r = await redeemCoupon(USER_ID, UC_ID, { spendCents: 1000, scope: 'subscription' })
    expect(r).toEqual({ success: false, reason: 'disabled' })
    expect(state.updateSets).toHaveLength(0)
  })

  it('② 未到 startsAt 的券核销被拒', async () => {
    queueRedeemRow({ startsAt: new Date(NOW + 3600 * 1000) })
    const r = await redeemCoupon(USER_ID, UC_ID, { spendCents: 1000, scope: 'subscription' })
    expect(r).toEqual({ success: false, reason: 'not_started' })
    expect(state.updateSets).toHaveLength(0)
  })

  it('③ relay 范围券用于 VIP 订单核销被拒(scope_not_applicable)', async () => {
    queueRedeemRow({ applicableScope: 'relay' })
    const r = await redeemCoupon(USER_ID, UC_ID, { spendCents: 1000, scope: 'subscription' })
    expect(r).toEqual({ success: false, reason: 'scope_not_applicable' })
    expect(state.updateSets).toHaveLength(0)
  })

  it('③b 适用模型不匹配核销被拒(model_not_applicable)', async () => {
    queueRedeemRow({ applicableModels: ['gpt-4o'] })
    const r = await redeemCoupon(USER_ID, UC_ID, {
      spendCents: 1000,
      scope: 'subscription',
      model: 'claude-3-5-sonnet',
    })
    expect(r).toEqual({ success: false, reason: 'model_not_applicable' })
    expect(state.updateSets).toHaveLength(0)
  })

  it('④ 合法券正常核销成功(防误伤)', async () => {
    queueRedeemRow()
    state.updateQueue.push([
      {
        ...userCoupon(),
        status: 'used',
        usedAt: new Date(),
        discountCents: 200,
        usedOnOrderId: ORDER_ID,
      },
    ])
    const r = await redeemCoupon(USER_ID, UC_ID, {
      spendCents: 1000,
      scope: 'subscription',
      orderId: ORDER_ID,
    })
    expect(r.success).toBe(true)
    expect(r.discountCents).toBe(200)
    expect(state.updateSets[0]).toMatchObject({
      status: 'used',
      discountCents: 200,
      usedOnOrderId: ORDER_ID,
    })
  })
})

describe('F-310 预览与核销同判据', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(miniappPayRoutes)
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('⑤ 预览列表给出的不可用原因与核销错误码一一对应(同一 assertCouponUsable)', async () => {
    const cases: Array<{ over: Record<string, unknown>; preview: string; redeem: string }> = [
      { over: { enabled: false }, preview: '已停用', redeem: 'disabled' },
      {
        over: { startsAt: new Date(NOW + 3600 * 1000) },
        preview: '未到可用时间',
        redeem: 'not_started',
      },
      {
        over: { applicableScope: 'relay' },
        preview: '不适用于该商品',
        redeem: 'scope_not_applicable',
      },
    ]

    for (const c of cases) {
      state.readQueue.push([{ userCoupon: userCoupon(), coupon: coupon(c.over) }])
      const res = await server.inject({
        method: 'GET',
        url: '/pay/coupons/available?amount=1000',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { data: { items: Array<{ usable: boolean; reason: string }> } }
      expect(body.data.items[0]).toMatchObject({ usable: false, reason: c.preview })

      queueRedeemRow(c.over)
      const r = await redeemCoupon(USER_ID, UC_ID, { spendCents: 1000, scope: 'subscription' })
      expect(r.success).toBe(false)
      expect(r.reason).toBe(c.redeem)
    }

    // 判据单源:同一函数在预览侧返回原因码,不再各写一套 if
    expect(assertCouponUsable(coupon({ enabled: false }), { scope: 'subscription' })).toBe(
      'disabled',
    )
  })

  it('⑤b 源锁:预览与核销都调用 assertCouponUsable,路由不再保留重复分支', () => {
    const routeSrc = readFileSync(
      fileURLToPath(new URL('../src/routes/miniapp-pay-routes.ts', import.meta.url)),
      'utf8',
    )
    const svcSrc = readFileSync(
      fileURLToPath(new URL('../src/services/coupon-service.ts', import.meta.url)),
      'utf8',
    )
    expect(routeSrc).toContain('assertCouponUsable')
    expect(routeSrc).not.toContain('!coupon.enabled')
    expect(routeSrc).toContain('scope: couponScopeOfOrder(order.orderType)')
    expect(svcSrc).toMatch(/const unusable = assertCouponUsable\(coupon/)
  })
})

describe('F-310 apply-coupon 入口把订单业务范围传给核销', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(miniappPayRoutes)
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('relay 券用于 VIP 订单(orderType=2)→ 400 不适用于该商品', async () => {
    state.readQueue.push([order({ orderType: 2 })])
    state.readQueue.push([]) // 该订单已核销券为空
    queueRedeemRow({ applicableScope: 'relay' })

    const res = await server.inject({
      method: 'POST',
      url: '/orders/ORD-F310/apply-coupon',
      payload: { userCouponId: UC_ID },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 400, message: '不适用于该商品' })
    expect(state.updateSets).toHaveLength(0)
  })

  it('relay 券用于开发者套餐订单(orderType=5)→ 正常核销改价', async () => {
    state.readQueue.push([order({ orderType: 5 })])
    state.readQueue.push([])
    queueRedeemRow({ applicableScope: 'relay' })
    state.updateQueue.push([{ ...userCoupon(), status: 'used', discountCents: 200 }])
    state.updateQueue.push([{ id: ORDER_ID }])

    const res = await server.inject({
      method: 'POST',
      url: '/orders/ORD-F310/apply-coupon',
      payload: { userCouponId: UC_ID },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      code: 0,
      data: { orderNo: 'ORD-F310', amount: 800, discountAmount: 200 },
    })
  })
})
