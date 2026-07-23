import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock ----------
const { mockCheckAuth, mockRequireAdmin } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  requirePermission: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

// ---------- order-queries mock ----------
const {
  mockCreateOrder,
  mockFindOrderById,
  mockFindOrderByOrderNo,
  mockCancelOrder,
  mockFindOrders,
  mockCreatePayment,
  mockFindPaymentById,
  mockCancelPayment,
  mockFindPayments,
  mockApplyRefund,
  mockFindRefundById,
  mockProcessRefund,
  mockHandleRefund,
  mockFindRefunds,
  mockFindInvoiceTitles,
  mockCreateInvoiceTitle,
  mockUpdateInvoiceTitle,
  mockDeleteInvoiceTitle,
  mockCreateInvoiceApplication,
  mockUpdateInvoiceApplication,
  mockFindInvoiceApplicationById,
  mockDeleteInvoiceApplication,
  mockFindInvoiceApplications,
} = vi.hoisted(() => ({
  mockCreateOrder: vi.fn(),
  mockFindOrderById: vi.fn(),
  mockFindOrderByOrderNo: vi.fn(),
  mockCancelOrder: vi.fn(),
  mockFindOrders: vi.fn(),
  mockCreatePayment: vi.fn(),
  mockFindPaymentById: vi.fn(),
  mockCancelPayment: vi.fn(),
  mockFindPayments: vi.fn(),
  mockApplyRefund: vi.fn(),
  mockFindRefundById: vi.fn(),
  mockProcessRefund: vi.fn(),
  mockHandleRefund: vi.fn(),
  mockFindRefunds: vi.fn(),
  mockFindInvoiceTitles: vi.fn(),
  mockCreateInvoiceTitle: vi.fn(),
  mockUpdateInvoiceTitle: vi.fn(),
  mockDeleteInvoiceTitle: vi.fn(),
  mockCreateInvoiceApplication: vi.fn(),
  mockUpdateInvoiceApplication: vi.fn(),
  mockFindInvoiceApplicationById: vi.fn(),
  mockDeleteInvoiceApplication: vi.fn(),
  mockFindInvoiceApplications: vi.fn(),
}))

vi.mock('../src/db/order-queries.js', () => ({
  genOrderNo: vi.fn().mockReturnValue('EDU20260723000000ABCDEF'),
  genPaymentNo: vi.fn().mockReturnValue('PAY20260723000000ABCDEF'),
  createOrder: mockCreateOrder,
  findOrderById: mockFindOrderById,
  findOrderByOrderNo: mockFindOrderByOrderNo,
  findPaymentByOrderId: vi.fn(),
  cancelOrder: mockCancelOrder,
  findOrders: mockFindOrders,
  createPayment: mockCreatePayment,
  findPaymentById: mockFindPaymentById,
  cancelPayment: mockCancelPayment,
  findPayments: mockFindPayments,
  applyRefund: mockApplyRefund,
  findRefundById: mockFindRefundById,
  processRefund: mockProcessRefund,
  handleRefund: mockHandleRefund,
  findRefunds: mockFindRefunds,
  findInvoiceTitles: mockFindInvoiceTitles,
  createInvoiceTitle: mockCreateInvoiceTitle,
  updateInvoiceTitle: mockUpdateInvoiceTitle,
  deleteInvoiceTitle: mockDeleteInvoiceTitle,
  createInvoiceApplication: mockCreateInvoiceApplication,
  updateInvoiceApplication: mockUpdateInvoiceApplication,
  findInvoiceApplicationById: mockFindInvoiceApplicationById,
  deleteInvoiceApplication: mockDeleteInvoiceApplication,
  findInvoiceApplications: mockFindInvoiceApplications,
}))

// ---------- order-service / audit-service mock ----------
const { mockCompleteOrderWithSaga, mockLogAction } = vi.hoisted(() => ({
  mockCompleteOrderWithSaga: vi.fn(),
  mockLogAction: vi.fn(),
}))
vi.mock('../src/services/order-service.js', () => ({
  completeOrderWithSaga: mockCompleteOrderWithSaga,
}))
vi.mock('../src/services/audit-service.js', () => ({ logAction: mockLogAction }))

// ---------- db / dbRead / @ihui/database 链式 mock ----------
vi.mock('../src/db/index.js', () => {
  const chain = () => {
    const obj: Record<string, ReturnType<typeof vi.fn>> = {}
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_t, prop) {
        if (prop === 'then' || prop === 'catch') return undefined
        if (!obj[prop as string]) obj[prop as string] = vi.fn().mockReturnValue(proxy)
        return obj[prop as string]
      },
    }
    const proxy = new Proxy({}, handler)
    return proxy
  }
  return {
    db: new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'execute') return vi.fn().mockResolvedValue([])
          return vi.fn().mockReturnValue(chain())
        },
      },
    ),
    dbRead: new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'select') return vi.fn().mockReturnValue(chain())
          return vi.fn().mockReturnValue(chain())
        },
      },
    ),
    returningOne: vi.fn(),
  }
})

vi.mock('@ihui/database', () => ({
  eduOrders: { id: 'id', status: 'status', payAmount: 'payAmount', createdAt: 'createdAt' },
  eduRefunds: { id: 'id', refundAmount: 'refundAmount', status: 'status' },
  users: { id: 'id', nickname: 'nickname', avatar: 'avatar' },
}))

import { orderRoutes, adminOrderRoutes } from '../src/routes/order.js'

const NOW = new Date('2026-07-23T00:00:00Z')
const UUID = '11111111-1111-1111-1111-111111111111'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    orderNo: 'EDU20260723000000ABCDEF',
    userId: 'user-001',
    orderType: 'course',
    targetId: 'course-001',
    targetTitle: '测试课程',
    quantity: 1,
    originalPrice: '100.00',
    discountAmount: '0.00',
    payAmount: '100.00',
    payType: 'wechat',
    status: 'pending',
    remark: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    paymentNo: 'PAY20260723000000ABCDEF',
    orderId: UUID,
    orderType: 'course',
    userId: 'user-001',
    payType: 'wechat',
    payAmount: '100.00',
    payUrl: null,
    status: 'created',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    orderId: UUID,
    orderType: 'course',
    orderNo: 'EDU20260723000000ABCDEF',
    userId: 'user-001',
    reason: '用户申请',
    refundAmount: '100.00',
    refundType: 'original',
    status: 'pending',
    applyTime: NOW,
    processTime: null,
    completeTime: null,
    processMessage: null,
    handleMessage: null,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('order routes', () => {
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
    await app.register(orderRoutes, { prefix: '/api' })
    await app.register(adminOrderRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认鉴权失败(checkAuth 发送 401 并返回 false)
    mockCheckAuth.mockImplementation((_req, reply) => {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return Promise.resolve(false)
    })
    // 默认非管理员
    mockRequireAdmin.mockImplementation((_req, reply) => {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
      return Promise.resolve()
    })
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockCheckAuth.mockImplementation((req, _reply) => {
      req.userId = userId
      req.jwtPayload = { userId, roleId } as never
      return Promise.resolve(true)
    })
  }

  function authAsAdmin(userId = 'admin-001') {
    authAs(userId, 1)
    mockRequireAdmin.mockImplementation((_req, _reply) => Promise.resolve())
  }

  // ===================== 用户路由 =====================

  describe('POST /api/orders', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { orderType: 'course' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('缺少 orderType 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { payType: 'wechat' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('orderType 过长返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { orderType: 'x'.repeat(33) },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('价格格式错误返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { orderType: 'course', payAmount: '10.999' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('创建成功返回 201', async () => {
      authAs()
      mockCreateOrder.mockResolvedValueOnce(makeOrder())
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { orderType: 'course', targetId: 'course-001', payAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.order.orderNo).toBe('EDU20260723000000ABCDEF')
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001', orderType: 'course' }),
      )
    })
  })

  describe('GET /api/orders/me', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/orders/me' })
      expect(res.statusCode).toBe(401)
    })

    it('登录用户返回订单列表', async () => {
      authAs()
      mockFindOrders.mockResolvedValueOnce({ list: [makeOrder()], total: 1, page: 1, pageSize: 20 })
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/me?page=1&pageSize=20',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(1)
      expect(mockFindOrders).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001' }),
      )
    })

    it('pageSize 超过 100 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/me?pageSize=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/orders/:orderNo', () => {
    it('订单号参数为空返回 400', async () => {
      authAs()
      const res = await app.inject({ method: 'GET', url: '/api/orders/' })
      // Fastify 默认 404,空路径不匹配 /:orderNo
      expect([400, 404]).toContain(res.statusCode)
    })

    it('订单不存在返回 404', async () => {
      authAs()
      mockFindOrderByOrderNo.mockResolvedValueOnce(undefined)
      mockFindOrderById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/NOPE',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('订单不存在')
    })

    it('非本人非管理员访问返回 403', async () => {
      authAs('user-002', 0)
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/EDU20260723000000ABCDEF',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('无权访问')
    })

    it('本人查询返回 200', async () => {
      authAs('user-001')
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/EDU20260723000000ABCDEF',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.order.id).toBe(UUID)
    })

    it('管理员访问他人订单返回 200', async () => {
      authAs('admin-001', 1)
      mockFindOrderByOrderNo.mockResolvedValueOnce(makeOrder({ userId: 'user-002' }))
      const res = await app.inject({
        method: 'GET',
        url: '/api/orders/EDU20260723000000ABCDEF',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('POST /api/orders/:id/cancel', () => {
    it('非 UUID 参数返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders/not-a-uuid/cancel',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('订单不存在返回 404', async () => {
      authAs()
      mockFindOrderById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('非本人取消返回 403', async () => {
      authAs('user-002', 0)
      mockFindOrderById.mockResolvedValueOnce(makeOrder({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('订单状态非 pending 返回 400(状态流转校验)', async () => {
      authAs()
      mockFindOrderById.mockResolvedValueOnce(makeOrder({ status: 'paid' }))
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('不允许取消')
    })

    it('pending 订单取消成功返回 200', async () => {
      authAs()
      mockFindOrderById.mockResolvedValueOnce(makeOrder({ status: 'pending' }))
      mockCancelOrder.mockResolvedValueOnce(makeOrder({ status: 'cancelled' }))
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.order.status).toBe('cancelled')
      expect(mockCancelOrder).toHaveBeenCalledWith(UUID)
    })
  })

  describe('POST /api/orders/:id/payment', () => {
    it('缺少 payType 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/payment`,
        payload: { payAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('订单不存在返回 404', async () => {
      authAs()
      mockCreatePayment.mockResolvedValueOnce({ reason: 'order_not_found' })
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/payment`,
        payload: { payType: 'wechat', payAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('订单状态非 pending 返回 400', async () => {
      authAs()
      mockCreatePayment.mockResolvedValueOnce({ reason: 'order_not_pending' })
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/payment`,
        payload: { payType: 'wechat', payAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('不允许支付')
    })

    it('创建支付成功返回 200', async () => {
      authAs()
      mockCreatePayment.mockResolvedValueOnce({ payment: makePayment() })
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/payment`,
        payload: { payType: 'wechat', payAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.payment.payType).toBe('wechat')
    })
  })

  describe('POST /api/orders/:id/refund', () => {
    it('订单不存在返回 404', async () => {
      authAs()
      mockApplyRefund.mockResolvedValueOnce({ reason: 'order_not_found' })
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/refund`,
        payload: { refundAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('订单未支付返回 400(业务规则校验)', async () => {
      authAs()
      mockApplyRefund.mockResolvedValueOnce({ reason: 'order_not_paid' })
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/refund`,
        payload: { refundAmount: '100.00' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('订单未支付')
    })

    it('退款申请成功返回 200', async () => {
      authAs()
      mockApplyRefund.mockResolvedValueOnce({ refund: makeRefund() })
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${UUID}/refund`,
        payload: { refundAmount: '100.00', reason: '不想要了' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.refund.status).toBe('pending')
    })
  })

  describe('POST /api/payments/:id/cancel', () => {
    it('支付记录不存在返回 404', async () => {
      authAs()
      mockFindPaymentById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: `/api/payments/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('非本人取消返回 403', async () => {
      authAs('user-002', 0)
      mockFindPaymentById.mockResolvedValueOnce(makePayment({ userId: 'user-001' }))
      const res = await app.inject({
        method: 'POST',
        url: `/api/payments/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('已支付记录不可取消返回 400(状态校验)', async () => {
      authAs()
      mockFindPaymentById.mockResolvedValueOnce(makePayment({ status: 'paid' }))
      const res = await app.inject({
        method: 'POST',
        url: `/api/payments/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('created 状态可取消返回 200', async () => {
      authAs()
      mockFindPaymentById.mockResolvedValueOnce(makePayment({ status: 'created' }))
      mockCancelPayment.mockResolvedValueOnce(makePayment({ status: 'cancelled' }))
      const res = await app.inject({
        method: 'POST',
        url: `/api/payments/${UUID}/cancel`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.payment.status).toBe('cancelled')
    })
  })

  describe('发票抬头', () => {
    it('POST /api/invoices/titles 缺少 title 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/invoices/titles',
        payload: { titleType: 'company' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/invoices/titles 创建成功返回 201', async () => {
      authAs()
      mockCreateInvoiceTitle.mockResolvedValueOnce({ id: UUID, title: '公司A' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/invoices/titles',
        payload: { title: '公司A', titleType: 'company' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(mockCreateInvoiceTitle).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001', title: '公司A' }),
      )
    })

    it('PUT /api/invoices/titles/:id 抬头不存在返回 404', async () => {
      authAs()
      mockUpdateInvoiceTitle.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/invoices/titles/${UUID}`,
        payload: { title: '新名称' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /api/invoices/titles/:id 删除成功返回 200', async () => {
      authAs()
      mockDeleteInvoiceTitle.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/invoices/titles/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(true)
    })
  })

  describe('发票申请权限校验', () => {
    it('PUT /api/invoices/applications/:id 非本人返回 403', async () => {
      authAs('user-002', 0)
      mockFindInvoiceApplicationById.mockResolvedValueOnce({
        id: UUID,
        userId: 'user-001',
        status: 'pending',
      })
      const res = await app.inject({
        method: 'PUT',
        url: `/api/invoices/applications/${UUID}`,
        payload: { email: 'new@example.com' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('DELETE /api/invoices/applications/:id 申请不存在返回 404', async () => {
      authAs()
      mockFindInvoiceApplicationById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/invoices/applications/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ===================== 管理员路由 =====================

  describe('GET /api/admin/orders (管理员)', () => {
    it('非管理员返回 403', async () => {
      authAs('user-001', 0)
      // requireAdmin 默认会发 403,但 authAs 不会改 requireAdmin,所以保持默认 403
      mockRequireAdmin.mockImplementation((_req, reply) => {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
        return Promise.resolve()
      })
      const res = await app.inject({ method: 'GET', url: '/api/admin/orders' })
      expect(res.statusCode).toBe(403)
    })

    it('管理员获取订单列表返回 200', async () => {
      authAsAdmin()
      mockFindOrders.mockResolvedValueOnce({
        list: [makeOrder({ userId: 'user-001' })],
        total: 1,
        page: 1,
        pageSize: 20,
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/orders?page=1&pageSize=20',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(1)
    })
  })

  describe('POST /api/admin/orders/batch-cancel', () => {
    it('空数组返回 400(至少 1 条)', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orders/batch-cancel',
        payload: { ids: [] },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非 UUID 元素返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orders/batch-cancel',
        payload: { ids: ['not-uuid'] },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /api/admin/orders/complete-saga', () => {
    it('缺少 orderNo 返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orders/complete-saga',
        payload: { tradeNo: 'T001' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('Saga 处理失败返回 400', async () => {
      authAsAdmin()
      mockCompleteOrderWithSaga.mockResolvedValueOnce({
        success: false,
        reason: '订单状态不允许完成',
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orders/complete-saga',
        payload: { orderNo: 'EDU20260723000000ABCDEF' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('订单状态不允许完成')
    })

    it('Saga 成功返回 200', async () => {
      authAsAdmin()
      mockCompleteOrderWithSaga.mockResolvedValueOnce({
        success: true,
        order: makeOrder({ status: 'paid' }),
        saga: { steps: ['payment', 'points', 'outbox'] },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orders/complete-saga',
        payload: { orderNo: 'EDU20260723000000ABCDEF', tradeNo: 'T001' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.saga.steps).toHaveLength(3)
      expect(mockCompleteOrderWithSaga).toHaveBeenCalledWith(
        'EDU20260723000000ABCDEF',
        'T001',
        expect.anything(),
      )
    })
  })

  describe('PUT /api/admin/refunds/:id/process (退款审核)', () => {
    it('无效 status 返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/refunds/${UUID}/process`,
        payload: { status: 'invalid' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('退款记录不存在返回 404', async () => {
      authAsAdmin()
      mockFindRefundById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/refunds/${UUID}/process`,
        payload: { status: 'approved' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('审核通过返回 200', async () => {
      authAsAdmin()
      mockFindRefundById.mockResolvedValueOnce(makeRefund())
      mockProcessRefund.mockResolvedValueOnce(makeRefund({ status: 'approved' }))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/refunds/${UUID}/process`,
        payload: { status: 'approved', processMessage: '同意' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockProcessRefund).toHaveBeenCalledWith(UUID, 'approved', '同意')
    })
  })

  describe('PUT /api/admin/refunds/:id/handle (退款处理)', () => {
    it('无效 status 返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/refunds/${UUID}/handle`,
        payload: { status: 'invalid' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('退款记录不存在返回 404', async () => {
      authAsAdmin()
      mockFindRefundById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/refunds/${UUID}/handle`,
        payload: { status: 'completed' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('处理完成返回 200', async () => {
      authAsAdmin()
      mockFindRefundById.mockResolvedValueOnce(makeRefund())
      mockHandleRefund.mockResolvedValueOnce(makeRefund({ status: 'completed' }))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/refunds/${UUID}/handle`,
        payload: { status: 'completed', handleMessage: '已打款' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockHandleRefund).toHaveBeenCalledWith(UUID, 'completed', '已打款')
    })
  })

  describe('PUT /api/admin/invoices/applications/:id/status', () => {
    it('无效 status 返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/invoices/applications/${UUID}/status`,
        payload: { status: 'invalid' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('申请不存在返回 404', async () => {
      authAsAdmin()
      mockFindInvoiceApplicationById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/invoices/applications/${UUID}/status`,
        payload: { status: 'invoiced' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('状态变更成功返回 200', async () => {
      authAsAdmin()
      mockFindInvoiceApplicationById.mockResolvedValueOnce({ id: UUID, status: 'approved' })
      mockUpdateInvoiceApplication.mockResolvedValueOnce({ id: UUID, status: 'invoiced' })
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/invoices/applications/${UUID}/status`,
        payload: { status: 'invoiced' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockUpdateInvoiceApplication).toHaveBeenCalledWith(UUID, { status: 'invoiced' })
    })
  })
})
