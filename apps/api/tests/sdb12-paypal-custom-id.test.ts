// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// SDB-12:PayPal 异步 webhook 必须能从 capture 资源解析出 outTradeNo。
// 修复前下单只写 reference_id,capture 资源不回填 custom_id ⇒ 永远 skipped:'no_out_trade_no'。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  // 跳过 PayPal Verify-API,直接按原始报文解析事件(本地联调降级路径)
  process.env.ALLOW_INSECURE_WEBHOOKS = '1'
  delete process.env.PAYPAL_WEBHOOK_ID
})

const { mockGetOrder } = vi.hoisted(() => ({
  mockGetOrder: vi.fn(),
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
  verifyCallbackSignature: vi.fn(),
  consumeNotifyNonce: vi.fn(),
  decryptCallback: vi.fn(),
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
  completeOrderWithSaga: vi.fn(),
  cancelOrder: vi.fn(),
  refundOrder: vi.fn(),
  activateOrderSubscription: vi.fn(),
}))

vi.mock('../src/services/commission-service.js', () => ({
  feedbackInvite: vi.fn(),
}))

vi.mock('../src/db/payment-queries.js', () => ({
  queryPendingOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: vi.fn(),
  getBalance: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({ db: { select: vi.fn() } }))

import { paymentGatewayRoutes } from '../src/routes/payment-gateway.js'

const WEBHOOK_URL = '/api/payments/paypal/webhook'
const ORDER_NO = 'PP202611110001'

function paypalHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'paypal-transmission-id': 'tid-1',
    'paypal-transmission-time': '2026-11-11T00:00:00Z',
    'paypal-transmission-sig': 'sig-1',
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/cert',
    'paypal-auth-algo': 'SHA256withRSA',
  }
}

function captureEvent(resource: Record<string, unknown>) {
  return {
    id: 'evt-sdb12',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource_type: 'capture',
    resource: {
      id: 'CAP-SDB12',
      status: 'COMPLETED',
      amount: { value: '10.99', currency_code: 'USD' },
      ...resource,
    },
  }
}

describe('SDB-12 PayPal webhook 单号解析', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('paymentIdempotency', {
      acquire: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
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
  })

  async function postEvent(resource: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: WEBHOOK_URL,
      headers: paypalHeaders(),
      payload: JSON.stringify(captureEvent(resource)),
    })
  }

  it('custom_id 能解析出 outTradeNo', async () => {
    mockGetOrder.mockResolvedValue(undefined)
    const res = await postEvent({ custom_id: ORDER_NO })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.skipped).toBe('order_not_found')
    expect(mockGetOrder).toHaveBeenCalledWith(ORDER_NO)
  })

  it('仅 reference_id 的旧资源回退解析', async () => {
    mockGetOrder.mockResolvedValue(undefined)
    const res = await postEvent({ reference_id: ORDER_NO })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.skipped).toBe('order_not_found')
    expect(mockGetOrder).toHaveBeenCalledWith(ORDER_NO)
  })

  it('两者同时存在时 custom_id 优先', async () => {
    mockGetOrder.mockResolvedValue(undefined)
    const res = await postEvent({ custom_id: ORDER_NO, reference_id: 'PP202611110099' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.skipped).toBe('order_not_found')
    expect(mockGetOrder).toHaveBeenCalledWith(ORDER_NO)
  })

  it('两者都缺仍按既有 skipped 语义', async () => {
    const res = await postEvent({})
    expect(res.statusCode).toBe(200)
    expect(res.json().data.skipped).toBe('no_out_trade_no')
    expect(mockGetOrder).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
