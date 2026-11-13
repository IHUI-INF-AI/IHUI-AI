// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-148 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/vip/order 按 `price * quantity` 收钱,但支付成功后 purchaseVip 只发一期,
 * 且 createOrder 未落 orders.quantity —— 买 3 份只得 1 份,直接超收,退款/对账口径也错。
 *
 * 采用修法(a):下单落 quantity;purchaseVip 按 quantity 把到期时间延长 quantity 期
 * (多期合并为同一张卡,orderId 唯一约束继续兜住回调重放幂等)。
 *
 * 本文件锁:
 *   ① quantity=3:实付 = 单价×3,履约到期 = 起算 + 3×durationDays,且只落一张卡;
 *   ② quantity=0/负数/超大/非整数:服务端 400 拒绝且不建单;purchaseVip 自身也拒绝;
 *   ③ quantity=1(缺省)既有行为不变:实付 = 单价,到期 = 起算 + durationDays。
 *
 * 只 mock db / payment / auth / 支付渠道,不触达真实 PG、微信、支付宝。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// vi.hoisted:mock 工厂先于 import 求值,夹具与 spy 需在此提前建好
const h = vi.hoisted(() => {
  const insertedVipRows: Record<string, unknown>[] = []
  const level = {
    id: '11111111-1111-4111-8111-111111111111',
    levelName: '月卡',
    levelValue: 1,
    price: 9900,
    durationDays: 30,
    status: 1,
    benefits: [] as unknown[],
  }
  const createOrder = vi.fn(async (input: Record<string, unknown>) => ({
    id: 'f148-order-id',
    orderNo: 'WXF148TEST',
    amount: input.amount,
    quantity: input.quantity ?? 1,
  }))
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [level] }),
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        insertedVipRows.push(values)
        return { onConflictDoNothing: () => ({ returning: async () => [{ id: 'f148-uv-id' }] }) }
      },
    })),
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
    delete: vi.fn(),
    execute: vi.fn(async () => []),
  }
  return { insertedVipRows, level, createOrder, db }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = 'f148-user'
  }),
}))

vi.mock('../src/db/index.js', () => ({
  db: h.db,
  dbRead: h.db,
  dbClient: {},
}))

// 下单落库与支付回调口径都在这一层,直接替换掉,避免真实 PG。
vi.mock('../src/db/payment-queries.js', () => ({
  createOrder: h.createOrder,
  findOrderByNo: vi.fn(),
  updateOrderStatus: vi.fn(),
  queryPendingOrders: vi.fn(),
  listPaidOrdersByDate: vi.fn(),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  listUserBindings: vi.fn(async () => []),
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: () => false,
  jsapiPrepay: vi.fn(),
  nativePrepay: vi.fn(),
  h5Prepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  queryOrder: vi.fn(),
  generateOutTradeNo: vi.fn(),
}))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: () => false,
  buildSignedUrl: vi.fn(),
  queryOrder: vi.fn(),
}))

vi.mock('../src/services/plan-entitlement-service.js', () => ({
  applyPlanEntitlements: vi.fn(async () => undefined),
}))

import { vipRoutes } from '../src/routes/vip.js'
import { purchaseVip } from '../src/db/vip-queries.js'
import { activateOrderSubscription } from '../src/services/order-service.js'

const DAY_MS = 86400_000
const USER_TOKEN = 'Bearer f148-user-token'

describe('F-148 VIP 按 quantity 收钱必须按 quantity 履约', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(vipRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.createOrder.mockClear()
    h.insertedVipRows.length = 0
  })

  const call = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/vip/order',
      headers: { authorization: USER_TOKEN },
      payload,
    })

  const lastInserted = () => {
    const row = h.insertedVipRows[0]
    if (!row) throw new Error('未捕获到 user_vips 插入')
    return row
  }

  /** 支付回调视角:把订单交给 order-service 履约,返回落卡的 (startTime, endTime)。 */
  const fulfill = async (quantity: number, paidAt: Date, orderId = 'f148-order-id') => {
    await activateOrderSubscription({
      id: orderId,
      userId: 'f148-user',
      orderType: 2,
      productId: h.level.id,
      amount: h.level.price * quantity,
      quantity,
      paidAt,
      status: 'paid',
    } as never)
    expect(h.insertedVipRows).toHaveLength(1)
    const row = lastInserted()
    return {
      orderId: row.orderId,
      startTime: (row.startTime as Date).getTime(),
      endTime: (row.endTime as Date).getTime(),
    }
  }

  it('① quantity=3:实付 = 单价×3,到期 = 起算 + 3 期(90 天),只发一张卡', async () => {
    const res = await call({ vipLevelId: h.level.id, quantity: 3 })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { amount: number; quantity: number; orderId: string } }
    expect(body.data.amount).toBe(h.level.price * 3)
    expect(body.data.quantity).toBe(3)

    // 计费口径:落单金额与 quantity 必须同源,否则回调侧无从知道要发几期。
    expect(h.createOrder).toHaveBeenCalledTimes(1)
    const orderInput = h.createOrder.mock.calls[0]![0] as Record<string, unknown>
    expect(orderInput.amount).toBe(h.level.price * 3)
    expect(orderInput.quantity).toBe(3)

    // 履约口径:同一笔钱必须换回 3 期权益。
    const paidAt = new Date('2026-11-13T00:00:00.000Z')
    const delivered = await fulfill(3, paidAt, body.data.orderId)
    expect(delivered.orderId).toBe(body.data.orderId)
    expect(delivered.startTime).toBe(paidAt.getTime())
    expect((delivered.endTime - delivered.startTime) / DAY_MS).toBe(90)
  })

  it('② quantity 非法值(0/负数/超大/非整数)被服务端 400 拒绝且不建单', async () => {
    for (const quantity of [0, -3, 100, 1.5, 100_000]) {
      const res = await call({ vipLevelId: h.level.id, quantity })
      expect(res.statusCode, `quantity=${quantity} 应被拒绝`).toBe(400)
      expect((res.json() as { code: number }).code, `quantity=${quantity} 应返回 400 code`).toBe(
        400,
      )
    }
    expect(h.createOrder).not.toHaveBeenCalled()
    expect(h.insertedVipRows).toHaveLength(0)
  })

  it('②b purchaseVip 自身也拒绝非法 quantity(纵深防御,不依赖路由层)', async () => {
    await expect(
      purchaseVip({ userId: 'f148-user', vipLevelId: h.level.id, quantity: 0 }),
    ).rejects.toThrow('VIP 购买数量非法')
    expect(h.insertedVipRows).toHaveLength(0)
  })

  it('③ quantity=1(缺省)既有行为不变:实付 = 单价,到期 = 起算 + 30 天', async () => {
    const res = await call({ vipLevelId: h.level.id })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { amount: number; quantity: number; orderId: string } }
    expect(body.data.amount).toBe(h.level.price)
    expect(body.data.quantity).toBe(1)

    const orderInput = h.createOrder.mock.calls[0]![0] as Record<string, unknown>
    expect(orderInput.amount).toBe(h.level.price)
    expect(orderInput.quantity).toBe(1)

    const paidAt = new Date('2026-11-13T00:00:00.000Z')
    const delivered = await fulfill(1, paidAt, body.data.orderId)
    expect(delivered.startTime).toBe(paidAt.getTime())
    expect((delivered.endTime - delivered.startTime) / DAY_MS).toBe(30)
  })

  it('③b purchaseVip 不传 quantity 时仍发 1 期(兼容历史调用方)', async () => {
    const paidAt = new Date('2026-11-13T00:00:00.000Z')
    await purchaseVip({ userId: 'f148-user', vipLevelId: h.level.id, paidAt })
    expect(h.insertedVipRows).toHaveLength(1)
    const row = lastInserted()
    expect(((row.endTime as Date).getTime() - (row.startTime as Date).getTime()) / DAY_MS).toBe(30)
  })
})
