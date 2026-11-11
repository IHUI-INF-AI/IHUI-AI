// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// F-32 夹具:Saga 补偿后返回 success:false(不抛异常)时,回调必须释放幂等锁并回可重试失败响应,
// 绝不能写 complete + ACK SUCCESS,否则支付平台停止重投、订单被补偿回 pending、权益永不重放。
// 成功路径行为不变:仍写 complete 并 ACK SUCCESS。

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
  mockVerifyNotify,
  mockVerifyPaypalWebhook,
  mockGetOrder,
  mockCompleteOrder,
  mockCompleteOrderWithSaga,
  mockActivateOrderSubscription,
  mockGetBalance,
  mockFeedbackInvite,
} = vi.hoisted(() => ({
  mockVerifyCallbackSignature: vi.fn(),
  mockDecryptCallback: vi.fn(),
  mockVerifyNotify: vi.fn(),
  mockVerifyPaypalWebhook: vi.fn(),
  mockGetOrder: vi.fn(),
  mockCompleteOrder: vi.fn(),
  mockCompleteOrderWithSaga: vi.fn(),
  mockActivateOrderSubscription: vi.fn(),
  mockGetBalance: vi.fn(),
  mockFeedbackInvite: vi.fn(),
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
  verifyNotify: mockVerifyNotify,
  queryOrder: vi.fn(),
  refundOrder: vi.fn(),
  closeOrder: vi.fn(),
  downloadBillUrl: vi.fn(),
}))

vi.mock('../src/services/paypal.js', () => ({
  isPaypalConfigured: vi.fn().mockReturnValue(true),
  createOrder: vi.fn(),
  captureOrder: vi.fn(),
  getOrderStatus: vi.fn(),
  refundCapture: vi.fn(),
  verifyWebhookSignature: mockVerifyPaypalWebhook,
  centsToYuanString: vi.fn(),
  isSubscribedEvent: vi.fn().mockReturnValue(true),
}))

vi.mock('../src/services/order-service.js', () => ({
  placeOrder: vi.fn(),
  getOrder: mockGetOrder,
  completeOrder: mockCompleteOrder,
  completeOrderWithSaga: mockCompleteOrderWithSaga,
  cancelOrder: vi.fn(),
  claimRefund: vi.fn(),
  abortRefund: vi.fn(),
  refundOrder: vi.fn(),
  activateOrderSubscription: mockActivateOrderSubscription,
  findPaidOrdersByDate: vi.fn(),
  findExpiredOrders: vi.fn(),
}))

vi.mock('../src/services/commission-service.js', () => ({
  feedbackInvite: mockFeedbackInvite,
}))

vi.mock('../src/db/payment-queries.js', () => ({
  queryPendingOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: vi.fn(),
  getBalance: mockGetBalance,
}))

vi.mock('../src/db/index.js', () => ({ db: { select: vi.fn() } }))

import { paymentGatewayRoutes } from '../src/routes/payment-gateway.js'

const WX_NOTIFY_URL = '/api/payments/wechat/notify'
const ALI_NOTIFY_URL = '/api/payments/alipay/notify'
const PAYPAL_WEBHOOK_URL = '/api/payments/paypal/webhook'
const WX_ORDER_NO = 'EDU20261111000000ABCDEF'
const ALI_ORDER_NO = 'ALI20261111000000ABCDEF'
const PAYPAL_ORDER_NO = 'PP20261111000000ABCDEF'

function wxHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'wechatpay-timestamp': '1700000000',
    'wechatpay-nonce': 'nonce-raw',
    'wechatpay-signature': 'sig-raw',
  }
}

function paypalHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'paypal-transmission-id': 'tid-f32',
    'paypal-transmission-time': '2026-11-11T00:00:00Z',
    'paypal-transmission-sig': 'sig-f32',
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/cert',
    'paypal-auth-algo': 'SHA256withRSA',
  }
}

describe('F-32 支付回调 Saga 返回失败', () => {
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
    complete.mockResolvedValue(undefined)
    fail.mockResolvedValue(undefined)
    acquire.mockResolvedValue({ status: 'new', retryAfterMs: 0 })
    mockVerifyCallbackSignature.mockReturnValue(true)
    mockDecryptCallback.mockReturnValue({
      out_trade_no: WX_ORDER_NO,
      trade_state: 'SUCCESS',
      transaction_id: 'TX-F32',
      amount: { total: 10000 },
    })
    mockVerifyNotify.mockReturnValue(true)
    mockVerifyPaypalWebhook.mockResolvedValue({
      id: 'evt-f32',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-F32',
        status: 'COMPLETED',
        custom_id: PAYPAL_ORDER_NO,
        amount: { value: '100.00', currency_code: 'CNY' },
      },
    })
    mockGetOrder.mockImplementation(async (orderNo: string) => ({
      orderNo,
      amount: 10000,
      userId: 'user-1',
      status: 'pending',
    }))
    mockActivateOrderSubscription.mockResolvedValue(undefined)
    mockGetBalance.mockResolvedValue(0)
    mockFeedbackInvite.mockResolvedValue(undefined)
  })

  async function wxNotify() {
    return app.inject({
      method: 'POST',
      url: WX_NOTIFY_URL,
      headers: wxHeaders(),
      payload: JSON.stringify({ resource: { ciphertext: 'c', nonce: 'n', associated_data: 'a' } }),
    })
  }

  it('微信:Saga 返回 success:false → 500 FAIL,不写 complete,并释放幂等锁', async () => {
    mockCompleteOrderWithSaga.mockResolvedValue({ success: false, reason: '订单完成流程失败: x' })

    const res = await wxNotify()

    // 非 2xx + code=FAIL ⇒ 微信按重试曲线重投,Saga 有机会重跑
    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('FAIL')
    expect(complete).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledWith(WX_ORDER_NO, 'TX-F32', '订单完成流程失败: x')
    // 变异自证:删掉 result.success 判断会落到 complete + 200 SUCCESS,以上断言全红。
  })

  it('微信:成功路径行为不变 → 200 SUCCESS,写 complete 且不释放锁', async () => {
    mockCompleteOrderWithSaga.mockResolvedValue({
      success: true,
      order: { id: 'o1', userId: 'user-1', amount: 10000, orderType: 0, productId: null },
    })

    const res = await wxNotify()

    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe('SUCCESS')
    expect(fail).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledWith(WX_ORDER_NO, 'TX-F32', {
      out_trade_no: WX_ORDER_NO,
      trade_state: 'SUCCESS',
    })
  })

  it('支付宝:completeOrder 返回 success:false → fail 文本,不写 complete', async () => {
    mockCompleteOrder.mockResolvedValue({ success: false, reason: '订单状态不可完成' })

    const res = await app.inject({
      method: 'POST',
      url: ALI_NOTIFY_URL,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        sign: 'sig',
        trade_status: 'TRADE_SUCCESS',
        out_trade_no: ALI_ORDER_NO,
        trade_no: 'ALI-TX-F32',
        total_amount: '100.00',
      }),
    })

    expect(res.body).toBe('fail')
    expect(complete).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledWith(ALI_ORDER_NO, 'ALI-TX-F32', '订单状态不可完成')
  })

  it('PayPal webhook:completeOrder 返回 success:false → 500,不写 complete', async () => {
    mockCompleteOrder.mockResolvedValue({ success: false, reason: '订单状态不可完成' })

    const res = await app.inject({
      method: 'POST',
      url: PAYPAL_WEBHOOK_URL,
      headers: paypalHeaders(),
      payload: JSON.stringify({ id: 'evt-f32', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
    })

    expect(res.statusCode).toBe(500)
    expect(complete).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledWith(PAYPAL_ORDER_NO, 'CAP-F32', '订单状态不可完成')
  })
})
