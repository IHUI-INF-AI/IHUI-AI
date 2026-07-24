import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { commissionFlows, traders } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'

/**
 * 交易员流水统计接口(4 端点)
 * 基于 commission_flows + traders 表聚合:
 *   - GET /api/trader-stats/flow    — 流水明细(支持日期范围筛选)
 *   - GET /api/trader-stats/summary — 汇总统计(总收益/总笔数/日均)
 *   - GET /api/trader-stats/daily   — 按日统计
 *   - GET /api/trader-stats/rank    — 排行榜
 *
 * 交易员流水 = commissionFlows.beneficiaryId JOIN traders.userId(仅交易员作为获佣人的佣金流水)。
 * 路由使用绝对路径字面量注册(无 prefix),与 agent-creation.ts 风格一致。
 */
const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 日期范围 + traderId 筛选公共 schema
  const dateRangeQuery = z.object({
    begin: z.string().min(1).optional(),
    end: z.string().min(1).optional(),
    traderId: z.string().uuid().optional(), // 可选:筛选指定交易员(traders.id)
  })

  /**
   * 解析日期字符串为 Date 对象,无效时返回 null(由调用方决定如何处理)。
   */
  function parseDate(value: string | undefined): Date | undefined {
    if (!value) return undefined
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  }

  /**
   * 构建交易员流水查询的 WHERE 条件数组。
   * 始终 innerJoin traders(beneficiaryId = userId),可选按 traderId / 日期范围过滤。
   */
  function buildConditions(opts: {
    begin?: string
    end?: string
    traderId?: string
    approvedOnly?: boolean
  }): SQL[] {
    const conditions: SQL[] = [eq(commissionFlows.status, 1)]
    if (opts.traderId) conditions.push(eq(traders.id, opts.traderId))
    if (opts.approvedOnly) conditions.push(eq(traders.status, 'approved'))
    const beginDate = parseDate(opts.begin)
    const endDate = parseDate(opts.end)
    if (beginDate) conditions.push(gte(commissionFlows.createdAt, beginDate))
    if (endDate) conditions.push(lte(commissionFlows.createdAt, endDate))
    return conditions
  }

  // -------------------------------------------------------------------------
  // 1. GET /api/trader-stats/flow — 流水明细(支持日期范围筛选)
  // -------------------------------------------------------------------------
  const flowQuery = dateRangeQuery.extend({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  })

  server.get('/api/trader-stats/flow', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = flowQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { begin, end, traderId, page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    // 校验日期格式
    if (begin && parseDate(begin) === undefined) {
      return reply.status(400).send(error(400, 'begin 不是有效的日期'))
    }
    if (end && parseDate(end) === undefined) {
      return reply.status(400).send(error(400, 'end 不是有效的日期'))
    }

    try {
      const conditions = buildConditions({ begin, end, traderId })
      const where = and(...conditions)

      const list = await db
        .select({
          id: commissionFlows.id,
          beneficiaryId: commissionFlows.beneficiaryId,
          invitedUserId: commissionFlows.invitedUserId,
          orderId: commissionFlows.orderId,
          amount: commissionFlows.amount,
          token: commissionFlows.token,
          type: commissionFlows.type,
          status: commissionFlows.status,
          remark: commissionFlows.remark,
          createdAt: commissionFlows.createdAt,
        })
        .from(commissionFlows)
        .innerJoin(traders, eq(commissionFlows.beneficiaryId, traders.userId))
        .where(where)
        .orderBy(desc(commissionFlows.createdAt))
        .limit(pageSize)
        .offset(offset)

      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(commissionFlows)
        .innerJoin(traders, eq(commissionFlows.beneficiaryId, traders.userId))
        .where(where)

      return reply.send(
        success({
          list,
          total: totalRows[0]?.count ?? 0,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询流水明细失败'))
    }
  })

  // -------------------------------------------------------------------------
  // 2. GET /api/trader-stats/summary — 汇总统计(总收益/总笔数/日均)
  // -------------------------------------------------------------------------
  server.get('/api/trader-stats/summary', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = dateRangeQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { begin, end, traderId } = parsed.data

    if (begin && parseDate(begin) === undefined) {
      return reply.status(400).send(error(400, 'begin 不是有效的日期'))
    }
    if (end && parseDate(end) === undefined) {
      return reply.status(400).send(error(400, 'end 不是有效的日期'))
    }

    try {
      const conditions = buildConditions({ begin, end, traderId })
      const where = and(...conditions)

      const [row] = await db
        .select({
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalToken: sql<number>`COALESCE(SUM(${commissionFlows.token}), 0)::int`,
          totalCount: sql<number>`COUNT(*)::int`,
        })
        .from(commissionFlows)
        .innerJoin(traders, eq(commissionFlows.beneficiaryId, traders.userId))
        .where(where)

      // 计算日均(基于查询范围天数,默认 1 天避免除零)
      let days = 1
      const beginDate = parseDate(begin)
      const endDate = parseDate(end)
      if (beginDate && endDate) {
        const ms = endDate.getTime() - beginDate.getTime()
        days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
      }

      const totalAmount = row?.totalAmount ?? 0
      const totalCount = row?.totalCount ?? 0
      return reply.send(
        success({
          totalAmount,
          totalToken: row?.totalToken ?? 0,
          totalCount,
          dailyAverageAmount: Math.round(totalAmount / days),
          dailyAverageCount: Math.round(totalCount / days),
          days,
        }),
      )
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询汇总统计失败'))
    }
  })

  // -------------------------------------------------------------------------
  // 3. GET /api/trader-stats/daily — 按日统计
  // -------------------------------------------------------------------------
  server.get('/api/trader-stats/daily', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = dateRangeQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { begin, end, traderId } = parsed.data

    if (begin && parseDate(begin) === undefined) {
      return reply.status(400).send(error(400, 'begin 不是有效的日期'))
    }
    if (end && parseDate(end) === undefined) {
      return reply.status(400).send(error(400, 'end 不是有效的日期'))
    }

    try {
      const conditions = buildConditions({ begin, end, traderId })
      const where = and(...conditions)

      const list = await db
        .select({
          date: sql<string>`TO_CHAR(${commissionFlows.createdAt}::date, 'YYYY-MM-DD')`,
          amount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          token: sql<number>`COALESCE(SUM(${commissionFlows.token}), 0)::int`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(commissionFlows)
        .innerJoin(traders, eq(commissionFlows.beneficiaryId, traders.userId))
        .where(where)
        .groupBy(sql`TO_CHAR(${commissionFlows.createdAt}::date, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${commissionFlows.createdAt}::date, 'YYYY-MM-DD') DESC`)

      return reply.send(success({ list }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询按日统计失败'))
    }
  })

  // -------------------------------------------------------------------------
  // 4. GET /api/trader-stats/rank — 排行榜
  // -------------------------------------------------------------------------
  const rankQuery = dateRangeQuery.extend({
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })

  server.get('/api/trader-stats/rank', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = rankQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { begin, end, limit } = parsed.data

    if (begin && parseDate(begin) === undefined) {
      return reply.status(400).send(error(400, 'begin 不是有效的日期'))
    }
    if (end && parseDate(end) === undefined) {
      return reply.status(400).send(error(400, 'end 不是有效的日期'))
    }

    try {
      // 排行榜仅展示已通过审核的交易员
      const conditions = buildConditions({ begin, end, approvedOnly: true })
      const where = and(...conditions)

      const list = await db
        .select({
          traderId: traders.id,
          userId: traders.userId,
          amount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          token: sql<number>`COALESCE(SUM(${commissionFlows.token}), 0)::int`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(commissionFlows)
        .innerJoin(traders, eq(commissionFlows.beneficiaryId, traders.userId))
        .where(where)
        .groupBy(traders.id, traders.userId)
        .orderBy(desc(sql`SUM(${commissionFlows.amount})`))
        .limit(limit)

      const result = list.map((row, idx) => ({
        ...row,
        rank: idx + 1,
      }))

      return reply.send(success({ list: result }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询排行榜失败'))
    }
  })
}

export default plugin
