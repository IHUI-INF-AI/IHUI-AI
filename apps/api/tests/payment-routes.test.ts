import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock ----------
const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// ---------- order-queries mock(P0 越权 + 状态机修复的 DB 层) ----------
const {
  mockFindOrderByOrderNo,
  mockFindPaymentByOrderId,
  mockFindRefundById,
  mockCancelOrder,
  mockApplyRefund,
  mockProcessRefund,
  mockHandleRefund,
} = vi.hoisted(() => ({
  mockFindOrderByOrderNo: vi.fn(),
  mockFindPaymentByOrderId: vi.fn(),
  mockFindRefundById: vi.fn(),
  mockCancelOrder: vi.fn(),
  mockApplyRefund: vi.fn(),
  mockProcessRefund: vi.fn(),
  mockHandleRefund: vi.fn(),
}))

vi.mock('../src/db/order-queries.js', () => ({
  findOrderByOrderNo: mockFindOrderByOrderNo,
  findPaymentByOrderId: mockFindPaymentByOrderId,
  findRefundById: mockFindRefundById,
  cancelOrder: mockCancelOrder,
  applyRefund: mockApplyRefund,
  processRefund: mockProcessRefund,
  handleRefund: mockHandleRefund,
}))

import paymentRoutes from '../src/routes/user/payment-routes'
import { userAuthPreHandler } from '../src/routes/user/_shared'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-id-001',
    orderNo: 'EDU20260802000000ABCDEF',
    userId: 'user-001',
    orderType: 2,
    productId: null,
    amount: 10000,
    status: 'pending',
    paymentMethod: 'wechat',
    ...overrides,
  }
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-id-001',
    orderId: 'order-id-001',
    userId: 'user-001',
    status: 'pending',
    ...overrides,
  }
}

function makeRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: 'refund-id-001',
    refundNo: 'REF20260802000000ABCDEF',
    orderId: 'order-id-001',
    orderNo: 'EDU20260802000000ABCDEF',
    userId: 'user-001',
    status: 'pending',
    refundAmount: 10000,
    ...overrides,
  }
}

describe('payment-routes — P0 越权 + 退款状态机回归(2026-08-02 修复)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 与生产 server.ts 一致的 errorHandler(Zod 错误 → 400)
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
    // 与生产一致:user 子路由统一鉴权 preHandler(authenticate 注入 request.userId/jwtPayload)
    app.addHook('preHandler', userAuthPreHandler)
    await app.register(paymentRoutes, { prefix: '/api' })
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

  // ===================== 未登录 =====================

  describe('未登录访问全部端点 → 401', () => {
    it('POST /api/payment/order/:orderNo/close 未登录 → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/order/EDU20260802000000ABCDEF/close',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/refunds/apply 未登录 → 401', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/refunds/apply' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ===================== 订单归属校验(P0 越权修复) =====================

  describe('订单归属校验(P0:任何已登录用户可查看/关闭他人订单)', () => {
    it('用户关闭他人订单 → 403', async () => {
      authAs('user-001')
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder({ userId: 'user-002' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/order/EDU20260802000000ABCDEF/close',
      })
      expect(res.statusCode).toBe(403)
      expect(mockCancelOrder).not.toHaveBeenCalled()
    })

    it('用户关闭自己的订单 → 200', async () => {
      authAs('user-001')
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder())
      mockCancelOrder.mockResolvedValueOnce(makeOrder({ status: 'cancelled' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/order/EDU20260802000000ABCDEF/close',
      })
      expect(res.statusCode).toBe(200)
      expect(mockCancelOrder).toHaveBeenCalledWith('order-id-001')
    })

    it('管理员可关闭任意用户订单 → 200', async () => {
      authAsAdmin()
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder({ userId: 'user-002' }))
      mockCancelOrder.mockResolvedValueOnce(makeOrder({ status: 'cancelled' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/order/EDU20260802000000ABCDEF/close',
      })
      expect(res.statusCode).toBe(200)
    })

    it('订单不存在 → 404', async () => {
      authAs()
      mockFindOrderByOrderNo.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/order/EDU20260802000000ABCDEF/close',
      })
      expect(res.statusCode).toBe(404)
    })

    it('用户查看他人订单 → 403', async () => {
      authAs('user-001')
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder({ userId: 'user-002' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/orders/EDU20260802000000ABCDEF',
      })
      expect(res.statusCode).toBe(403)
    })

    it('用户查看自己的订单 → 200', async () => {
      authAs('user-001')
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/orders/EDU20260802000000ABCDEF',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.order.orderNo).toBe('EDU20260802000000ABCDEF')
    })
  })

  // ===================== 退款归属校验(P0 越权修复) =====================

  describe('退款归属校验(P0:可查看/操作他人退款)', () => {
    it('用户查看他人退款 → 403', async () => {
      authAs('user-001')
      mockFindRefundById.mockResolvedValueOnce(makeRefund({ userId: 'user-002' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/refund/refund-id-001',
      })
      expect(res.statusCode).toBe(403)
    })

    it('用户查看自己的退款 → 200', async () => {
      authAs('user-001')
      mockFindRefundById.mockResolvedValueOnce(makeRefund())
      const res = await app.inject({
        method: 'GET',
        url: '/api/payment/refund/refund-id-001',
      })
      expect(res.statusCode).toBe(200)
    })

    it('用户撤销他人退款 → 403', async () => {
      authAs('user-001')
      mockFindRefundById.mockResolvedValueOnce(makeRefund({ userId: 'user-002' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/cancel',
      })
      expect(res.statusCode).toBe(403)
      expect(mockProcessRefund).not.toHaveBeenCalled()
    })
  })

  // ===================== 退款状态机(P0 状态机修复) =====================

  describe('退款状态机(P0:已 approved/rejected/completed 的退款可被撤销)', () => {
    it('撤销 pending 退款 → 200', async () => {
      authAs('user-001')
      mockFindRefundById.mockResolvedValueOnce(makeRefund())
      mockProcessRefund.mockResolvedValueOnce(makeRefund({ status: 'rejected' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/cancel',
      })
      expect(res.statusCode).toBe(200)
      expect(mockProcessRefund).toHaveBeenCalledWith('refund-id-001', 'rejected', '用户取消')
    })

    it('撤销 approved 退款 → 400(状态不允许)', async () => {
      authAs('user-001')
      mockFindRefundById.mockResolvedValueOnce(makeRefund({ status: 'approved' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/cancel',
      })
      expect(res.statusCode).toBe(400)
      expect(mockProcessRefund).not.toHaveBeenCalled()
    })

    it('撤销 completed 退款 → 400(资金已退还,不可逆)', async () => {
      authAs('user-001')
      mockFindRefundById.mockResolvedValueOnce(makeRefund({ status: 'completed' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/cancel',
      })
      expect(res.statusCode).toBe(400)
      expect(mockProcessRefund).not.toHaveBeenCalled()
    })
  })

  // ===================== 管理员权限(P0 越权修复) =====================

  describe('管理员权限(P0:用户可自行审核/处理自己的退款)', () => {
    it('非管理员调用 audit → 403', async () => {
      authAs('user-001')
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/audit',
        payload: { action: 'approved' },
      })
      expect(res.statusCode).toBe(403)
      expect(mockProcessRefund).not.toHaveBeenCalled()
    })

    it('非管理员调用 process → 403', async () => {
      authAs('user-001')
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/process',
        payload: { status: 'completed' },
      })
      expect(res.statusCode).toBe(403)
      expect(mockHandleRefund).not.toHaveBeenCalled()
    })

    it('管理员 audit → 200', async () => {
      authAsAdmin()
      mockFindRefundById.mockResolvedValueOnce(makeRefund())
      mockProcessRefund.mockResolvedValueOnce(makeRefund({ status: 'approved' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/audit',
        payload: { action: 'approved', reason: '核对无误' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockProcessRefund).toHaveBeenCalledWith('refund-id-001', 'approved', '核对无误')
    })

    it('管理员 process(completed)→ 200', async () => {
      authAsAdmin()
      mockFindRefundById.mockResolvedValueOnce(makeRefund())
      mockHandleRefund.mockResolvedValueOnce(makeRefund({ status: 'completed' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/refund/refund-id-001/process',
        payload: { status: 'completed' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockHandleRefund).toHaveBeenCalledWith('refund-id-001', 'completed', null)
    })
  })

  // ===================== /top_up/status(P0 越权修复 + 路由契约) =====================

  describe('GET /api/top_up/status/:orderId', () => {
    it('查询他人支付记录 → 403', async () => {
      authAs('user-001')
      mockFindPaymentByOrderId.mockResolvedValueOnce(makePayment({ userId: 'user-002' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/top_up/status/order-id-001',
      })
      expect(res.statusCode).toBe(403)
    })

    it('查询自己的支付记录 → 200', async () => {
      authAs('user-001')
      mockFindPaymentByOrderId.mockResolvedValueOnce(makePayment())
      const res = await app.inject({
        method: 'GET',
        url: '/api/top_up/status/order-id-001',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.status).toBe('pending')
    })

    it('支付记录不存在 → 404', async () => {
      authAs('user-001')
      mockFindPaymentByOrderId.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'GET',
        url: '/api/top_up/status/order-id-001',
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ===================== /refunds/apply =====================

  describe('POST /api/refunds/apply', () => {
    it('缺少 orderId → 400', async () => {
      authAs('user-001')
      const res = await app.inject({
        method: 'POST',
        url: '/api/refunds/apply',
        payload: { reason: '不想要了' },
      })
      expect(res.statusCode).toBe(400)
      expect(mockApplyRefund).not.toHaveBeenCalled()
    })

    it('订单不存在 → 400', async () => {
      authAs('user-001')
      mockApplyRefund.mockResolvedValueOnce({ reason: 'order_not_found' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/refunds/apply',
        payload: { orderId: 'order-id-001' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('成功申请退款 → 201', async () => {
      authAs('user-001')
      mockApplyRefund.mockResolvedValueOnce({ refund: makeRefund() })
      const res = await app.inject({
        method: 'POST',
        url: '/api/refunds/apply',
        payload: { orderId: 'order-id-001', reason: '质量问题', refundType: 'original' },
      })
      expect(res.statusCode).toBe(201)
      expect(mockApplyRefund).toHaveBeenCalledWith({
        orderId: 'order-id-001',
        userId: 'user-001',
        reason: '质量问题',
        refundType: 'original',
      })
    })
  })
})
