/**
 * USDT 加密货币支付网关路由(2026-08-01 立)。
 *
 * 端点清单:
 * 1. POST   /payment/usdt/create         — 用户创建充值订单(Bearer JWT 鉴权)
 * 2. GET    /payment/usdt/orders         — 用户查询自己的订单(分页)
 * 3. GET    /payment/usdt/order/:id      — 查询订单详情
 * 4. POST   /payment/usdt/callback/:network — 区块链 webhook 回调(无鉴权,验签 TODO)
 * 5. GET    /admin/payment/usdt/orders   — 管理员查询所有订单(requireAdmin)
 * 6. GET    /admin/payment/usdt/config   — 管理员查看配置
 * 7. PATCH  /admin/payment/usdt/config   — 管理员修改配置
 *
 * 复用 payment-usdt-service.ts + system_configs 表(category='usdt_payment')。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import {
  createUsdtPayment,
  listUserUsdtPayments,
  getUsdtPaymentDetail,
  listAllUsdtPayments,
  getUsdtPaymentConfig,
  setUsdtPaymentConfig,
  confirmUsdtPayment,
} from '../services/payment-usdt-service.js'

// =============================================================================
// Zod 校验 schema
// =============================================================================

const createBodySchema = z.object({
  /** 充值金额(分,1 元 = 100 分) */
  amountCents: z.number().int().min(1, '充值金额必须大于 0'),
  /** 链网络 */
  network: z.enum(['TRC20', 'ERC20']),
})

const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const orderIdParamSchema = z.object({
  id: z.string().min(1, '订单 ID 不能为空'),
})

const callbackParamSchema = z.object({
  network: z.enum(['TRC20', 'ERC20']),
})

const callbackBodySchema = z.object({
  orderId: z.string().min(1),
  txHash: z.string().min(1),
  amountPaid: z.number().positive('到账金额必须大于 0'),
})

const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().optional()),
  network: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

const configPatchSchema = z
  .object({
    /** USDT 兑 USD 汇率(> 0) */
    rate: z.number().positive().optional(),
    /** 支持的网络列表 */
    supportedNetworks: z.array(z.string()).min(1).optional(),
  })
  .refine((d) => d.rate !== undefined || d.supportedNetworks !== undefined, {
    message: '至少填写一个配置项(rate / supportedNetworks)',
  })

// =============================================================================
// 路由定义
// =============================================================================

const paymentUsdtRoutes: FastifyPluginAsync = async (server) => {
  // ===== 1. POST /payment/usdt/create — 用户创建充值订单 =====
  server.post(
    '/payment/usdt/create',
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '未登录'))

      const parsed = createBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      try {
        const result = await createUsdtPayment(userId, parsed.data.amountCents, parsed.data.network)
        return reply.status(201).send(success(result))
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
        return reply.status(statusCode).send(error(statusCode, (e as Error).message))
      }
    },
  )

  // ===== 2. GET /payment/usdt/orders — 用户查询自己的订单 =====
  server.get(
    '/payment/usdt/orders',
    { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '未登录'))

      const parsed = ordersQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      try {
        const result = await listUserUsdtPayments(userId, parsed.data.page, parsed.data.pageSize)
        return reply.send(
          success({
            records: result.records,
            total: result.total,
            page: parsed.data.page,
            pageSize: parsed.data.pageSize,
          }),
        )
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询订单失败'))
      }
    },
  )

  // ===== 3. GET /payment/usdt/order/:id — 查询订单详情 =====
  server.get(
    '/payment/usdt/order/:id',
    { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '未登录'))

      const parsed = orderIdParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      try {
        const record = await getUsdtPaymentDetail(parsed.data.id, userId)
        if (!record) return reply.status(404).send(error(404, '订单不存在'))
        return reply.send(success(record))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询订单详情失败'))
      }
    },
  )

  // ===== 4. POST /payment/usdt/callback/:network — 区块链 webhook 回调 =====
  // 2026-08-02 P0 安全修复:强制验签(fail-closed),secret 未配置或不匹配 → 拒绝
  // TODO: 对接 TronGrid/Etherscan 官方签名方案后替换为标准验签
  const WEBHOOK_SECRET = process.env.USDT_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    server.log.error('USDT_WEBHOOK_SECRET 未设置,webhook 回调将拒绝所有请求(生产环境必须配置)')
  }
  server.post(
    '/payment/usdt/callback/:network',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      // 强制验签(fail-closed):secret 未配置或提供的 secret 不匹配 → 拒绝
      const providedSecret = request.headers['x-webhook-secret'] as string | undefined
      if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
        request.log.warn(
          {
            hasConfig: !!WEBHOOK_SECRET,
            hasProvided: !!providedSecret,
          },
          '[usdt-webhook] unauthorized callback attempt',
        )
        return reply.status(401).send(error(401, 'Webhook 签名校验失败'))
      }

      const parsedParams = callbackParamSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return reply.status(400).send(error(400, '不支持的网络'))
      }

      const parsedBody = callbackBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
      }

      try {
        const result = await confirmUsdtPayment(
          parsedBody.data.orderId,
          parsedBody.data.txHash,
          parsedBody.data.amountPaid,
        )
        request.log.info(
          { network: parsedParams.data.network, orderId: parsedBody.data.orderId, result },
          'USDT 支付回调确认',
        )
        return reply.send(success(result))
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
        request.log.error(e)
        return reply.status(statusCode).send(error(statusCode, (e as Error).message))
      }
    },
  )

  // ===== 5. GET /admin/payment/usdt/orders — 管理员查询所有订单 =====
  server.get(
    '/admin/payment/usdt/orders',
    { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = adminOrdersQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      try {
        const result = await listAllUsdtPayments({
          userId: parsed.data.userId,
          status: parsed.data.status,
          network: parsed.data.network,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
        })
        return reply.send(
          success({
            records: result.records,
            total: result.total,
            page: parsed.data.page,
            pageSize: parsed.data.pageSize,
          }),
        )
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询订单失败'))
      }
    },
  )

  // ===== 6. GET /admin/payment/usdt/config — 管理员查看配置 =====
  server.get(
    '/admin/payment/usdt/config',
    { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      try {
        const config = await getUsdtPaymentConfig()
        return reply.send(success(config))
      } catch (e) {
        _request.log.error(e)
        return reply.status(500).send(error(500, '查询配置失败'))
      }
    },
  )

  // ===== 7. PATCH /admin/payment/usdt/config — 管理员修改配置 =====
  server.patch(
    '/admin/payment/usdt/config',
    { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = configPatchSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '未登录'))

      try {
        const config = await setUsdtPaymentConfig(parsed.data, userId)
        return reply.send(success(config))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '修改配置失败'))
      }
    },
  )
}

export default paymentUsdtRoutes
