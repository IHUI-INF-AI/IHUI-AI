import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, and, gte, lte, ilike } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { userMargins, tokenFlows, users } from '@ihui/database'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { generateOrderNumber } from '../utils/crypto-random.js'
import { logAction } from '../services/audit-service.js'
import { encryptJSON, decryptJSON } from '../utils/crypto.js'

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

/**
 * 解密提现 remark(P0-5 安全加固)。
 * - 以 'withdrawal:' 开头:加密数据,用 decryptJSON 解密后重建展示文案
 * - 其他:明文老数据,原样返回(向后兼容)
 * - 解密失败(数据损坏/密钥变更):返回原值,不阻断展示
 */
function decryptWithdrawalRemark(remark: string | null | undefined): string | null {
  if (!remark || !remark.startsWith('withdrawal:')) return remark ?? null
  try {
    const payload = JSON.parse(remark.slice('withdrawal:'.length))
    const data = decryptJSON(payload) as { accountType?: string; account?: string }
    return `提现到 ${data.accountType ?? ''}(${data.account ?? ''})`
  } catch {
    return remark
  }
}

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
          remark: 'withdrawal:' + JSON.stringify(encryptJSON({ accountType, account })),
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
          remark: decryptWithdrawalRemark(f.remark),
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

/**
 * 管理员钱包路由 — 主 agent 注册前缀 /api/admin/wallet/*
 * 端点:GET /stats(统计聚合)/ GET /flows(全量流水审计)/ POST /adjust(管理员调整余额)
 */
const adminFlowsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  opType: z.coerce.number().int().min(0).max(5).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  keyword: z.string().max(100).optional(),
})

const adjustSchema = z.object({
  userId: z.string().uuid('用户 ID 格式错误'),
  amount: z.number().int().refine((v) => v !== 0, '调整金额不能为 0'),
  opType: z.union([z.literal(0), z.literal(5)]),
  remark: z.string().max(500).optional(),
})

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const adminWalletRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /stats — 钱包统计聚合(全部 dbRead + Promise.all 并发)
  server.get('/stats', async (_request, reply) => {
    const todayStart = startOfDay(new Date())
    const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))

    const [
      rechargeSum,
      withdrawSum,
      commissionSum,
      adjustSum,
      todayRecharge,
      todayWithdraw,
      daily,
      activeWallets,
    ] = await Promise.all([
      dbRead
        .select({ total: sql<number>`coalesce(sum(${tokenFlows.quantity}), 0)::int` })
        .from(tokenFlows)
        .where(eq(tokenFlows.opType, 0)),
      dbRead
        .select({ total: sql<number>`coalesce(sum(abs(${tokenFlows.quantity})), 0)::int` })
        .from(tokenFlows)
        .where(eq(tokenFlows.opType, 1)),
      dbRead
        .select({ total: sql<number>`coalesce(sum(${tokenFlows.quantity}), 0)::int` })
        .from(tokenFlows)
        .where(eq(tokenFlows.opType, 4)),
      dbRead
        .select({ total: sql<number>`coalesce(sum(${tokenFlows.quantity}), 0)::int` })
        .from(tokenFlows)
        .where(eq(tokenFlows.opType, 5)),
      dbRead
        .select({
          count: sql<number>`count(*)::int`,
          amount: sql<number>`coalesce(sum(${tokenFlows.quantity}), 0)::int`,
        })
        .from(tokenFlows)
        .where(and(eq(tokenFlows.opType, 0), gte(tokenFlows.createdAt, todayStart))),
      dbRead
        .select({
          count: sql<number>`count(*)::int`,
          amount: sql<number>`coalesce(sum(abs(${tokenFlows.quantity})), 0)::int`,
        })
        .from(tokenFlows)
        .where(and(eq(tokenFlows.opType, 1), gte(tokenFlows.createdAt, todayStart))),
      dbRead
        .select({
          date: sql<string>`to_char(date_trunc('day', ${tokenFlows.createdAt}), 'YYYY-MM-DD')`,
          recharge: sql<number>`coalesce(sum(${tokenFlows.quantity}) filter (where ${tokenFlows.opType} = 0), 0)::int`,
          withdraw: sql<number>`coalesce(sum(abs(${tokenFlows.quantity})) filter (where ${tokenFlows.opType} = 1), 0)::int`,
          commission: sql<number>`coalesce(sum(${tokenFlows.quantity}) filter (where ${tokenFlows.opType} = 4), 0)::int`,
        })
        .from(tokenFlows)
        .where(gte(tokenFlows.createdAt, sevenDaysAgo))
        .groupBy(sql`date_trunc('day', ${tokenFlows.createdAt})`)
        .orderBy(sql`date_trunc('day', ${tokenFlows.createdAt})`),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(userMargins)
        .where(sql`${userMargins.tokenQuantity} > 0`),
    ])

    return reply.send(
      success({
        totalRecharge: rechargeSum[0]?.total ?? 0,
        totalWithdraw: withdrawSum[0]?.total ?? 0,
        totalCommission: commissionSum[0]?.total ?? 0,
        totalAdminAdjust: adjustSum[0]?.total ?? 0,
        todayRecharge: { count: todayRecharge[0]?.count ?? 0, amount: todayRecharge[0]?.amount ?? 0 },
        todayWithdraw: { count: todayWithdraw[0]?.count ?? 0, amount: todayWithdraw[0]?.amount ?? 0 },
        daily,
        activeWallets: activeWallets[0]?.count ?? 0,
      }),
    )
  })

  // GET /flows — 全量流水审计(管理员视角,所有用户)+ 分页筛选 + JOIN users
  server.get('/flows', async (request, reply) => {
    const parsed = adminFlowsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId, opType, startDate, endDate, keyword } = parsed.data
    const offset = (page - 1) * pageSize

    const conds = []
    if (userId) conds.push(eq(tokenFlows.userId, userId))
    if (opType !== undefined) conds.push(eq(tokenFlows.opType, opType))
    if (startDate) conds.push(gte(tokenFlows.createdAt, startDate))
    if (endDate) conds.push(lte(tokenFlows.createdAt, endDate))
    if (keyword) conds.push(ilike(tokenFlows.remark, `%${keyword}%`))
    const where = and(...conds)

    const [list, totalRows] = await Promise.all([
      dbRead
        .select({
          id: tokenFlows.id,
          userId: tokenFlows.userId,
          opType: tokenFlows.opType,
          quantity: tokenFlows.quantity,
          balanceAfter: tokenFlows.balanceAfter,
          remark: tokenFlows.remark,
          operatorId: tokenFlows.operatorId,
          relatedOrderNo: tokenFlows.relatedOrderNo,
          createdAt: tokenFlows.createdAt,
          nickname: users.nickname,
          avatar: users.avatar,
        })
        .from(tokenFlows)
        .innerJoin(users, eq(tokenFlows.userId, users.id))
        .where(where)
        .orderBy(desc(tokenFlows.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead.select({ count: sql<number>`count(*)::int` }).from(tokenFlows).where(where),
    ])

    return reply.send(
      success({
        list: list.map((f) => ({ ...f, remark: decryptWithdrawalRemark(f.remark), createdAt: f.createdAt.toISOString() })),
        total: totalRows[0]?.count ?? 0,
        page,
        pageSize,
      }),
    )
  })

  // POST /adjust — 管理员调整余额(事务:查余额 → 更新 → 记流水 → 审计)
  server.post('/adjust', async (request, reply) => {
    const parsed = adjustSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId, amount, opType, remark } = parsed.data
    const operatorId = request.userId!

    try {
      const result = await db.transaction(async (tx) => {
        const [margin] = await tx
          .select()
          .from(userMargins)
          .where(eq(userMargins.userId, userId))
          .limit(1)
        const balance = margin?.tokenQuantity ?? 0
        const newBalance = balance + amount
        if (newBalance < 0) {
          throw Object.assign(new Error('调整后余额不能为负数'), { statusCode: 400 })
        }
        const flowValues = {
          userId,
          opType,
          quantity: amount,
          balanceAfter: newBalance,
          remark: remark ?? `管理员调整 ${amount > 0 ? '+' : ''}${amount}`,
          operatorId,
        }
        if (margin) {
          const [updated] = await tx
            .update(userMargins)
            .set({ tokenQuantity: newBalance, updatedAt: new Date() })
            .where(eq(userMargins.userId, userId))
            .returning()
          const [flow] = await tx.insert(tokenFlows).values(flowValues).returning()
          return { margin: updated!, flow: flow! }
        }
        const [created] = await tx
          .insert(userMargins)
          .values({ userId, tokenQuantity: newBalance, frozenQuantity: 0 })
          .returning()
        const [flow] = await tx.insert(tokenFlows).values(flowValues).returning()
        return { margin: created!, flow: flow! }
      })

      await logAction({
        userId: operatorId,
        action: 'wallet.admin_adjust',
        resourceType: 'wallet',
        resourceId: userId,
        details: {
          targetUserId: userId,
          amount,
          opType,
          remark,
          balanceAfter: result.flow.balanceAfter,
        },
      })

      return reply.status(201).send(success(result))
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
      return reply.status(statusCode).send(error(statusCode, (e as Error).message))
    }
  })
}

export default walletRoutes
