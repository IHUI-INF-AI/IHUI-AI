// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-09 支付宝退款并发双退:抢占式条件 UPDATE 必须在调用支付宝之前完成。
// 用一个内存订单表模拟 drizzle 的条件 UPDATE(WHERE status = 'paid'),并用读屏障精确复现
// "两个请求都读到 paid" 的 check-then-act 竞态。
// 改前(先调支付宝、后落本地状态)第一条断言必红:两个请求都会进入支付宝。

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const ORDER_NO = 'ALI-F09-0001'

const h = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  readCount: 0,
  raceBarrier: false,
  releaseFirstRead: undefined as (() => void) | undefined,
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
    const snapshot = row ? { ...row } : undefined
    h.readCount += 1
    if (h.raceBarrier && h.readCount === 1 && snapshot) {
      // 第一笔读到 paid 后挂起,等第二笔也读到 paid 才放行 ⇒ 两请求同时持旧快照进入抢占
      await new Promise<void>((resolve) => {
        h.releaseFirstRead = resolve
      })
    } else if (h.raceBarrier && h.readCount === 2) {
      h.releaseFirstRead?.()
    }
    return snapshot
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

function seedPaidOrder(): void {
  h.orders.set(ORDER_NO, {
    id: '00000000-0000-4000-8000-0000000000b1',
    orderNo: ORDER_NO,
    userId: USER_ID,
    orderType: 2,
    productId: 'vip-level-1',
    planId: null,
    amount: 9900,
    currency: 'CNY',
    status: 'paid',
    paymentMethod: 'alipay',
    paidAt: new Date('2026-11-10T10:00:00.000Z'),
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
  })
}

function refundRequest(app: FastifyInstance) {
  return app.inject({
    method: 'POST',
    url: `/payments/alipay/refund?outTradeNo=${ORDER_NO}&refundAmount=99&reason=test`,
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
  h.readCount = 0
  h.raceBarrier = false
  h.releaseFirstRead = undefined
  h.authenticate.mockReset()
  h.authenticate.mockResolvedValue({ userId: USER_ID, roleId: 1 })
  h.isAlipayConfigured.mockReset()
  h.isAlipayConfigured.mockReturnValue(true)
  h.aliRefund.mockReset()
  h.refundTokenDeduct.mockReset()
  h.refundTokenDeduct.mockResolvedValue(0)
  h.recordPaymentRefund.mockReset()
  seedPaidOrder()
})

describe('F-09 支付宝退款并发抢占', () => {
  it('两个并发退款只有一笔进入支付宝,另一笔返回冲突且不调 alipay', async () => {
    h.raceBarrier = true
    let releaseAli: (() => void) | undefined
    const aliGate = new Promise<void>((resolve) => {
      releaseAli = resolve
    })
    h.aliRefund.mockImplementation(async () => {
      await aliGate
      return { success: true, response: { code: '10000' } }
    })

    const first = refundRequest(app)
    const second = refundRequest(app)
    await vi.waitFor(() => expect(h.aliRefund).toHaveBeenCalledTimes(1))
    releaseAli?.()

    const [firstRes, secondRes] = await Promise.all([first, second])
    const statuses = [firstRes.statusCode, secondRes.statusCode].sort()
    expect(h.aliRefund).toHaveBeenCalledTimes(1)
    expect(statuses).toEqual([200, 409])
    expect(h.orders.get(ORDER_NO)?.status).toBe('refunded')
  })

  it('支付宝返回失败时订单状态回退到 paid(保持 500 语义可重试)', async () => {
    h.aliRefund.mockResolvedValue({ success: false, response: { code: '40004' } })

    const res = await refundRequest(app)

    expect(res.statusCode).toBe(500)
    expect(h.orders.get(ORDER_NO)?.status).toBe('paid')
    expect(h.recordPaymentRefund).not.toHaveBeenCalled()
  })

  it('支付宝调用抛异常时订单状态同样回退到 paid', async () => {
    h.aliRefund.mockRejectedValue(new Error('gateway timeout'))

    const res = await refundRequest(app)

    expect(res.statusCode).toBe(500)
    expect(h.orders.get(ORDER_NO)?.status).toBe('paid')
  })

  it('单次正常退款:订单置 refunded 并记录退款指标', async () => {
    h.aliRefund.mockResolvedValue({ success: true, response: { code: '10000' } })

    const res = await refundRequest(app)

    expect(res.statusCode).toBe(200)
    expect(h.aliRefund).toHaveBeenCalledTimes(1)
    expect(h.orders.get(ORDER_NO)?.status).toBe('refunded')
    expect(h.recordPaymentRefund).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
