import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  getBalance,
  rechargeToken,
  deductToken,
  refundToken,
  expireToken,
  listTokenFlows,
  listCommissionFlows,
  commissionSummary,
  applyWithdrawal,
  listWithdrawals,
  withdrawalSummary,
  availableWithdrawal,
  listSubordinates,
  teamCenter,
} from '../db/commission-queries.js'
import { orders } from '@ihui/database'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'

export const financeRoutes: FastifyPluginAsync = async (server) => {
  const pageLimitQuery = z.object({
    page: z.coerce.number().optional().default(1),
    limit: z.coerce.number().optional().default(20),
  })

  // ==========================================================================
  // Token 钱包余额
  // ==========================================================================

  server.get('/finance/margin/balance', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const balance = await getBalance(userId)
    return reply.send(success({ balance }))
  })

  server.get('/finance/margin/check', async (request, reply) => {
    await authenticate(request)
    const { minTokens } = z.object({ minTokens: z.coerce.number() }).parse(request.query)
    const userId = request.userId!
    const balance = await getBalance(userId)
    return reply.send(success({ sufficient: balance >= minTokens, balance }))
  })

  server.post('/finance/margin/deduct', async (request, reply) => {
    await authenticate(request)
    const { quantity, remark } = z
      .object({ quantity: z.coerce.number(), remark: z.string().optional().default('') })
      .parse(request.query)
    const userId = request.userId!
    const balance = await deductToken(userId, quantity, remark)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/recharge', async (request, reply) => {
    await authenticate(request)
    const { quantity, outTradeNo } = z
      .object({ quantity: z.coerce.number(), outTradeNo: z.string() })
      .parse(request.query)
    const userId = request.userId!
    const balance = await rechargeToken(userId, quantity, outTradeNo)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/expire', async (request, reply) => {
    await authenticate(request)
    const { quantity, source } = z
      .object({ quantity: z.coerce.number(), source: z.string().optional().default('到期清零') })
      .parse(request.query)
    const userId = request.userId!
    const balance = await expireToken(userId, quantity, source)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/commission', async (request, reply) => {
    await authenticate(request)
    const { quantity, invitedUserId, source } = z
      .object({
        quantity: z.coerce.number(),
        invitedUserId: z.string().optional().default(''),
        source: z.string().optional().default('invite'),
      })
      .parse(request.query)
    void invitedUserId
    const userId = request.userId!
    const balance = await rechargeToken(userId, quantity, undefined, source)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/refund', async (request, reply) => {
    await authenticate(request)
    const { quantity, remark } = z
      .object({ quantity: z.coerce.number(), remark: z.string().optional().default('') })
      .parse(request.query)
    const userId = request.userId!
    const balance = await refundToken(userId, quantity, remark)
    return reply.send(success({ balance }))
  })

  server.get('/finance/margin/flows', async (request, reply) => {
    await authenticate(request)
    const { page, limit, opType } = z
      .object({
        page: z.coerce.number().optional().default(1),
        limit: z.coerce.number().optional().default(20),
        opType: z.coerce.number().optional(),
      })
      .parse(request.query)
    const userId = request.userId!
    const result = await listTokenFlows(userId, page, limit, opType)
    return reply.send(success(result))
  })

  // ==========================================================================
  // 佣金
  // ==========================================================================

  server.get('/finance/commission/list', async (request, reply) => {
    await authenticate(request)
    const { page, limit } = pageLimitQuery.parse(request.query)
    const userId = request.userId!
    const result = await listCommissionFlows(userId, page, limit)
    return reply.send(success(result))
  })

  server.get('/finance/commission/summary', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const summary = await commissionSummary(userId)
    return reply.send(success(summary))
  })

  server.get('/finance/commission/orders', async (request, reply) => {
    await authenticate(request)
    const { page, limit, orderType, status } = z
      .object({
        page: z.coerce.number().optional().default(1),
        limit: z.coerce.number().optional().default(20),
        orderType: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const userId = request.userId!
    const conditions = [eq(orders.userId, userId)]
    if (orderType) conditions.push(eq(orders.paymentMethod, orderType))
    if (status) conditions.push(eq(orders.status, status))
    const where = conditions.length === 1 ? conditions[0] : and(...conditions)
    const rows = await db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where)
    return reply.send(success({ items: rows, total: countRows[0]?.count ?? 0 }))
  })

  // ==========================================================================
  // 分销
  // ==========================================================================

  server.get('/finance/distribution/subordinates', async (request, reply) => {
    await authenticate(request)
    const { page, limit } = pageLimitQuery.parse(request.query)
    const userId = request.userId!
    const result = await listSubordinates(userId, page, limit)
    return reply.send(success(result))
  })

  server.get('/finance/distribution/team/center', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const center = await teamCenter(userId)
    return reply.send(success(center))
  })

  server.get('/finance/distribution/invitee-stats', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const center = await teamCenter(userId)
    return reply.send(
      success({ totalInvitees: center.totalInvitees, vipInvitees: center.vipInvitees }),
    )
  })

  // ==========================================================================
  // 提现
  // ==========================================================================

  server.post('/finance/withdrawal/apply', async (request, reply) => {
    await authenticate(request)
    const { amount: amountCents } = z.object({ amount: z.coerce.number() }).parse(request.query)
    const userId = request.userId!
    if (amountCents <= 0) return reply.status(400).send(error(400, '提现金额必须为正'))

    // 风控评估：大额提现 / 异常 IP 检测
    const risk = server.riskEngine.evaluateRisk({
      userId,
      withdrawalAmountFen: amountCents,
      ip: request.ip,
    })
    if (risk.action === 'DENY') {
      request.log.warn({ userId, hits: risk.hits }, '提现被风控拒绝')
      return reply.status(403).send(error(403, '提现请求被风控拦截，请联系客服'))
    }
    if (risk.action === 'REVIEW') {
      request.log.info({ userId, hits: risk.hits }, '提现进入人工复核')
    }

    const doApply = async () => {
      const available = await availableWithdrawal(userId)
      if (amountCents > available) {
        throw Object.assign(new Error('可提现余额不足'), { statusCode: 400 })
      }
      return applyWithdrawal({
        userId,
        amount: amountCents,
        method: 'wechat',
        accountInfo: {},
      })
    }

    // 分布式锁防并发重复提现；锁不可用时降级直接执行
    try {
      const flow = await server.distributedLock.withLock(
        `withdrawal:user:${userId}`,
        10000,
        doApply,
      )
      return reply.send(success(flow))
    } catch (e) {
      if ((e as Error & { statusCode?: number }).statusCode) throw e
      request.log.warn({ err: e, userId }, '分布式锁不可用，降级执行提现')
      const flow = await doApply()
      return reply.send(success(flow))
    }
  })

  server.get('/finance/withdrawal/list', async (request, reply) => {
    await authenticate(request)
    const { page, limit } = pageLimitQuery.parse(request.query)
    const userId = request.userId!
    const result = await listWithdrawals(userId, page, limit)
    return reply.send(success(result))
  })

  server.get('/finance/withdrawal/summary', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const summary = await withdrawalSummary(userId)
    return reply.send(success(summary))
  })

  server.get('/finance/withdrawal/available', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const available = await availableWithdrawal(userId)
    return reply.send(success({ available }))
  })
}
