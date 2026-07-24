import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.WX_PAY_NOTIFY_URL ??= 'https://example.com/wx/notify'
  process.env.ALIPAY_NOTIFY_URL ??= 'https://example.com/ali/notify'
})

// ---------- 鉴权 mock ----------
const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

// ---------- 微信支付 mock ----------
const {
  mockIsWechatPayConfigured,
  mockJsapiPrepay,
  mockAppPrepay,
  mockH5Prepay,
  mockNativePrepay,
  mockBuildJsapiSign,
  mockVerifyCallbackSignature,
  mockDecryptCallback,
  mockWxQueryOrder,
  mockWxCloseOrder,
  mockWxRefund,
  mockWxDownloadBill,
} = vi.hoisted(() => ({
  mockIsWechatPayConfigured: vi.fn().mockReturnValue(false),
  mockJsapiPrepay: vi.fn(),
  mockAppPrepay: vi.fn(),
  mockH5Prepay: vi.fn(),
  mockNativePrepay: vi.fn(),
  mockBuildJsapiSign: vi.fn(),
  mockVerifyCallbackSignature: vi.fn(),
  mockDecryptCallback: vi.fn(),
  mockWxQueryOrder: vi.fn(),
  mockWxCloseOrder: vi.fn(),
  mockWxRefund: vi.fn(),
  mockWxDownloadBill: vi.fn(),
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: mockIsWechatPayConfigured,
  jsapiPrepay: mockJsapiPrepay,
  appPrepay: mockAppPrepay,
  h5Prepay: mockH5Prepay,
  nativePrepay: mockNativePrepay,
  buildJsapiSign: mockBuildJsapiSign,
  verifyCallbackSignature: mockVerifyCallbackSignature,
  decryptCallback: mockDecryptCallback,
  queryOrder: mockWxQueryOrder,
  closeOrder: mockWxCloseOrder,
  refund: mockWxRefund,
  downloadBill: mockWxDownloadBill,
}))

// ---------- 支付宝 mock ----------
const {
  mockIsAlipayConfigured,
  mockBuildSignedUrl,
  mockAppPayOrder,
  mockVerifyNotify,
  mockAliQueryOrder,
  mockAliRefundOrder,
  mockAliCloseOrder,
  mockAliDownloadBillUrl,
} = vi.hoisted(() => ({
  mockIsAlipayConfigured: vi.fn().mockReturnValue(false),
  mockBuildSignedUrl: vi.fn(),
  mockAppPayOrder: vi.fn(),
  mockVerifyNotify: vi.fn(),
  mockAliQueryOrder: vi.fn(),
  mockAliRefundOrder: vi.fn(),
  mockAliCloseOrder: vi.fn(),
  mockAliDownloadBillUrl: vi.fn(),
}))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: mockIsAlipayConfigured,
  buildSignedUrl: mockBuildSignedUrl,
  appPayOrder: mockAppPayOrder,
  verifyNotify: mockVerifyNotify,
  queryOrder: mockAliQueryOrder,
  refundOrder: mockAliRefundOrder,
  closeOrder: mockAliCloseOrder,
  downloadBillUrl: mockAliDownloadBillUrl,
}))

// ---------- order-service / commission-service mock ----------
const {
  mockPlaceOrder,
  mockGetOrder,
  mockCompleteOrder,
  mockCancelOrder,
  mockRefundOrder,
  mockActivateOrderSubscription,
  mockFeedbackInvite,
  mockApplyWithdrawal,
  mockGetBalance,
  mockQueryPendingOrders,
} = vi.hoisted(() => ({
  mockPlaceOrder: vi.fn(),
  mockGetOrder: vi.fn(),
  mockCompleteOrder: vi.fn(),
  mockCancelOrder: vi.fn(),
  mockRefundOrder: vi.fn(),
  mockActivateOrderSubscription: vi.fn(),
  mockFeedbackInvite: vi.fn(),
  mockApplyWithdrawal: vi.fn(),
  mockGetBalance: vi.fn(),
  mockQueryPendingOrders: vi.fn(),
}))

vi.mock('../src/services/order-service.js', () => ({
  placeOrder: mockPlaceOrder,
  getOrder: mockGetOrder,
  completeOrder: mockCompleteOrder,
  cancelOrder: mockCancelOrder,
  refundOrder: mockRefundOrder,
  activateOrderSubscription: mockActivateOrderSubscription,
}))

vi.mock('../src/services/commission-service.js', () => ({
  feedbackInvite: mockFeedbackInvite,
}))

vi.mock('../src/db/payment-queries.js', () => ({
  queryPendingOrders: mockQueryPendingOrders,
}))

vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: mockApplyWithdrawal,
  getBalance: mockGetBalance,
}))

// 不 mock utils/swagger.js:真实 buildSchema 用 zodToJsonSchema 转 Zod → JSON schema,
// 否则 params/querystring 的 Zod 对象会被 Fastify 当作非法 JSON schema 拒绝。

import { paymentGatewayRoutes, adminPaymentGatewayRoutes } from '../src/routes/payment-gateway.js'

const UUID = '11111111-1111-1111-1111-111111111111'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    orderNo: 'EDU20260723000000ABCDEF',
    userId: 'user-001',
    orderType: 0,
    productId: null,
    amount: 10000,
    status: 'pending',
    paymentMethod: 'wechat',
    ...overrides,
  }
}

describe('payment gateway routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 模拟生产环境 server.ts 的 errorHandler:AJV 验证错误 → 400, ZodError → 400
    app.setErrorHandler((err, _req, reply) => {
      const isZodErr =
        err.name === 'ZodError' && Array.isArray((err as { issues?: unknown[] }).issues)
      const statusCode = isZodErr
        ? 400
        : err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500
      const message = isZodErr
        ? ((err as { issues?: Array<{ message?: string }> }).issues?.[0]?.message ?? '参数错误')
        : statusCode >= 500
          ? '服务器错误'
          : err.message
      reply.status(statusCode).send({ code: statusCode, message })
    })
    // paymentIdempotency decorate(微信/支付宝回调依赖)
    app.decorate('paymentIdempotency', {
      acquire: vi.fn().mockResolvedValue({ status: 'new' }),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    })
    await app.register(paymentGatewayRoutes, { prefix: '/api' })
    await app.register(adminPaymentGatewayRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认未登录
    mockAuthenticate.mockImplementation(() => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    // 默认微信/支付宝未配置(mock 模式)
    mockIsWechatPayConfigured.mockReturnValue(false)
    mockIsAlipayConfigured.mockReturnValue(false)
    // 重置 idempotency 默认值
    ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'new' })
    ;(app.paymentIdempotency.complete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(app.paymentIdempotency.fail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockAuthenticate.mockImplementation((request: { userId?: string; jwtPayload?: { userId: string; roleId: number } }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId }
      return Promise.resolve(request.jwtPayload)
    })
  }

  function authAsAdmin(userId = 'admin-001') {
    authAs(userId, 1)
  }

  // ===================== 微信支付 =====================

  describe('POST /api/payments/wechat/create', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100&openId=oxxx',
      })
      expect(res.statusCode).toBe(401)
    })

    it('金额非正返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=0&openId=oxxx',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('金额必须为正')
    })

    it('缺少 openId 返回 400(Zod 校验)', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('微信未配置返回 mock 模式 200', async () => {
      authAs()
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100&openId=oxxx',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.mock).toBe(true)
      expect(body.data.outTradeNo).toBe('EDU20260723000000ABCDEF')
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001', amount: 100, payType: 'wechat' }),
      )
    })

    it('微信已配置返回 JSAPI 签名', async () => {
      authAs()
      mockIsWechatPayConfigured.mockReturnValue(true)
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      mockJsapiPrepay.mockResolvedValueOnce('prepay_id_xxx')
      mockBuildJsapiSign.mockReturnValueOnce({ timeStamp: 't', nonceStr: 'n', paySign: 's' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100&openId=oxxx',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.paySign).toBe('s')
      expect(mockJsapiPrepay).toHaveBeenCalled()
    })
  })

  describe('POST /api/payments/wechat/native', () => {
    it('金额非正返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/native?amount=-1',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('mock 模式返回 codeUrl 占位', async () => {
      authAs()
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/native?amount=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.mock).toBe(true)
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ payType: 'wechat_native' }),
      )
    })
  })

  describe('POST /api/payments/wechat/notify (回调)', () => {
    it('签名验证失败返回 400', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify',
        payload: { resource: {} },
        headers: {
          'wechatpay-timestamp': 'ts',
          'wechatpay-nonce': 'nonce',
          'wechatpay-signature': 'bad',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('FAIL')
    })

    it('无 resource 返回 SUCCESS', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify',
        payload: {},
        headers: {
          'wechatpay-timestamp': 'ts',
          'wechatpay-nonce': 'nonce',
          'wechatpay-signature': 'ok',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe('SUCCESS')
    })

    it('支付成功回调幂等(已 completed 返回 duplicate)', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        transaction_id: 'TX001',
      })
      // 2026-07-24 安全加固:源码 now calls getOrder() to verify callback amount vs order amount
      mockGetOrder.mockResolvedValueOnce(makeOrder())
      ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'completed',
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify',
        payload: { resource: { ciphertext: 'c', nonce: 'n', associated_data: 'a' } },
        headers: {
          'wechatpay-timestamp': 'ts',
          'wechatpay-nonce': 'nonce',
          'wechatpay-signature': 'ok',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().message).toContain('duplicate')
      expect(mockCompleteOrder).not.toHaveBeenCalled()
    })

    it('支付成功回调正常处理返回 SUCCESS', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        transaction_id: 'TX001',
      })
      // 2026-07-24 安全加固:源码 now calls getOrder() to verify callback amount vs order amount
      mockGetOrder.mockResolvedValueOnce(makeOrder())
      ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'new',
      })
      mockCompleteOrder.mockResolvedValueOnce({
        success: true,
        order: makeOrder({ status: 'paid', userId: 'user-001' }),
      })
      mockGetBalance.mockResolvedValueOnce(100)
      mockFeedbackInvite.mockResolvedValueOnce(undefined)
      mockActivateOrderSubscription.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify',
        payload: { resource: { ciphertext: 'c', nonce: 'n', associated_data: 'a' } },
        headers: {
          'wechatpay-timestamp': 'ts',
          'wechatpay-nonce': 'nonce',
          'wechatpay-signature': 'ok',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe('SUCCESS')
      expect(mockCompleteOrder).toHaveBeenCalledWith('EDU001', 'TX001')
      expect(app.paymentIdempotency.complete).toHaveBeenCalled()
    })

    it('处理过程抛错返回 FAIL', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        transaction_id: 'TX001',
      })
      // 2026-07-24 安全加固:源码 now calls getOrder() to verify callback amount vs order amount
      mockGetOrder.mockResolvedValueOnce(makeOrder())
      ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'new',
      })
      mockCompleteOrder.mockRejectedValueOnce(new Error('boom'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify',
        payload: { resource: { ciphertext: 'c', nonce: 'n', associated_data: 'a' } },
        headers: {
          'wechatpay-timestamp': 'ts',
          'wechatpay-nonce': 'nonce',
          'wechatpay-signature': 'ok',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('FAIL')
      expect(app.paymentIdempotency.fail).toHaveBeenCalled()
    })
  })

  describe('POST /api/payments/wechat/query', () => {
    it('订单不存在返回 404', async () => {
      authAs()
      mockGetOrder.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/query?outTradeNo=NOPE',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('非本人非管理员返回 403', async () => {
      authAs('user-002', 0)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/query?outTradeNo=EDU001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('本人查询返回 200', async () => {
      authAs('user-001', 0)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/query?outTradeNo=EDU001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.local.orderNo).toBe('EDU20260723000000ABCDEF')
    })
  })

  describe('POST /api/payments/wechat/refund', () => {
    it('订单状态非 paid 返回 400(业务规则)', async () => {
      authAs()
      mockGetOrder.mockResolvedValueOnce(makeOrder({ status: 'pending', userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/refund?outTradeNo=EDU001&refundAmount=100',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('不允许退款')
    })

    it('paid 订单退款成功返回 200', async () => {
      authAs()
      mockIsWechatPayConfigured.mockReturnValue(true)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ status: 'paid', userId: 'user-001', amount: 10000 }))
      mockWxRefund.mockResolvedValueOnce(undefined)
      mockRefundOrder.mockResolvedValueOnce({ success: true })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/refund?outTradeNo=EDU001&refundAmount=100',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.refundNo).toContain('refund_')
      expect(mockWxRefund).toHaveBeenCalled()
      expect(mockRefundOrder).toHaveBeenCalledWith('EDU001')
    })
  })

  describe('GET /api/payments/wechat/status/:outTradeNo', () => {
    it('订单不存在返回 404', async () => {
      authAs()
      mockGetOrder.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/wechat/status/NOPE',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('他人订单返回 403(隐私校验)', async () => {
      authAs('user-002', 0)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/wechat/status/EDU001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  // ===================== 支付宝 =====================

  describe('POST /api/payments/alipay/create', () => {
    it('mock 模式返回 mock 标记', async () => {
      authAs()
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/create?amount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.mock).toBe(true)
      // 10.00 元 = 1000 分
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1000, payType: 'alipay' }),
      )
    })

    it('已配置返回 payUrl', async () => {
      authAs()
      mockIsAlipayConfigured.mockReturnValue(true)
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      mockBuildSignedUrl.mockReturnValueOnce('https://pay.example.com/sign')
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/create?amount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.payUrl).toBe('https://pay.example.com/sign')
    })
  })

  describe('POST /api/payments/alipay/notify', () => {
    it('验签失败返回 fail', async () => {
      mockVerifyNotify.mockReturnValueOnce(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: { out_trade_no: 'EDU001' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('fail')
    })

    it('无 sign 返回 fail', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: { out_trade_no: 'EDU001' },
      })
      expect(res.body).toBe('fail')
    })

    it('支付成功回调返回 success 文本', async () => {
      mockVerifyNotify.mockReturnValueOnce(true)
      // 2026-07-24 安全加固:源码 now calls getOrder() to verify callback amount vs order amount
      mockGetOrder.mockResolvedValueOnce(makeOrder())
      ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'new',
      })
      mockCompleteOrder.mockResolvedValueOnce({
        success: true,
        order: makeOrder({ status: 'paid', userId: 'user-001' }),
      })
      mockGetBalance.mockResolvedValueOnce(0)
      mockActivateOrderSubscription.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: {
          sign: 'ok',
          trade_status: 'TRADE_SUCCESS',
          out_trade_no: 'EDU001',
          trade_no: 'ALI001',
          // 2026-07-24 安全加固:total_amount 必须与订单金额一致(100.00 元 = 10000 分)
          total_amount: '100.00',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('success')
      expect(mockCompleteOrder).toHaveBeenCalledWith('EDU001', 'ALI001')
    })
  })

  describe('POST /api/payments/alipay/refund', () => {
    it('订单状态非 paid 返回 400', async () => {
      authAs()
      mockGetOrder.mockResolvedValueOnce(makeOrder({ status: 'pending', userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/refund?outTradeNo=EDU001&refundAmount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('退款失败返回 500', async () => {
      authAs()
      mockIsAlipayConfigured.mockReturnValue(true)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ status: 'paid', userId: 'user-001' }))
      mockAliRefundOrder.mockResolvedValueOnce({ success: false })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/refund?outTradeNo=EDU001&refundAmount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(500)
    })

    it('退款成功返回 200', async () => {
      authAs()
      mockIsAlipayConfigured.mockReturnValue(true)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ status: 'paid', userId: 'user-001' }))
      mockAliRefundOrder.mockResolvedValueOnce({ success: true })
      mockRefundOrder.mockResolvedValueOnce({ success: true })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/refund?outTradeNo=EDU001&refundAmount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockAliRefundOrder).toHaveBeenCalled()
    })
  })

  // ===================== 基金/对账 =====================

  describe('POST /api/payments/transfer (银行卡提现)', () => {
    it('缺少 bankAccount 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/transfer?amount=100',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('提现申请成功返回 200', async () => {
      authAs()
      mockApplyWithdrawal.mockResolvedValueOnce({ id: 'flow-001', amount: 100 })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/transfer?amount=100&bankAccount=6222000&bankName=ICBC',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.id).toBe('flow-001')
      expect(mockApplyWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001', method: 'bank' }),
        'user-001',
      )
    })
  })

  describe('GET /api/payments/success', () => {
    it('无 orderNo 仍返回 200(orderNo 为 optional)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/payments/success' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.msg).toBe('Payment success')
    })

    it('携带 orderNo 返回 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/success?orderNo=EDU001',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.orderNo).toBe('EDU001')
    })
  })

  describe('GET /api/payments/fail', () => {
    it('始终返回 500', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/payments/fail' })
      expect(res.statusCode).toBe(500)
      expect(res.json().message).toContain('Payment failed')
    })
  })

  describe('GET /api/payments/reconciliation/pending', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/reconciliation/pending',
      })
      expect(res.statusCode).toBe(401)
    })

    it('返回待处理订单列表', async () => {
      authAs()
      mockQueryPendingOrders.mockResolvedValueOnce([makeOrder({ status: 'pending' })])
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/reconciliation/pending',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.count).toBe(1)
    })
  })

  describe('POST /api/payments/reconciliation/close_expired', () => {
    it('无待处理订单返回空清单', async () => {
      authAs()
      mockQueryPendingOrders.mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/reconciliation/close_expired',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.scanned).toBe(0)
      expect(body.data.closed).toEqual([])
    })

    it('过期订单关闭成功', async () => {
      authAs()
      mockQueryPendingOrders.mockResolvedValueOnce([
        makeOrder({ orderNo: 'EDU001', paymentMethod: 'wechat' }),
      ])
      mockCancelOrder.mockResolvedValueOnce({ success: true })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/reconciliation/close_expired',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.closed).toContain('EDU001')
      expect(mockCancelOrder).toHaveBeenCalledWith('EDU001')
    })

    it('关闭过程抛错记入 failed', async () => {
      authAs()
      mockIsWechatPayConfigured.mockReturnValue(true) // 触发 wxCloseOrder 调用
      mockQueryPendingOrders.mockResolvedValueOnce([
        makeOrder({ orderNo: 'EDU002', paymentMethod: 'wechat' }),
      ])
      mockWxCloseOrder.mockRejectedValueOnce(new Error('close failed'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/reconciliation/close_expired',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.failed).toHaveLength(1)
      expect(res.json().data.failed[0].outTradeNo).toBe('EDU002')
      expect(res.json().data.failed[0].error).toContain('close failed')
    })
  })

  // ===================== 管理员对账 =====================

  describe('GET /api/admin/payments/reconciliation/alipay', () => {
    it('非管理员返回 403', async () => {
      authAs('user-001', 0)
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/alipay',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('支付宝未配置返回 mock 模式', async () => {
      authAsAdmin()
      mockIsAlipayConfigured.mockReturnValue(false)
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/alipay',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.mock).toBe(true)
    })

    it('支付宝已配置返回 billUrl', async () => {
      authAsAdmin()
      mockIsAlipayConfigured.mockReturnValue(true)
      mockAliDownloadBillUrl.mockResolvedValueOnce('https://bill.example.com/ali.csv')
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/alipay?billDate=2026-07-22',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.billUrl).toBe('https://bill.example.com/ali.csv')
      expect(res.json().data.billDate).toBe('2026-07-22')
    })
  })

  describe('GET /api/admin/payments/reconciliation/wechat', () => {
    it('管理员获取微信对账单 mock 模式', async () => {
      authAsAdmin()
      mockIsWechatPayConfigured.mockReturnValue(false)
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/wechat',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.mock).toBe(true)
    })

    it('管理员获取微信对账单已配置返回 csv', async () => {
      authAsAdmin()
      mockIsWechatPayConfigured.mockReturnValue(true)
      mockWxDownloadBill.mockResolvedValueOnce('csv,content')
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/wechat?billDate=2026-07-22',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.csv).toBe('csv,content')
    })
  })

  describe('GET /api/admin/payments/reconciliation/all', () => {
    it('两个平台都未配置返回仅 billDate', async () => {
      authAsAdmin()
      mockIsAlipayConfigured.mockReturnValue(false)
      mockIsWechatPayConfigured.mockReturnValue(false)
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/all',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.billDate).toBeTruthy()
      expect(data.alipay).toBeUndefined()
      expect(data.wechat).toBeUndefined()
    })

    it('微信下载抛错记入 wechatError', async () => {
      authAsAdmin()
      mockIsAlipayConfigured.mockReturnValue(false)
      mockIsWechatPayConfigured.mockReturnValue(true)
      mockWxDownloadBill.mockRejectedValueOnce(new Error('wx error'))
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/payments/reconciliation/all',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.wechatError).toContain('wx error')
    })
  })
})
