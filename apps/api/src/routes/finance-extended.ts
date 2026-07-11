import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import {
  commissionFlows,
  withdrawalFlows,
  identityProportions,
  orders,
  userMargins,
  tokenFlows,
} from '@ihui/database'

export const financeExtendedRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 分销统计
  // ==========================================================================

  // 团队业绩统计（查询 commissionFlows 按 beneficiaryId 汇总 totalAmount/count）
  server.get('/finance/distribution/team-stats', async (request, reply) => {
    await authenticate(request)
    const { beneficiaryId } = request.query as { beneficiaryId?: string }
    const targetId = beneficiaryId ?? request.userId!
    try {
      const rows = await db
        .select({
          beneficiaryId: commissionFlows.beneficiaryId,
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, targetId), eq(commissionFlows.status, 1)))
        .groupBy(commissionFlows.beneficiaryId)
      // 当前活跃的分销比例配置
      const proportionRows = await db
        .select()
        .from(identityProportions)
        .where(eq(identityProportions.status, 1))
        .limit(1)
      return reply.send(
        success(
          rows[0] ?? {
            beneficiaryId: targetId,
            totalAmount: 0,
            totalCount: 0,
            proportion: proportionRows[0] ?? null,
          },
        ),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询团队业绩统计失败'))
    }
  })

  // 下级统计（查询 commissionFlows 按 invitedUserId 汇总）
  server.get('/finance/distribution/subordinate-stats', async (request, reply) => {
    await authenticate(request)
    const {
      beneficiaryId,
      page = '1',
      pageSize = '20',
    } = request.query as {
      beneficiaryId?: string
      page?: string
      pageSize?: string
    }
    const targetId = beneficiaryId ?? request.userId!
    const offset = (Number(page) - 1) * Number(pageSize)
    try {
      const list = await db
        .select({
          invitedUserId: commissionFlows.invitedUserId,
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, targetId), eq(commissionFlows.status, 1)))
        .groupBy(commissionFlows.invitedUserId)
        .limit(Number(pageSize))
        .offset(offset)
      const countRows = await db
        .select({ count: sql<number>`count(DISTINCT ${commissionFlows.invitedUserId})::int` })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, targetId), eq(commissionFlows.status, 1)))
      return reply.send(
        success({
          list,
          total: countRows[0]?.count ?? 0,
          page: Number(page),
          pageSize: Number(pageSize),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询下级统计失败'))
    }
  })

  // 邀请汇总（查询 commissionFlows 按日期分组统计）
  server.get('/finance/distribution/invitation-summary', async (request, reply) => {
    await authenticate(request)
    const { beneficiaryId, startDate, endDate } = request.query as {
      beneficiaryId?: string
      startDate?: string
      endDate?: string
    }
    const targetId = beneficiaryId ?? request.userId!
    const conditions: SQL[] = [
      eq(commissionFlows.beneficiaryId, targetId),
      eq(commissionFlows.status, 1),
    ]
    if (startDate) conditions.push(sql`${commissionFlows.createdAt} >= ${startDate}::timestamp`)
    if (endDate)
      conditions.push(sql`${commissionFlows.createdAt} <= ${`${endDate} 23:59:59`}::timestamp`)
    const where = and(...conditions)
    try {
      const rows = await db
        .select({
          dateStr: sql<string>`to_char(${commissionFlows.createdAt}, 'YYYY-MM-DD')`,
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(where)
        .groupBy(sql`to_char(${commissionFlows.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${commissionFlows.createdAt}, 'YYYY-MM-DD') DESC`)
      return reply.send(success(rows))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询邀请汇总失败'))
    }
  })

  // ==========================================================================
  // Agent 提现全套
  // ==========================================================================

  const applySchema = z.object({
    amount: z.number().int().positive(),
    type: z.string().min(1),
    bankInfo: z.string().optional(),
    openId: z.string().optional(),
  })

  // 提现申请（写入 withdrawalFlows 表, status=0; 检查余额是否足够）
  server.post('/finance/agent-withdrawal/apply', async (request, reply) => {
    const payload = await authenticate(request)
    const userId = payload.userId
    const parsed = applySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误: amount, type 必填'))
    const { amount, type, bankInfo, openId } = parsed.data
    try {
      // 检查余额：佣金总额 - 已提现（含待审核/处理中/已完成）金额
      const commissionRows = await db
        .select({ total: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int` })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, userId), eq(commissionFlows.status, 1)))
      const withdrawnRows = await db
        .select({ total: sql<number>`COALESCE(SUM(${withdrawalFlows.originalAmount}), 0)::int` })
        .from(withdrawalFlows)
        .where(and(eq(withdrawalFlows.userId, userId), sql`${withdrawalFlows.status} IN (0, 1, 2)`))
      const available = (commissionRows[0]?.total ?? 0) - (withdrawnRows[0]?.total ?? 0)
      if (amount > available) {
        return reply.status(400).send(error(400, `可提现余额不足，当前可用: ${available}`))
      }
      const accountInfo = bankInfo ? { bankInfo } : openId ? { openId } : {}
      const [row] = await db
        .insert(withdrawalFlows)
        .values({
          userId,
          amount,
          originalAmount: amount,
          fee: 0,
          status: 0,
          method: type,
          accountInfo,
        })
        .returning()
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '提现申请失败'))
    }
  })

  // 提现列表（分页，支持 userId/status 筛选）
  server.get('/finance/agent-withdrawal/list', async (request, reply) => {
    await authenticate(request)
    const {
      userId,
      status,
      page = '1',
      pageSize = '20',
    } = request.query as {
      userId?: string
      status?: string
      page?: string
      pageSize?: string
    }
    const targetUserId = userId ?? request.userId!
    const conditions: SQL[] = [eq(withdrawalFlows.userId, targetUserId)]
    if (status !== undefined) conditions.push(eq(withdrawalFlows.status, Number(status)))
    const where = and(...conditions)
    const offset = (Number(page) - 1) * Number(pageSize)
    try {
      const list = await db
        .select()
        .from(withdrawalFlows)
        .where(where)
        .orderBy(desc(withdrawalFlows.createdAt))
        .limit(Number(pageSize))
        .offset(offset)
      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(withdrawalFlows)
        .where(where)
      return reply.send(
        success({
          list,
          total: totalRows[0]?.count ?? 0,
          page: Number(page),
          pageSize: Number(pageSize),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询提现列表失败'))
    }
  })

  // 管理员审批通过（status 0→1→2）
  server.post('/finance/agent-withdrawal/:id/approve', async (request, reply) => {
    const payload = await authenticate(request)
    if (payload.roleId < 1) return reply.status(403).send(error(403, '无管理员权限'))
    const { id } = request.params as { id: string }
    try {
      const existing = await db
        .select()
        .from(withdrawalFlows)
        .where(eq(withdrawalFlows.id, id))
        .limit(1)
      if (!existing[0]) return reply.status(404).send(error(404, '提现记录不存在'))
      const currentStatus = existing[0].status
      if (currentStatus >= 2) {
        return reply.status(400).send(error(400, '该提现记录已完成审批'))
      }
      const newStatus = currentStatus + 1 // 0→1, 1→2
      const [row] = await db
        .update(withdrawalFlows)
        .set({ status: newStatus, processedAt: new Date(), updatedAt: new Date() })
        .where(eq(withdrawalFlows.id, id))
        .returning()
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '审批通过失败'))
    }
  })

  // 管理员驳回（body: rejectReason; status→3）
  server.post('/finance/agent-withdrawal/:id/reject', async (request, reply) => {
    const payload = await authenticate(request)
    if (payload.roleId < 1) return reply.status(403).send(error(403, '无管理员权限'))
    const { id } = request.params as { id: string }
    const { rejectReason } = request.body as { rejectReason?: string }
    try {
      const existing = await db
        .select()
        .from(withdrawalFlows)
        .where(eq(withdrawalFlows.id, id))
        .limit(1)
      if (!existing[0]) return reply.status(404).send(error(404, '提现记录不存在'))
      const [row] = await db
        .update(withdrawalFlows)
        .set({
          status: 3,
          rejectReason,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(withdrawalFlows.id, id))
        .returning()
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '驳回失败'))
    }
  })

  // ==========================================================================
  // 管理员工具
  // ==========================================================================

  const adjustSchema = z.object({
    userId: z.string().min(1),
    amount: z.number().int(),
    remark: z.string().optional(),
  })

  // 保证金调整（写入 tokenFlows opType=5 管理员调整）
  server.post('/admin/finance/margin/adjust', async (request, reply) => {
    const payload = await authenticate(request)
    if (payload.roleId < 1) return reply.status(403).send(error(403, '无管理员权限'))
    const parsed = adjustSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误: userId, amount 必填'))
    const { userId, amount, remark } = parsed.data
    try {
      // 查询当前余额
      const marginRows = await db
        .select()
        .from(userMargins)
        .where(eq(userMargins.userId, userId))
        .limit(1)
      const currentBalance = marginRows[0]?.tokenQuantity ?? 0
      const newBalance = currentBalance + amount
      if (newBalance < 0) {
        return reply.status(400).send(error(400, '调整后余额不能为负'))
      }
      // 更新保证金余额
      if (marginRows[0]) {
        await db
          .update(userMargins)
          .set({ tokenQuantity: newBalance, updatedAt: new Date() })
          .where(eq(userMargins.userId, userId))
      } else {
        await db.insert(userMargins).values({ userId, tokenQuantity: newBalance })
      }
      // 写入 token 流水（opType=5 管理员调整）
      const [flow] = await db
        .insert(tokenFlows)
        .values({
          userId,
          opType: 5,
          quantity: amount,
          balanceAfter: newBalance,
          remark: remark ?? '管理员调整',
          operatorId: payload.userId,
        })
        .returning()
      return reply.send(success({ flow, balance: newBalance }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '保证金调整失败'))
    }
  })

  // 资金审核列表（查询 withdrawalFlows + commissionFlows 联合统计）
  server.get('/admin/finance/fund/audit/list', async (request, reply) => {
    const payload = await authenticate(request)
    if (payload.roleId < 1) return reply.status(403).send(error(403, '无管理员权限'))
    const {
      status,
      page = '1',
      pageSize = '20',
    } = request.query as {
      status?: string
      page?: string
      pageSize?: string
    }
    const conditions: SQL[] = []
    if (status !== undefined) conditions.push(eq(withdrawalFlows.status, Number(status)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const offset = (Number(page) - 1) * Number(pageSize)
    try {
      const list = await db
        .select()
        .from(withdrawalFlows)
        .where(where)
        .orderBy(desc(withdrawalFlows.createdAt))
        .limit(Number(pageSize))
        .offset(offset)
      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(withdrawalFlows)
        .where(where)
      // 提现联合统计
      const withdrawalStats = await db
        .select({
          totalWithdrawal: sql<number>`COALESCE(SUM(${withdrawalFlows.originalAmount}), 0)::int`,
          pendingCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 0)::int`,
          processingCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 1)::int`,
          completedCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 2)::int`,
          rejectedCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 3)::int`,
        })
        .from(withdrawalFlows)
      // 佣金联合统计
      const commissionStats = await db
        .select({
          totalCommission: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          commissionCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(eq(commissionFlows.status, 1))
      // 订单总额统计
      const orderStats = await db
        .select({
          totalOrderAmount: sql<number>`COALESCE(SUM(${orders.amount}), 0)::int`,
          orderCount: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(eq(orders.status, 'paid'))
      return reply.send(
        success({
          list,
          total: totalRows[0]?.count ?? 0,
          page: Number(page),
          pageSize: Number(pageSize),
          stats: {
            withdrawal: withdrawalStats[0] ?? {},
            commission: commissionStats[0] ?? {},
            orders: orderStats[0] ?? {},
          },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询资金审核列表失败'))
    }
  })

  // 资金审核操作（body: action: approve/reject; 更新 withdrawalFlows status）
  server.post('/admin/finance/fund/audit/:id', async (request, reply) => {
    const payload = await authenticate(request)
    if (payload.roleId < 1) return reply.status(403).send(error(403, '无管理员权限'))
    const { id } = request.params as { id: string }
    const { action, remark } = request.body as { action: string; remark?: string }
    if (action !== 'approve' && action !== 'reject') {
      return reply.status(400).send(error(400, 'action 必须为 approve 或 reject'))
    }
    try {
      const existing = await db
        .select()
        .from(withdrawalFlows)
        .where(eq(withdrawalFlows.id, id))
        .limit(1)
      if (!existing[0]) return reply.status(404).send(error(404, '提现记录不存在'))
      if (action === 'approve') {
        const currentStatus = existing[0].status
        if (currentStatus >= 2) {
          return reply.status(400).send(error(400, '该记录已完成审批'))
        }
        const [row] = await db
          .update(withdrawalFlows)
          .set({
            status: currentStatus + 1,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(withdrawalFlows.id, id))
          .returning()
        return reply.send(success(row))
      } else {
        const [row] = await db
          .update(withdrawalFlows)
          .set({
            status: 3,
            rejectReason: remark,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(withdrawalFlows.id, id))
          .returning()
        return reply.send(success(row))
      }
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '资金审核操作失败'))
    }
  })
}
