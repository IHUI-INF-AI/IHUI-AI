import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userMargins, tokenFlows } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// 复用 wallet schema 的 user_margins / token_flows 表作为资金数据源

// =============================================================================
// Zod schemas
// =============================================================================

const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  opType: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
})

const withdrawSchema = z.object({
  amount: z.number().int().min(1, '提现金额必须大于 0'),
  remark: z.string().max(255).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const fundRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有资金端点需登录
  server.addHook('preHandler', requireAuth)

  // GET /balance — 资金余额（基于 wallet 的 token 余额）
  server.get('/balance', async (request, reply) => {
    const userId = request.userId!
    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    if (!margin) {
      // 无记录则返回默认 0 余额
      return reply.send(success({ balance: 0, frozen: 0, available: 0 }))
    }
    return reply.send(
      success({
        balance: margin.tokenQuantity,
        frozen: margin.frozenQuantity,
        available: margin.tokenQuantity - margin.frozenQuantity,
      }),
    )
  })

  // GET /transactions — 资金流水（分页 + opType 筛选）
  server.get('/transactions', async (request, reply) => {
    const userId = request.userId!
    const parsed = transactionsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, opType } = parsed.data
    const offset = (page - 1) * pageSize
    const conditions = [eq(tokenFlows.userId, userId)]
    if (opType !== undefined) conditions.push(eq(tokenFlows.opType, opType))

    const list = await db
      .select()
      .from(tokenFlows)
      .where(and(...conditions))
      .orderBy(desc(tokenFlows.createdAt))
      .limit(pageSize)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tokenFlows)
      .where(and(...conditions))
    const total = countResult[0]?.count ?? 0

    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /withdraw — 提现申请（冻结对应数量，记录流水）
  server.post('/withdraw', async (request, reply) => {
    const userId = request.userId!
    const parsed = withdrawSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { amount, remark } = parsed.data

    // 检查可用余额
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

    // 冻结提现金额
    if (margin) {
      await db
        .update(userMargins)
        .set({
          frozenQuantity: margin.frozenQuantity + amount,
          updatedAt: new Date(),
        })
        .where(eq(userMargins.userId, userId))
    } else {
      await db.insert(userMargins).values({
        userId,
        tokenQuantity: 0,
        frozenQuantity: amount,
      })
    }

    // 记录提现流水（opType=1 扣减，关联备注）
    const [flow] = await db
      .insert(tokenFlows)
      .values({
        userId,
        opType: 1,
        quantity: -amount,
        balanceAfter: balance - amount,
        remark: remark ?? '提现申请',
      })
      .returning()

    return reply.status(201).send(success({ flow, status: 'pending' }))
  })

  // GET /withdrawals — 提现记录（筛选 opType=1 的流水）
  server.get('/withdrawals', async (request, reply) => {
    const userId = request.userId!
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    const list = await db
      .select()
      .from(tokenFlows)
      .where(eq(tokenFlows.userId, userId))
      .orderBy(desc(tokenFlows.createdAt))
      .limit(pageSize)
      .offset(offset)

    // 过滤出提现流水（opType=1 且 quantity 为负）
    const withdrawals = list.filter((f) => f.opType === 1 && f.quantity < 0)

    return reply.send(success({ list: withdrawals, page, pageSize }))
  })
}

export default fundRoutes
