import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, and, gte, lte, ilike } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { userMargins, tokenFlows, users } from '@ihui/database'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { generateOrderNumber } from '../utils/crypto-random.js'
import { logAction } from '../services/audit-service.js'
import { decryptJSON } from '../utils/crypto.js'
import { validateTopupAmount } from '../services/topup-discount-service.js'
import { applyWithdrawal } from '../db/commission-queries.js'

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
  server.post(
    '/recharge',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = rechargeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // P0-21 集成:校验最低充值额(按支付方式,阶梯折扣配置)
      const validation = await validateTopupAmount(parsed.data.amount, parsed.data.payMethod)
      if (!validation.valid) {
        return reply.status(400).send(error(400, validation.reason ?? '充值金额校验失败'))
      }
      const orderNo = generateOrderNumber('RC')
      // 不 update userMargins,不 insert tokenFlows!余额增加只能走支付回调
      return reply.status(201).send(success({ orderNo, payUrl: undefined }))
    },
  )

  // POST /withdraw - P0 死锁修复(2026-08-02 Bug A4):原实现只 frozen += amount,
  // 不扣 token,不写 withdrawalFlows,资金永久冻结(用户无法提现也无法消费)。
  // 改为代理调用 applyWithdrawal,它在事务内原子执行:
  //   token -= actualAmount, frozen += actualAmount, INSERT withdrawalFlows
  // 这样资金链路完整,后续审批/驳回/回调能正确流转。
  server.post(
    '/withdraw',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const userId = request.userId!
      const parsed = withdrawSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { amount, account, accountType } = parsed.data
      try {
        const flow = await applyWithdrawal(
          {
            userId,
            amount,
            method: accountType,
            accountInfo: { accountType, account },
          },
          userId,
        )
        return reply.status(201).send(success(flow))
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
        return reply.status(statusCode).send(error(statusCode, (e as Error).message))
      }
    },
  )

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
  userId: z.uuid().optional(),
  opType: z.coerce.number().int().min(0).max(5).optional(),
  startDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), '无效日期').optional(),
  endDate: z.coerce.date().refine((d) => !isNaN(d.getTime()), '无效日期').optional(),
  keyword: z.string().max(100).optional(),
})

const adjustSchema = z.object({
  userId: z.uuid({ error: '用户 ID 格式错误' }),
  amount: z
    .number()
    .int()
    .refine((v) => v !== 0, '调整金额不能为 0'),
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
        todayRecharge: {
          count: todayRecharge[0]?.count ?? 0,
          amount: todayRecharge[0]?.amount ?? 0,
        },
        todayWithdraw: {
          count: todayWithdraw[0]?.count ?? 0,
          amount: todayWithdraw[0]?.amount ?? 0,
        },
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
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(tokenFlows)
        .where(where),
    ])

    return reply.send(
      success({
        list: list.map((f) => ({
          ...f,
          remark: decryptWithdrawalRemark(f.remark),
          createdAt: f.createdAt.toISOString(),
        })),
        total: totalRows[0]?.count ?? 0,
        page,
        pageSize,
      }),
    )
  })

  // POST /adjust — 管理员调整余额(事务:查余额 → 更新 → 记流水 → 审计)
  server.post(
    '/adjust',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = adjustSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { userId, amount, opType, remark } = parsed.data
      const operatorId = request.userId!

      try {
        const result = await db.transaction(async (tx) => {
          // P0 并发竞态修复(2026-08-01):原 read-then-write(SELECT balance → 计算 → UPDATE)
          // 两个管理员并发调整同一用户会丢失更新。改为原子 UPDATE + WHERE 校验,
          // 对正数调整无约束,对负数调整校验调整后余额 >=0;UPDATE 不命中时按"无 margin 记录"分支处理。
          let marginRow: { tokenQuantity: number; frozenQuantity: number } | undefined
          if (amount >= 0) {
            // 正数调整:UPDATE 命中即成功;不命中则需创建 margin 行
            const [updated] = await tx
              .update(userMargins)
              .set({ tokenQuantity: sql`token_quantity + ${amount}`, updatedAt: new Date() })
              .where(eq(userMargins.userId, userId))
              .returning()
            marginRow = updated ?? undefined
          } else {
            // 负数调整:WHERE 子句内联 `token_quantity + amount >= 0`,余额不足时不命中
            const [updated] = await tx
              .update(userMargins)
              .set({ tokenQuantity: sql`token_quantity + ${amount}`, updatedAt: new Date() })
              .where(and(eq(userMargins.userId, userId), sql`token_quantity + ${amount} >= 0`))
              .returning()
            if (!updated) {
              // 不命中:要么无 margin 行,要么余额不足
              const [existing] = await tx
                .select()
                .from(userMargins)
                .where(eq(userMargins.userId, userId))
                .limit(1)
              if (existing) {
                throw Object.assign(new Error('调整后余额不能为负数'), { statusCode: 400 })
              }
              // 无 margin 行 + 负数调整:余额为 0,新余额 = amount < 0,拒绝
              throw Object.assign(new Error('调整后余额不能为负数'), { statusCode: 400 })
            }
            marginRow = updated
          }
          // balanceAfter:marginRow 存在时是其更新后的 tokenQuantity;
          // marginRow 不存在(amount>=0 且首次调整)时新余额 = amount
          const newBalance = marginRow?.tokenQuantity ?? amount
          const flowValues = {
            userId,
            opType,
            quantity: amount,
            balanceAfter: newBalance,
            remark: remark ?? `管理员调整 ${amount > 0 ? '+' : ''}${amount}`,
            operatorId,
          }
          if (marginRow) {
            const [flow] = await tx.insert(tokenFlows).values(flowValues).returning()
            return { margin: marginRow, flow: flow! }
          }
          // amount >= 0 且 margin 不存在:创建 margin 行
          const [created] = await tx
            .insert(userMargins)
            .values({ userId, tokenQuantity: amount, frozenQuantity: 0 })
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
    },
  )
}

export default walletRoutes
