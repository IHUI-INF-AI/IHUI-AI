import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userMargins, tokenFlows } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { generateOrderNumber } from '../utils/crypto-random.js'

/**
 * 钱包路由 — /api/wallet/*
 * 数据源：user_margins（余额）+ token_flows（流水）
 * opType: 0=充值 1=扣减(提现) 2=过期 3=退款 4=佣金 5=管理员调整
 */

const rechargeSchema = z.object({
  amount: z.number().int().min(1, '充值金额必须大于 0'),
  payMethod: z.string().min(1, '请选择支付方式'),
  couponId: z.string().optional(),
})

const withdrawSchema = z.object({
  amount: z.number().int().min(1, '提现金额必须大于 0'),
  account: z.string().min(1, '请输入收款账号'),
  accountType: z.string().min(1, '请选择账号类型'),
})

const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
})

const walletRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // GET /balance
  server.get('/balance', async (request, reply) => {
    const userId = request.userId!

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)

    if (!margin) {
      return reply.send(
        success({ balance: 0, frozenBalance: 0, totalRecharge: 0, totalWithdraw: 0 }),
      )
    }

    const [rechargeSum] = await db
      .select({ total: sql<number>`coalesce(sum(quantity), 0)::int` })
      .from(tokenFlows)
      .where(and(eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 0)))

    const [withdrawSum] = await db
      .select({ total: sql<number>`coalesce(sum(abs(quantity)), 0)::int` })
      .from(tokenFlows)
      .where(and(eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 1)))

    return reply.send(
      success({
        balance: margin.tokenQuantity,
        frozenBalance: margin.frozenQuantity,
        totalRecharge: rechargeSum?.total ?? 0,
        totalWithdraw: withdrawSum?.total ?? 0,
      }),
    )
  })

  // POST /recharge - P0-1 修复:不直接加余额,只创建订单号返回
  // 余额增加只能通过 payment-gateway.ts 支付回调调 rechargeToken(带幂等保护)
  server.post('/recharge', async (request, reply) => {
    const parsed = rechargeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const orderNo = generateOrderNumber('RC')
    // 不 update userMargins,不 insert tokenFlows!余额增加只能走支付回调
    return reply.status(201).send(success({ orderNo, payUrl: undefined }))
  })

  // POST /withdraw - P0-9 修复:冻结余额 + 记录流水用事务保证原子性
  server.post('/withdraw', async (request, reply) => {
    const userId = request.userId!
    const parsed = withdrawSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { amount, account, accountType } = parsed.data
    try {
      const result = await db.transaction(async (tx) => {
        const [margin] = await tx
          .select()
          .from(userMargins)
          .where(eq(userMargins.userId, userId))
          .limit(1)
        const balance = margin?.tokenQuantity ?? 0
        const frozen = margin?.frozenQuantity ?? 0
        const available = balance - frozen
        if (available < amount) {
          throw Object.assign(new Error('可用余额不足'), { statusCode: 400 })
        }
        if (margin) {
          await tx
            .update(userMargins)
            .set({ frozenQuantity: margin.frozenQuantity + amount, updatedAt: new Date() })
            .where(eq(userMargins.userId, userId))
        } else {
          await tx.insert(userMargins).values({ userId, tokenQuantity: 0, frozenQuantity: amount })
        }
        await tx.insert(tokenFlows).values({
          userId,
          opType: 1,
          quantity: -amount,
          balanceAfter: balance - amount,
          remark: `提现到 ${accountType}(${account})`,
        })
        return { success: true }
      })
      return reply.status(201).send(success(result))
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
      return reply.status(statusCode).send(error(statusCode, (e as Error).message))
    }
  })

  // GET /withdraw/records
  server.get('/withdraw/records', async (request, reply) => {
    const userId = request.userId!
    const parsed = recordsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    const conditions = [eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 1)]
    const list = await db
      .select()
      .from(tokenFlows)
      .where(and(...conditions))
      .orderBy(desc(tokenFlows.createdAt))
      .limit(pageSize)
      .offset(offset)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tokenFlows)
      .where(and(...conditions))

    return reply.send(
      success({
        list: list.map((f) => ({
          id: f.id,
          amount: Math.abs(f.quantity),
          balanceAfter: f.balanceAfter,
          type: 'withdraw' as const,
          status: 'pending',
          payMethod: null,
          remark: f.remark,
          createdAt: f.createdAt.toISOString(),
        })),
        total: countResult?.count ?? 0,
        page,
        pageSize,
      }),
    )
  })

  // GET /recharge/records
  server.get('/recharge/records', async (request, reply) => {
    const userId = request.userId!
    const parsed = recordsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    const conditions = [eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 0)]
    const list = await db
      .select()
      .from(tokenFlows)
      .where(and(...conditions))
      .orderBy(desc(tokenFlows.createdAt))
      .limit(pageSize)
      .offset(offset)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tokenFlows)
      .where(and(...conditions))

    return reply.send(
      success({
        list: list.map((f) => ({
          id: f.id,
          amount: f.quantity,
          balanceAfter: f.balanceAfter,
          type: 'recharge' as const,
          status: 'success',
          payMethod: null,
          remark: f.remark,
          createdAt: f.createdAt.toISOString(),
        })),
        total: countResult?.count ?? 0,
        page,
        pageSize,
      }),
    )
  })
}

export default walletRoutes
