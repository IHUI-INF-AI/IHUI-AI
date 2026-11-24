// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-220 夹具(路由侧):processing/unknown 不得 ACK SUCCESS;complete 失败必须回 FAIL。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.WX_PAY_NOTIFY_URL ??= 'https://example.com/wx/notify'
  process.env.ALIPAY_NOTIFY_URL ??= 'https://example.com/ali/notify'
})

const {
  mockVerifyCallbackSignature,
  mockDecryptCallback,
  mockGetOrder,
  mockCompleteOrderWithSaga,
  mockActivateOrderSubscription,
  mockGetBalance,
  mockFeedbackInvite,
  mockQueryPendingOrders,
} = vi.hoisted(() => ({
  mockVerifyCallbackSignature: vi.fn(),
  mockDecryptCallback: vi.fn(),
  mockGetOrder: vi.fn(),
  mockCompleteOrderWithSaga: vi.fn(),
  mockActivateOrderSubscription: vi.fn(),
  mockGetBalance: vi.fn(),
  mockFeedbackInvite: vi.fn(),
  mockQueryPendingOrders: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn().mockResolvedValue(undefined),
  checkAuth: vi.fn(),
}))

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: vi.fn().mockReturnValue(false),
  jsapiPrepay: vi.fn(),
  appPrepay: vi.fn(),
  h5Prepay: vi.fn(),
  nativePrepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  verifyCallbackSignature: mockVerifyCallbackSignature,
  consumeNotifyNonce: vi.fn().mockResolvedValue('ok'),
  decryptCallback: mockDecryptCallback,
  queryOrder: vi.fn(),
  closeOrder: vi.fn(),
  refund: vi.fn(),
  downloadBill: vi.fn(),
}))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: vi.fn().mockReturnValue(false),
  buildSignedUrl: vi.fn(),
  appPayOrder: vi.fn(),
  tradeCreate: vi.fn(),
  exchangeAuthCode: vi.fn(),
  verifyNotify: vi.fn(),
  queryOrder: vi.fn(),
  refundOrder: vi.fn(),
  closeOrder: vi.fn(),
  downloadBillUrl: vi.fn(),
}))

vi.mock('../src/services/order-service.js', () => ({
  placeOrder: vi.fn(),
  getOrder: mockGetOrder,
  completeOrder: vi.fn(),
  completeOrderWithSaga: mockCompleteOrderWithSaga,
  cancelOrder: vi.fn(),
  refundOrder: vi.fn(),
  activateOrderSubscription: mockActivateOrderSubscription,
  findPaidOrdersByDate: vi.fn(),
  findExpiredOrders: vi.fn(),
}))

vi.mock('../src/services/commission-service.js', () => ({
  feedbackInvite: mockFeedbackInvite,
}))

vi.mock('../src/db/payment-queries.js', () => ({
  queryPendingOrders: mockQueryPendingOrders,
  updateOrderStatus: vi.fn(),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: vi.fn(),
  getBalance: mockGetBalance,
}))

vi.mock('../src/db/index.js', () => ({ db: { select: vi.fn() } }))

import { paymentGatewayRoutes } from '../src/routes/payment-gateway.js'

const NOTIFY_URL = '/api/payments/wechat/notify'
const ORDER_NO = 'EDU20261108000000ABCDEF'

function notifyHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'wechatpay-timestamp': '1700000000',
    'wechatpay-nonce': 'nonce-raw',
    'wechatpay-signature': 'sig-raw',
  }
}

describe('F-220 微信回调幂等分支', () => {
  let app: FastifyInstance
  let acquire: ReturnType<typeof vi.fn>
  let complete: ReturnType<typeof vi.fn>
  let fail: ReturnType<typeof vi.fn>

  beforeAll(async () => {
    acquire = vi.fn()
    complete = vi.fn().mockResolvedValue(undefined)
    fail = vi.fn().mockResolvedValue(undefined)
    app = Fastify({ logger: false })
    app.decorate('paymentIdempotency', {
      acquire,
      complete,
      fail,
      preHandler: vi.fn(),
    } as unknown as FastifyInstance['paymentIdempotency'])
    await app.register(paymentGatewayRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCallbackSignature.mockReturnValue(true)
    mockDecryptCallback.mockReturnValue({
      out_trade_no: ORDER_NO,
      trade_state: 'SUCCESS',
      transaction_id: 'TX-1',
      amount: { total: 10000 },
    })
    mockGetOrder.mockResolvedValue({ orderNo: ORDER_NO, amount: 10000, userId: 'user-1' })
    mockCompleteOrderWithSaga.mockResolvedValue({
      success: true,
      order: { id: 'o1', userId: 'user-1', amount: 10000, orderType: 0, productId: null },
    })
    mockActivateOrderSubscription.mockResolvedValue(undefined)
    mockGetBalance.mockResolvedValue(0)
    mockFeedbackInvite.mockResolvedValue(undefined)
  })

  async function notify() {
    return app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: JSON.stringify({ resource: { ciphertext: 'c', nonce: 'n', associated_data: 'a' } }),
    })
  }

  it('processing → 503 FAIL,不得 ACK SUCCESS 让微信停止重投', async () => {
    acquire.mockResolvedValue({ status: 'processing', retryAfterMs: 5000 })
    const res = await notify()
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('FAIL')
    expect(mockCompleteOrderWithSaga).not.toHaveBeenCalled()
    // 变异自证:把该分支改回 recordWxpayCallbackSuccess()+SUCCESS,本断言翻红。
  })

  it('unknown(Redis 故障)→ 503 FAIL', async () => {
    acquire.mockResolvedValue({ status: 'unknown', retryAfterMs: 5000 })
    const res = await notify()
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('FAIL')
  })

  it('completed → SUCCESS 且不重复履约', async () => {
    acquire.mockResolvedValue({ status: 'completed', retryAfterMs: 0 })
    const res = await notify()
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe('SUCCESS')
    expect(mockCompleteOrderWithSaga).not.toHaveBeenCalled()
  })

  it('new 且 complete 写失败 → FAIL 且释放锁(fail)', async () => {
    acquire.mockResolvedValue({ status: 'new', retryAfterMs: 0 })
    complete.mockRejectedValueOnce(new Error('redis down'))
    const res = await notify()
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('FAIL')
    expect(fail).toHaveBeenCalled()
    // 变异自证:complete 的 catch 改回只 warn 不上抛,会走到 SUCCESS,本断言翻红。
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
