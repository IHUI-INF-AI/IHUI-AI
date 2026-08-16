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
  mockVerifyCallbackSignature,
  mockDecryptCallback,
  mockWxQueryOrder,
  mockWxCloseOrder,
  mockWxRefund,
} = vi.hoisted(() => ({
  mockIsWechatPayConfigured: vi.fn().mockReturnValue(false),
  mockJsapiPrepay: vi.fn(),
  mockVerifyCallbackSignature: vi.fn(),
  mockDecryptCallback: vi.fn(),
  mockWxQueryOrder: vi.fn(),
  mockWxCloseOrder: vi.fn(),
  mockWxRefund: vi.fn(),
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: mockIsWechatPayConfigured,
  jsapiPrepay: mockJsapiPrepay,
  appPrepay: vi.fn(),
  h5Prepay: vi.fn(),
  nativePrepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  verifyCallbackSignature: mockVerifyCallbackSignature,
  decryptCallback: mockDecryptCallback,
  queryOrder: mockWxQueryOrder,
  closeOrder: mockWxCloseOrder,
  refund: mockWxRefund,
  downloadBill: vi.fn(),
}))

// ---------- 支付宝 mock ----------
const { mockIsAlipayConfigured, mockVerifyNotify, mockAliRefundOrder } = vi.hoisted(() => ({
  mockIsAlipayConfigured: vi.fn().mockReturnValue(false),
  mockVerifyNotify: vi.fn(),
  mockAliRefundOrder: vi.fn(),
}))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: mockIsAlipayConfigured,
  buildSignedUrl: vi.fn(),
  appPayOrder: vi.fn(),
  verifyNotify: mockVerifyNotify,
  queryOrder: vi.fn(),
  refundOrder: mockAliRefundOrder,
  closeOrder: vi.fn(),
  downloadBillUrl: vi.fn(),
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

// ---------- DB mock(用于 resolveProductAmountCents / 课程金额反查)----------
// 模拟 drizzle 链式调用:db.select(...).from(...).where(...).limit(...) / .orderBy(...).limit(...)
const { mockDbRows, mockDb } = vi.hoisted(() => {
  const rows: unknown[] = []
  const limitFn = vi.fn(async () => rows)
  const orderByFn = vi.fn(() => ({ limit: limitFn }))
  const whereFn = vi.fn(() => ({ limit: limitFn, orderBy: orderByFn }))
  const fromFn = vi.fn(() => ({ where: whereFn }))
  const selectFn = vi.fn(() => ({ from: fromFn }))
  return { mockDbRows: rows, mockDb: { select: selectFn } }
})

vi.mock('../src/db/index.js', () => ({ db: mockDb }))

import { paymentGatewayRoutes } from '../src/routes/payment-gateway'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-id-001',
    orderNo: 'EDU20260726000000ABCDEF',
    userId: 'user-001',
    orderType: 0,
    productId: null,
    amount: 10000, // 100 元(单位:分)
    status: 'pending',
    paymentMethod: 'wechat',
    ...overrides,
  }
}

describe('payment gateway — 高风险安全路由(金额篡改/反查/提现/退款)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 模拟生产环境 server.ts 的 errorHandler
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
    app.decorate('paymentIdempotency', {
      acquire: vi.fn().mockResolvedValue({ status: 'new' }),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    })
    await app.register(paymentGatewayRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 DB mock 行
    mockDbRows.length = 0
    // 默认未登录
    mockAuthenticate.mockImplementation(() => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    mockIsWechatPayConfigured.mockReturnValue(false)
    mockIsAlipayConfigured.mockReturnValue(false)
    // 重置 idempotency 默认值
    ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'new',
    })
    ;(app.paymentIdempotency.complete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(app.paymentIdempotency.fail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockAuthenticate.mockImplementation(
      (request: { userId?: string; jwtPayload?: { userId: string; roleId: number } }) => {
        request.userId = userId
        request.jwtPayload = { userId, roleId }
        return Promise.resolve(request.jwtPayload)
      },
    )
  }

  function authAsAdmin(userId = 'admin-001') {
    authAs(userId, 1)
  }

  // ===================== 金额上限(CWE-841)=====================

  describe('POST /api/payments/wechat/create 金额上限', () => {
    it('金额超过 100 万元(100_000_000 分)返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100000001&openId=oxxx',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('上限')
    })

    it('金额等于上限(100_000_000 分)通过校验进入下单', async () => {
      authAs()
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 100000000 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100000000&openId=oxxx',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 100000000 }))
    })

    it('负金额返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=-100&openId=oxxx',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('金额必须为正')
    })
  })

  // ===================== VIP 商品金额反查(CWE-994)=====================

  describe('POST /api/payments/wechat/create VIP 金额服务端反查(orderType=2)', () => {
    it('DB 金额与客户端不一致时采用 DB 金额(防篡改)', async () => {
      authAs()
      // 客户端传 1 分,DB 反查 10000 分(100 元)
      mockDbRows.push({ price: 10000, status: 1 })
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 10000, orderType: 2 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=1&openId=oxxx&orderType=2&productId=vip-001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      // placeOrder 应使用 DB 金额 10000 而非客户端 1
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10000, productId: 'vip-001' }),
      )
    })

    it('VIP 商品不存在或已下架(status!=1)使用客户端金额', async () => {
      authAs()
      // DB 返回空(商品不存在)
      mockDbRows.length = 0
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 500 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=500&openId=oxxx&orderType=2&productId=vip-999',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 500 }))
    })

    it('VIP DB 反查金额超过上限返回 400', async () => {
      authAs()
      mockDbRows.push({ price: 100000001, status: 1 })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/create?amount=100&openId=oxxx&orderType=2&productId=vip-002',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('上限')
    })
  })

  // ===================== Developer 套餐金额反查 =====================

  describe('POST /api/payments/wechat/native Developer 套餐反查(orderType=5)', () => {
    it('开发者套餐 DB 金额(元转分)与客户端不一致时采用 DB 金额', async () => {
      authAs()
      // DB 存储 99.99 元 = 9999 分
      mockDbRows.push({ price: '99.99', status: 1 })
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 9999, orderType: 5 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/native?amount=1&orderType=5&productId=dev-001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      // 99.99 元 → 9999 分(round(99.99*100))
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9999, payType: 'wechat_native' }),
      )
    })
  })

  // ===================== 课程支付金额反查 =====================

  describe('POST /api/payments/wechat/course/create 课程金额反查', () => {
    it('无效 courseId(非数字)返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/course/create?amount=100&courseId=abc',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('courseId')
    })

    it('courseId<=0 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/course/create?amount=100&courseId=0',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('课程有视频价格记录时采用 DB 金额(忽略客户端 amount)', async () => {
      authAs()
      // DB 反查:课程视频金额 50.00 元 = 5000 分,isPay=1
      mockDbRows.push({ amount: 50.0, isPay: 1 })
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 5000, orderType: 1 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/course/create?amount=9999&courseId=123',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      // placeOrder 应使用 DB 金额 5000 而非客户端 9999
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5000, orderType: 1, productId: '123' }),
      )
    })

    it('课程免费(isPay=0)使用客户端金额', async () => {
      authAs()
      mockDbRows.push({ amount: 0, isPay: 0 })
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 100 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/course/create?amount=100&courseId=456',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }))
    })

    it('课程无视频价格记录使用客户端金额', async () => {
      authAs()
      mockDbRows.length = 0
      mockPlaceOrder.mockResolvedValueOnce(makeOrder({ amount: 200 }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/course/create?amount=200&courseId=789',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 200 }))
    })
  })

  // ===================== wechatPay 基金支付金额反查(CWE-994)=====================

  describe('POST /api/payments/wechatPay 基金支付金额反查', () => {
    it('totalFee 与订单金额不一致时采用 DB 订单金额', async () => {
      authAs()
      mockIsWechatPayConfigured.mockReturnValue(true)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ amount: 10000 }))
      mockJsapiPrepay.mockResolvedValueOnce('prepay_id_xxx')
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechatPay?outTradeNo=EDU001&totalFee=1',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      // jsapiPrepay 应使用 DB 订单金额 10000 而非客户端 totalFee=1
      expect(mockJsapiPrepay).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10000, outTradeNo: 'EDU001' }),
      )
    })

    it('订单不存在返回 404', async () => {
      authAs()
      mockIsWechatPayConfigured.mockReturnValue(true)
      mockGetOrder.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechatPay?outTradeNo=NOPE&totalFee=100',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ===================== 退款金额校验(CWE-841)=====================

  describe('POST /api/payments/alipay/refund 退款金额校验', () => {
    it('退款金额超过订单金额返回 400', async () => {
      authAs()
      // 订单金额 10000 分(100 元),退款 200 元(>100 元)
      mockGetOrder.mockResolvedValueOnce(
        makeOrder({ status: 'paid', userId: 'user-001', amount: 10000 }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/refund?outTradeNo=EDU001&refundAmount=200.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('超过订单金额')
    })

    it('退款金额等于订单金额通过校验', async () => {
      authAs()
      mockIsAlipayConfigured.mockReturnValue(true)
      mockGetOrder.mockResolvedValueOnce(
        makeOrder({ status: 'paid', userId: 'user-001', amount: 10000 }),
      )
      mockAliRefundOrder.mockResolvedValueOnce({ success: true })
      mockRefundOrder.mockResolvedValueOnce({ success: true })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/refund?outTradeNo=EDU001&refundAmount=100.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockAliRefundOrder).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmount: 100 }),
      )
    })

    it('非管理员非本人退款返回 403', async () => {
      authAs('user-002', 0)
      mockGetOrder.mockResolvedValueOnce(
        makeOrder({ status: 'paid', userId: 'user-001', amount: 10000 }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/refund?outTradeNo=EDU001&refundAmount=50.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  // ===================== 提现余额校验(CWE-841)=====================

  describe('POST /api/payments/withdrawal 微信提现余额校验', () => {
    it('提现金额超过余额返回 400', async () => {
      authAs()
      mockGetBalance.mockResolvedValueOnce(100)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/withdrawal?amount=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('余额')
      expect(mockApplyWithdrawal).not.toHaveBeenCalled()
    })

    it('提现金额等于余额通过校验', async () => {
      authAs()
      mockGetBalance.mockResolvedValueOnce(500)
      mockApplyWithdrawal.mockResolvedValueOnce({ id: 'flow-001', amount: 500 })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/withdrawal?amount=500',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockApplyWithdrawal).toHaveBeenCalled()
    })
  })

  describe('POST /api/payments/transfer 银行卡提现余额校验', () => {
    it('提现金额超过余额返回 400', async () => {
      authAs()
      mockGetBalance.mockResolvedValueOnce(50)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/transfer?amount=100&bankAccount=6222000&bankName=ICBC',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('余额')
    })
  })

  // ===================== 微信回调安全(签名/金额/幂等)=====================

  describe('POST /api/payments/wechat/notify 回调安全', () => {
    it('回调金额与订单金额不一致返回 FAIL(防金额篡改)', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        transaction_id: 'TX001',
        amount: { total: 9999 }, // 回调金额 9999 分
      })
      // 订单金额 10000 分,与回调 9999 不一致
      mockGetOrder.mockResolvedValueOnce(makeOrder({ amount: 10000 }))
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
      expect(res.json().message).toContain('金额不匹配')
      expect(mockCompleteOrder).not.toHaveBeenCalled()
    })

    it('回调订单不存在返回 FAIL', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        transaction_id: 'TX001',
      })
      mockGetOrder.mockResolvedValueOnce(undefined)
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
      expect(res.json().message).toContain('订单不存在')
    })

    it('回调缺少 transaction_id 返回 FAIL(防重复支付)', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        // 无 transaction_id
      })
      mockGetOrder.mockResolvedValueOnce(makeOrder({ amount: 10000 }))
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
      expect(res.json().message).toContain('transaction_id')
    })

    it('回调幂等(processing 状态返回 SUCCESS)', async () => {
      mockVerifyCallbackSignature.mockReturnValueOnce(true)
      mockDecryptCallback.mockReturnValueOnce({
        out_trade_no: 'EDU001',
        trade_state: 'SUCCESS',
        transaction_id: 'TX001',
      })
      mockGetOrder.mockResolvedValueOnce(makeOrder({ amount: 10000 }))
      ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'processing',
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
      expect(res.json().message).toContain('processing')
      expect(mockCompleteOrder).not.toHaveBeenCalled()
    })
  })

  // ===================== 支付宝回调安全 =====================

  describe('POST /api/payments/alipay/notify 回调安全', () => {
    it('回调金额与订单金额不一致返回 fail(防金额篡改)', async () => {
      mockVerifyNotify.mockReturnValueOnce(true)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ amount: 10000 })) // 100 元
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: {
          sign: 'ok',
          trade_status: 'TRADE_SUCCESS',
          out_trade_no: 'EDU001',
          trade_no: 'ALI001',
          total_amount: '99.99', // 99.99 元 ≠ 100 元
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('fail')
      expect(mockCompleteOrder).not.toHaveBeenCalled()
    })

    it('回调订单不存在返回 fail', async () => {
      mockVerifyNotify.mockReturnValueOnce(true)
      mockGetOrder.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: {
          sign: 'ok',
          trade_status: 'TRADE_SUCCESS',
          out_trade_no: 'NOPE',
          trade_no: 'ALI001',
          total_amount: '100.00',
        },
      })
      expect(res.body).toBe('fail')
    })

    it('回调幂等(completed 状态返回 success)', async () => {
      mockVerifyNotify.mockReturnValueOnce(true)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ amount: 10000 }))
      ;(app.paymentIdempotency.acquire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'completed',
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: {
          sign: 'ok',
          trade_status: 'TRADE_SUCCESS',
          out_trade_no: 'EDU001',
          trade_no: 'ALI001',
          total_amount: '100.00',
        },
      })
      expect(res.body).toBe('success')
      expect(mockCompleteOrder).not.toHaveBeenCalled()
    })
  })

  // ===================== 支付宝小程序 buyerId 降级 =====================

  describe('POST /api/payments/alipay/miniapp/create buyerId 降级', () => {
    it('支付宝未配置返回 mock 模式', async () => {
      authAs()
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/miniapp/create?amount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.mock).toBe(true)
    })

    it('支付宝已配置但缺 buyerId 降级 mock(reason=missing_buyer_id)', async () => {
      authAs()
      mockIsAlipayConfigured.mockReturnValue(true)
      mockPlaceOrder.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/miniapp/create?amount=10.00',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.mock).toBe(true)
      expect(data.reason).toBe('missing_buyer_id')
    })
  })

  // ===================== 订单查询权限(IDOR 防护)=====================

  describe('POST /api/payments/wechat/query IDOR 防护', () => {
    it('管理员可查询他人订单返回 200', async () => {
      authAsAdmin()
      mockGetOrder.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/query?outTradeNo=EDU001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
    })

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
  })

  describe('POST /api/payments/wechat/close 关闭订单权限', () => {
    it('非本人非管理员返回 403', async () => {
      authAs('user-002', 0)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/close?outTradeNo=EDU001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('本人关闭订单返回 200', async () => {
      authAs('user-001', 0)
      mockGetOrder.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      mockCancelOrder.mockResolvedValueOnce({ success: true })
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/close?outTradeNo=EDU001',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockCancelOrder).toHaveBeenCalledWith('EDU001')
    })
  })
})
