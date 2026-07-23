import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { isValidApiKeyPermission } from '@ihui/types'
import { userMargins, tokenFlows } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { createOrder } from '../db/payment-queries.js'
import {
  findDeveloperPricingById,
  activateDeveloperSubscription,
  getMyDeveloperSubscription,
} from '../db/developer-queries.js'
import * as apiKeysService from '../services/developer-api-keys-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const permissionsSchema = z
  .array(z.string())
  .refine((arr) => arr.every(isValidApiKeyPermission), '包含非法权限点')

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: permissionsSchema.default([]),
  rateLimit: z.number().int().min(1).max(10000).optional(),
})

const updateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: permissionsSchema.optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['active', 'revoked']).optional(),
})

const subscribeBody = z.object({
  pricingId: z.string().uuid('无效的套餐 ID'),
  period: z.enum(['monthly', 'yearly']).optional(),
  paymentMethod: z.string().optional().default('wechat'),
})

const withdrawBodySchema = z.object({
  amount: z.number().int().min(1, '提现金额必须大于 0'),
})

const withdrawalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// 路由
// =============================================================================

const developerRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有开发者 API 密钥端点需登录
  server.addHook('preHandler', requireAuth)

  // GET /api-keys — 列出当前用户的 API 密钥
  server.get('/api-keys', async (request, reply) => {
    const userId = request.userId!
    const list = await apiKeysService.listKeys(userId)
    return reply.send(success({ list }))
  })

  // POST /api-keys — 创建 API 密钥
  server.post('/api-keys', async (request, reply) => {
    const userId = request.userId!
    const parsed = createKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { apiKey, secret } = await apiKeysService.createKey(userId, {
      name: parsed.data.name,
      permissions: parsed.data.permissions,
      rateLimit: parsed.data.rateLimit,
    })
    // 仅此一次返回完整 secret，后续不再提供
    // 跳过响应脱敏,否则 secret 会被 response-sanitizer 误伤为 '***'
    request.skipResponseSanitization = true
    return reply.status(201).send(success({ apiKey, secret }))
  })

  // DELETE /api-keys/:id — 删除 API 密钥
  server.delete('/api-keys/:id', async (request, reply) => {
    const userId = request.userId!
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ok = await apiKeysService.deleteKey(parsed.data.id, userId)
    if (!ok) return reply.status(404).send(error(404, 'API 密钥不存在或无权操作'))
    return reply.send(success({ ok: true }))
  })

  // PATCH /api-keys/:id — 更新权限
  server.patch('/api-keys/:id', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await apiKeysService.updateKey(idParsed.data.id, userId, parsed.data)
    if (!updated) return reply.status(404).send(error(404, 'API 密钥不存在或无权操作'))
    return reply.send(success({ apiKey: updated }))
  })

  // GET /api-keys/:id/usage — 查询 API 密钥使用量（从 api_logs 统计）
  server.get('/api-keys/:id/usage', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const usage = await apiKeysService.getUsage(idParsed.data.id, userId)
    if (!usage) return reply.status(404).send(error(404, 'API 密钥不存在或无权查看'))
    return reply.send(
      success({
        callCount: usage.callCount,
        lastUsedAt: usage.lastUsedAt,
        topEndpoints: usage.topEndpoints,
      }),
    )
  })

  // POST /subscribe — 开通开发者套餐（创建订单，开发环境直接激活）
  server.post('/subscribe', async (request, reply) => {
    const userId = request.userId!
    const parsed = subscribeBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { pricingId, paymentMethod } = parsed.data
    const pricing = await findDeveloperPricingById(pricingId)
    if (!pricing || pricing.status !== 1) {
      return reply.status(404).send(error(404, '开发者套餐不存在或已下架'))
    }
    const period = parsed.data.period ?? pricing.period ?? 'monthly'
    const amount = Math.round(Number(pricing.price) * 100)
    const order = await createOrder({
      userId,
      amount,
      orderType: 5,
      productId: pricing.id,
      payType: paymentMethod,
    }, request.userId ?? null)
    if (process.env.NODE_ENV === 'development') {
      await activateDeveloperSubscription({
        userId,
        pricingId: pricing.id,
        period,
        orderId: order.id,
      })
    }
    return reply.send(
      success({
        orderId: order.id,
        orderNo: order.orderNo,
        amount,
        pricingId: pricing.id,
        period,
      }),
    )
  })

  // GET /subscription — 查询当前用户生效中的开发者订阅
  server.get('/subscription', async (request, reply) => {
    const userId = request.userId!
    const subscription = await getMyDeveloperSubscription(userId)
    return reply.send(success({ subscription: subscription ?? null }))
  })

  // GET /income — 开发者收入概览(累计收入 / 可提现 / 已提现 / 近 20 条收入明细)
  // 收入分润用 opType=4(佣金),已提现用 opType=1 且 quantity<0
  server.get('/income', async (request, reply) => {
    const userId = request.userId!

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    const available = (margin?.tokenQuantity ?? 0) - (margin?.frozenQuantity ?? 0)

    const [incomeRow] = await db
      .select({ total: sql<number>`coalesce(sum(${tokenFlows.quantity}), 0)::int` })
      .from(tokenFlows)
      .where(and(eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 4)))

    const [withdrawnRow] = await db
      .select({ total: sql<number>`coalesce(sum(-${tokenFlows.quantity}), 0)::int` })
      .from(tokenFlows)
      .where(
        and(
          eq(tokenFlows.userId, userId),
          eq(tokenFlows.opType, 1),
          sql`${tokenFlows.quantity} < 0`,
        ),
      )

    const rows = await db
      .select()
      .from(tokenFlows)
      .where(and(eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 4)))
      .orderBy(desc(tokenFlows.createdAt))
      .limit(20)

    const list = rows.map((f) => ({
      id: f.id,
      title: f.remark ?? '智能体收入',
      time: f.createdAt.toISOString(),
      amount: f.quantity,
    }))

    return reply.send(
      success({
        total: incomeRow?.total ?? 0,
        available,
        withdrawn: withdrawnRow?.total ?? 0,
        list,
      }),
    )
  })

  // GET /withdrawals — 当前用户提现记录列表(分页)
  server.get('/withdrawals', async (request, reply) => {
    const userId = request.userId!
    const parsed = withdrawalListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    const where = and(
      eq(tokenFlows.userId, userId),
      eq(tokenFlows.opType, 1),
      sql`${tokenFlows.quantity} < 0`,
    )

    const list = await db
      .select()
      .from(tokenFlows)
      .where(where)
      .orderBy(desc(tokenFlows.createdAt))
      .limit(pageSize)
      .offset(offset)

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(tokenFlows)
      .where(where)

    return reply.send(success({ list, total: countRow?.total ?? 0, page, pageSize }))
  })

  // POST /withdrawals — 发起提现申请(冻结余额 + 记录 opType=1 负向流水)
  server.post('/withdrawals', async (request, reply) => {
    const userId = request.userId!
    const parsed = withdrawBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { amount } = parsed.data

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    const balance = margin?.tokenQuantity ?? 0
    const frozen = margin?.frozenQuantity ?? 0
    const available = balance - frozen
    if (available < amount) {
      return reply.status(400).send(error(400, '可用余额不足'))
    }

    if (margin) {
      await db
        .update(userMargins)
        .set({ frozenQuantity: margin.frozenQuantity + amount, updatedAt: new Date() })
        .where(eq(userMargins.userId, userId))
    } else {
      await db
        .insert(userMargins)
        .values({ userId, tokenQuantity: 0, frozenQuantity: amount })
    }

    const [flow] = await db
      .insert(tokenFlows)
      .values({
        userId,
        opType: 1,
        quantity: -amount,
        balanceAfter: balance - amount,
        remark: '提现申请',
      })
      .returning()

    return reply.status(201).send(success({ flow, status: 'pending' }))
  })
}

export default developerRoutes
