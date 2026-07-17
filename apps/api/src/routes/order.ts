import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  createOrder,
  findOrderById,
  cancelOrder,
  findOrders,
  createPayment,
  findPaymentById,
  cancelPayment,
  findPayments,
  applyRefund,
  findRefundById,
  processRefund,
  handleRefund,
  findRefunds,
  findInvoiceTitles,
  createInvoiceTitle,
  updateInvoiceTitle,
  deleteInvoiceTitle,
  createInvoiceApplication,
  updateInvoiceApplication,
  findInvoiceApplicationById,
  deleteInvoiceApplication,
  findInvoiceApplications,
} from '../db/order-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { completeOrderWithSaga } from '../services/order-service.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listOrdersQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
  orderType: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  orderNo: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
})

const listPaymentsQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
  orderId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const listRefundsQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
  orderId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const listInvoiceAppsQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
})

const priceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
  .optional()

const createOrderSchema = z.object({
  orderType: z.string().min(1).max(32),
  targetId: z.string().max(64).nullable().optional(),
  targetTitle: z.string().max(200).nullable().optional(),
  quantity: z.number().int().min(1).optional(),
  originalPrice: priceSchema,
  discountAmount: priceSchema,
  payAmount: priceSchema,
  payType: z.string().max(50).nullable().optional(),
  remark: z.string().max(500).nullable().optional(),
})

const createPaymentSchema = z.object({
  payType: z.string().min(1).max(50),
  payAmount: priceSchema,
  payUrl: z.string().max(500).nullable().optional(),
})

const applyRefundSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
  refundAmount: priceSchema,
  refundType: z.string().max(32).optional(),
})

const processRefundSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  processMessage: z.string().max(500).nullable().optional(),
})

const handleRefundSchema = z.object({
  status: z.enum(['processing', 'completed', 'failed']),
  handleMessage: z.string().max(500).nullable().optional(),
})

const invoiceTitleBodySchema = z.object({
  title: z.string().min(1).max(200),
  titleType: z.string().max(16).optional(),
  taxNo: z.string().max(50).nullable().optional(),
  bank: z.string().max(200).nullable().optional(),
  bankAccount: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
})

const updateInvoiceTitleSchema = invoiceTitleBodySchema.partial()

const createInvoiceAppSchema = z.object({
  orderId: z.string().uuid().nullable().optional(),
  invoiceType: z.string().max(16).optional(),
  titleId: z.string().uuid().nullable().optional(),
  amount: priceSchema,
  email: z.string().max(100).nullable().optional(),
  remark: z.string().max(500).nullable().optional(),
})

const updateInvoiceAppSchema = z.object({
  invoiceType: z.string().max(16).optional(),
  titleId: z.string().uuid().nullable().optional(),
  amount: priceSchema,
  email: z.string().max(100).nullable().optional(),
  remark: z.string().max(500).nullable().optional(),
  status: z.string().max(16).optional(),
})

const invoiceAppStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'invoicing', 'invoiced', 'canceled']),
})

// Saga 订单完成请求：orderNo + 可选 tradeNo
const completeOrderSagaSchema = z.object({
  orderNo: z.string().min(1).max(64),
  tradeNo: z.string().max(128).optional(),
})

// =============================================================================
// 响应 schema 片段（data 字段统一 additionalProperties: true 防 fast-json-stringify 剥离）
// =============================================================================

const okResponse = {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  403: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
}

const createdResponse = {
  201: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
}

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

// =============================================================================
// 用户路由（前缀 /api，需登录）
// =============================================================================

export const orderRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // ===== 订单 =====

  // POST /orders - 创建订单
  server.post(
    '/orders',
    {
      schema: {
        summary: '创建订单',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = createOrderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const order = await createOrder({ userId: request.userId!, ...parsed.data })
      return reply.status(201).send(success({ order }))
    },
  )

  // GET /orders/me - 我的订单
  server.get(
    '/orders/me',
    {
      schema: {
        summary: '我的订单',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            orderType: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listOrdersQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findOrders({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // GET /orders/:id - 订单详情（仅本人或管理员）
  server.get(
    '/orders/:id',
    { schema: { summary: '订单详情', tags: ['order'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const order = await findOrderById(parsed.data.id)
      if (!order) return reply.status(404).send(error(404, '订单不存在'))
      const roleId = request.jwtPayload?.roleId ?? 0
      if (order.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
        return reply.status(403).send(error(403, '无权访问该订单'))
      }
      return reply.send(success({ order }))
    },
  )

  // POST /orders/:id/cancel - 取消订单
  server.post(
    '/orders/:id/cancel',
    { schema: { summary: '取消订单', tags: ['order'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findOrderById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '订单不存在'))
      if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      if (existing.status !== 'pending')
        return reply.status(400).send(error(400, '订单状态不允许取消'))
      const order = await cancelOrder(parsed.data.id)
      return reply.send(success({ order }))
    },
  )

  // POST /orders/:id/refund - 申请退款
  server.post(
    '/orders/:id/refund',
    {
      schema: {
        summary: '申请退款',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = applyRefundSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const res = await applyRefund({
        orderId: parsed.data.id,
        userId: request.userId!,
        ...body.data,
      })
      if (res.reason === 'order_not_found') return reply.status(404).send(error(404, '订单不存在'))
      if (res.reason === 'order_not_paid')
        return reply.status(400).send(error(400, '订单未支付, 无法退款'))
      return reply.send(success({ refund: res.refund }))
    },
  )

  // ===== 支付 =====

  // POST /orders/:id/payment - 创建支付
  server.post(
    '/orders/:id/payment',
    {
      schema: {
        summary: '创建支付',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = createPaymentSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const res = await createPayment({
        orderId: parsed.data.id,
        userId: request.userId!,
        ...body.data,
      })
      if (res.reason === 'order_not_found') return reply.status(404).send(error(404, '订单不存在'))
      if (res.reason === 'order_not_pending')
        return reply.status(400).send(error(400, '订单状态不允许支付'))
      return reply.send(success({ payment: res.payment }))
    },
  )

  // GET /payments/me - 我的支付记录
  server.get(
    '/payments/me',
    {
      schema: {
        summary: '我的支付记录',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listPaymentsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findPayments({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // GET /payments/:id - 支付状态
  server.get(
    '/payments/:id',
    { schema: { summary: '支付状态', tags: ['order'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const payment = await findPaymentById(parsed.data.id)
      if (!payment) return reply.status(404).send(error(404, '支付记录不存在'))
      return reply.send(success({ payment }))
    },
  )

  // POST /payments/:id/cancel - 取消支付
  server.post(
    '/payments/:id/cancel',
    { schema: { summary: '取消支付', tags: ['order'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPaymentById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '支付记录不存在'))
      if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      if (existing.status === 'paid' || existing.status === 'cancelled') {
        return reply.status(400).send(error(400, '支付状态不允许取消'))
      }
      const payment = await cancelPayment(parsed.data.id)
      return reply.send(success({ payment }))
    },
  )

  // ===== 退款 =====

  // GET /refunds/me - 我的退款记录
  server.get(
    '/refunds/me',
    {
      schema: {
        summary: '我的退款记录',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listRefundsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findRefunds({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // 注: GET /refunds/:id 已由 refund-audit.ts 真实实现(含审核记录与订单信息),此处不再重复注册

  // ===== 发票抬头 =====

  // GET /invoices/titles - 发票抬头列表
  server.get(
    '/invoices/titles',
    {
      schema: {
        summary: '发票抬头列表',
        tags: ['order'],
        querystring: { type: 'object', properties: { titleType: { type: 'string' } } },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const { titleType } = z.object({ titleType: z.string().optional() }).parse(request.query)
      const list = await findInvoiceTitles(request.userId!, titleType)
      return reply.send(success({ list }))
    },
  )

  // POST /invoices/titles - 创建发票抬头
  server.post(
    '/invoices/titles',
    {
      schema: {
        summary: '创建发票抬头',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = invoiceTitleBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const title = await createInvoiceTitle({ userId: request.userId!, ...parsed.data })
      return reply.status(201).send(success({ title }))
    },
  )

  // PUT /invoices/titles/:id - 更新发票抬头
  server.put(
    '/invoices/titles/:id',
    {
      schema: {
        summary: '更新发票抬头',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = updateInvoiceTitleSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const title = await updateInvoiceTitle(parsed.data.id, body.data)
      if (!title) return reply.status(404).send(error(404, '发票抬头不存在'))
      return reply.send(success({ title }))
    },
  )

  // DELETE /invoices/titles/:id - 删除发票抬头
  server.delete(
    '/invoices/titles/:id',
    { schema: { summary: '删除发票抬头', tags: ['order'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      await deleteInvoiceTitle(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // ===== 发票申请 =====

  // GET /invoices/applications - 我的发票申请
  server.get(
    '/invoices/applications',
    {
      schema: {
        summary: '我的发票申请',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listInvoiceAppsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findInvoiceApplications({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // POST /invoices/applications - 创建发票申请
  server.post(
    '/invoices/applications',
    {
      schema: {
        summary: '创建发票申请',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = createInvoiceAppSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const application = await createInvoiceApplication({
        userId: request.userId!,
        ...parsed.data,
      })
      return reply.status(201).send(success({ application }))
    },
  )

  // PUT /invoices/applications/:id - 更新发票申请
  server.put(
    '/invoices/applications/:id',
    {
      schema: {
        summary: '更新发票申请',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = updateInvoiceAppSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findInvoiceApplicationById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '发票申请不存在'))
      if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      const application = await updateInvoiceApplication(parsed.data.id, body.data)
      return reply.send(success({ application }))
    },
  )

  // DELETE /invoices/applications/:id - 删除发票申请
  server.delete(
    '/invoices/applications/:id',
    { schema: { summary: '删除发票申请', tags: ['order'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findInvoiceApplicationById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '发票申请不存在'))
      if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      await deleteInvoiceApplication(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminOrderRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /admin/orders - 订单列表
  server.get(
    '/orders',
    {
      schema: {
        summary: '订单列表',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            orderType: { type: 'string' },
            userId: { type: 'string' },
            orderNo: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listOrdersQuery
        .extend({ userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()) })
        .safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findOrders(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /admin/orders/complete-saga - M-9 Saga 编排订单完成（支付确认+积分+Outbox）
  server.post(
    '/orders/complete-saga',
    {
      schema: {
        summary: 'Saga 编排订单完成',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = completeOrderSagaSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await completeOrderWithSaga(parsed.data.orderNo, parsed.data.tradeNo, server)
      if (!result.success) {
        return reply.status(400).send(error(400, result.reason ?? '订单完成失败'))
      }
      return reply.send(success({ order: result.order, saga: result.saga }))
    },
  )

  // GET /admin/payments - 支付记录列表
  server.get(
    '/payments',
    {
      schema: {
        summary: '支付记录列表',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            userId: { type: 'string' },
            orderId: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listPaymentsQuery
        .extend({ userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()) })
        .safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findPayments(parsed.data)
      return reply.send(success(result))
    },
  )

  // GET /admin/refunds - 退款列表
  server.get(
    '/refunds',
    {
      schema: {
        summary: '退款列表',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            userId: { type: 'string' },
            orderId: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listRefundsQuery
        .extend({ userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()) })
        .safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findRefunds(parsed.data)
      return reply.send(success(result))
    },
  )

  // PUT /admin/refunds/:id/process - 审核退款
  server.put(
    '/refunds/:id/process',
    {
      schema: {
        summary: '审核退款',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = processRefundSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findRefundById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '退款记录不存在'))
      const refund = await processRefund(parsed.data.id, body.data.status, body.data.processMessage)
      return reply.send(success({ refund }))
    },
  )

  // PUT /admin/refunds/:id/handle - 处理退款
  server.put(
    '/refunds/:id/handle',
    {
      schema: {
        summary: '处理退款',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = handleRefundSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findRefundById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '退款记录不存在'))
      const refund = await handleRefund(parsed.data.id, body.data.status, body.data.handleMessage)
      return reply.send(success({ refund }))
    },
  )

  // GET /admin/invoices/applications - 发票申请列表
  server.get(
    '/invoices/applications',
    {
      schema: {
        summary: '发票申请列表',
        tags: ['order'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listInvoiceAppsQuery
        .extend({ userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()) })
        .safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findInvoiceApplications(parsed.data)
      return reply.send(success(result))
    },
  )

  // PUT /admin/invoices/applications/:id/status - 变更发票申请状态
  server.put(
    '/invoices/applications/:id/status',
    {
      schema: {
        summary: '变更发票申请状态',
        tags: ['order'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = invoiceAppStatusSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findInvoiceApplicationById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '发票申请不存在'))
      const application = await updateInvoiceApplication(parsed.data.id, {
        status: body.data.status,
      })
      return reply.send(success({ application }))
    },
  )
}
