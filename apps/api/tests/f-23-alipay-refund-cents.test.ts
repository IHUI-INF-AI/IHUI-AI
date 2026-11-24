// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-23 支付宝整单退款金额:比较前必须先把"元"换算成整数"分"。
//
// 修前:`if (amountYuan * 100 < order.amount)`。19.99 * 100 = 1998.9999999999998 < 1999,
// 于是「19.99 元退 19.99 元订单」这种合法整单退款被判成"小于",返回 400「仅支持整单退款」。
// 本文件用真实路由 + 内存订单表钉住四条分支:两条合法整单、部分退款、金额不等。

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const ORDER_NO = 'ALI-F23-0001'

const h = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  authenticate: vi.fn(),
  isAlipayConfigured: vi.fn(),
  aliRefund: vi.fn(),
  refundTokenDeduct: vi.fn(),
  recordPaymentRefund: vi.fn(),
}))

// ---------- 内存订单表(drizzle 条件 UPDATE 语义) ----------
vi.mock('../src/db/payment-queries.js', () => ({
  createOrder: vi.fn(),
  findOrderByNo: async (orderNo: string) => {
    const row = h.orders.get(orderNo)
    return row ? { ...row } : undefined
  },
  updateOrderStatus: async (orderNo: string, status: string, fromStatus?: string) => {
    const row = h.orders.get(orderNo)
    if (!row) return undefined
    if (fromStatus !== undefined && row.status !== fromStatus) return undefined
    const next = { ...row, status, updatedAt: new Date() }
    h.orders.set(orderNo, next)
    return { ...next }
  },
  queryPendingOrders: async () => [],
  listPaidOrdersByDate: async () => [],
}))

vi.mock('../src/db/commission-queries.js', () => ({
  rechargeToken: vi.fn(),
  deductToken: vi.fn(),
  refundTokenDeduct: h.refundTokenDeduct,
  getBalance: vi.fn(async () => 0),
  applyWithdrawal: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning']) {
      c[method] = () => c
    }
    c.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([]))
    return c
  }
  const stub: Record<string, unknown> = {
    select: () => chain(),
    insert: () => chain(),
    update: () => chain(),
    delete: () => chain(),
    execute: async () => [],
  }
  stub.transaction = async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(stub)
  return { db: stub, dbRead: stub }
})

vi.mock('../src/plugins/auth.js', () => ({ authenticate: h.authenticate }))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: h.isAlipayConfigured,
  buildSignedUrl: vi.fn(),
  appPayOrder: vi.fn(),
  tradeCreate: vi.fn(),
  exchangeAuthCode: vi.fn(),
  verifyNotify: vi.fn(),
  queryOrder: vi.fn(),
  refundOrder: h.aliRefund,
  closeOrder: vi.fn(),
  downloadBillUrl: vi.fn(),
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: () => false,
  jsapiPrepay: vi.fn(),
  appPrepay: vi.fn(),
  h5Prepay: vi.fn(),
  nativePrepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  verifyCallbackSignature: vi.fn(),
  consumeNotifyNonce: vi.fn(),
  decryptCallback: vi.fn(),
  queryOrder: vi.fn(),
  closeOrder: vi.fn(),
  refund: vi.fn(),
  downloadBill: vi.fn(),
}))

vi.mock('../src/services/paypal.js', () => ({
  isPaypalConfigured: () => false,
  createOrder: vi.fn(),
  captureOrder: vi.fn(),
  getOrderStatus: vi.fn(),
  refundCapture: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  isSubscribedEvent: vi.fn(),
  centsToYuanString: (c: number) => (c / 100).toFixed(2),
}))

vi.mock('../src/services/commission-service.js', () => ({ feedbackInvite: vi.fn() }))
vi.mock('../src/services/reconciliation-service.js', () => ({
  billDateForYesterday: vi.fn(() => '2026-01-01'),
}))
vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn(async () => undefined),
}))
vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  getWechatMiniOpenId: vi.fn(async () => undefined),
}))
vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn(),
}))
vi.mock('../src/services/points-service.js', () => ({ earnPoints: vi.fn(), spendPoints: vi.fn() }))
vi.mock('../src/utils/outbox.js', () => ({ writeToOutbox: vi.fn() }))
vi.mock('../src/services/edu-ledger.js', () => ({ recordPayment: vi.fn() }))
vi.mock('../src/services/distributed-transaction.js', () => ({ executeSaga: vi.fn() }))
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordPaymentAttempt: vi.fn(),
  recordPaymentSuccess: vi.fn(),
  recordPaymentRefund: h.recordPaymentRefund,
  recordPaymentAmount: vi.fn(),
  recordOrderSample: vi.fn(),
  recordPaymentSample: vi.fn(),
  recordWxpayCallback: vi.fn(),
  recordWxpayCallbackSuccess: vi.fn(),
  recordWxpayCallbackFailed: vi.fn(),
  recordPaymentException: vi.fn(),
}))

import { paymentGatewayRoutes } from '../src/routes/payment-gateway.js'

function seedPaidOrder(amountCents: number): void {
  h.orders.set(ORDER_NO, {
    id: '00000000-0000-4000-8000-0000000000b1',
    orderNo: ORDER_NO,
    userId: USER_ID,
    orderType: 0,
    productId: null,
    planId: null,
    amount: amountCents,
    currency: 'CNY',
    status: 'paid',
    paymentMethod: 'alipay',
    paidAt: new Date('2026-11-10T10:00:00.000Z'),
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
  })
}

function refundRequest(app: FastifyInstance, refundAmount: string) {
  return app.inject({
    method: 'POST',
    url: `/payments/alipay/refund?outTradeNo=${ORDER_NO}&refundAmount=${refundAmount}&reason=test`,
  })
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorate('riskEngine', { evaluateRisk: () => ({ action: 'ALLOW', hits: [] }) })
  app.setErrorHandler((err, _req, reply) => {
    reply.status(err.statusCode ?? 500).send({ code: 500, message: '服务器错误' })
  })
  await app.register(paymentGatewayRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  h.orders.clear()
  h.authenticate.mockReset()
  h.authenticate.mockResolvedValue({ userId: USER_ID, roleId: 1 })
  h.isAlipayConfigured.mockReset()
  h.isAlipayConfigured.mockReturnValue(true)
  h.aliRefund.mockReset()
  h.aliRefund.mockResolvedValue({ success: true, response: { code: '10000' } })
  h.refundTokenDeduct.mockReset()
  h.refundTokenDeduct.mockResolvedValue(0)
  h.recordPaymentRefund.mockReset()
})

describe('F-23 支付宝整单退款按整数分比较', () => {
  it('19.99 元整单退款通过(裸乘浮点 19.99*100 会小于 1999 分)', async () => {
    // 钉住缺陷成因:修前裸乘比较会判"小于订单金额"
    expect(19.99 * 100).toBeLessThan(1999)
    seedPaidOrder(1999)

    const res = await refundRequest(app, '19.99')

    expect(res.statusCode).toBe(200)
    expect(h.aliRefund).toHaveBeenCalledTimes(1)
    expect(h.orders.get(ORDER_NO)?.status).toBe('refunded')
  })

  it('0.07 元整单退款通过(裸乘 0.07*100 为 7.000000000000001)', async () => {
    expect(0.07 * 100).toBeGreaterThan(7)
    seedPaidOrder(7)

    const res = await refundRequest(app, '0.07')

    expect(res.statusCode).toBe(200)
    expect(h.aliRefund).toHaveBeenCalledTimes(1)
    expect(h.orders.get(ORDER_NO)?.status).toBe('refunded')
  })

  it('部分退款仍被整单校验拒绝,不调用支付宝', async () => {
    seedPaidOrder(1999)

    const res = await refundRequest(app, '10.00')

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('仅支持整单退款')
    expect(h.aliRefund).not.toHaveBeenCalled()
    expect(h.orders.get(ORDER_NO)?.status).toBe('paid')
  })

  it('少 1 分(19.98 元)被拒,不误放行', async () => {
    seedPaidOrder(1999)

    const res = await refundRequest(app, '19.98')

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('仅支持整单退款')
    expect(h.aliRefund).not.toHaveBeenCalled()
  })

  it('超过订单金额(20.00 元)被拒', async () => {
    seedPaidOrder(1999)

    const res = await refundRequest(app, '20.00')

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('不能超过订单金额')
    expect(h.aliRefund).not.toHaveBeenCalled()
    expect(h.orders.get(ORDER_NO)?.status).toBe('paid')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
