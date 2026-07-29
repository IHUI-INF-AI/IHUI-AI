/**
 * /api/admin/relay/logs 中转站调用日志查询(P0-5b 配套,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET /admin/relay/logs — 调用日志列表(筛选 userId/model/status/时间范围,分页)
 * 2. GET /admin/relay/logs/stats — 聚合统计(按模型/按日 统计 token + 成本 + 调用次数)
 *
 * 复用 llm_call_logs 表(metadata.apiKeyId 关联到 developerApiKeys)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, sql, ilike, or, type SQL } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { llmCallLogs, users } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema } from './_shared.js'

const listQuerySchema = paginationSchema.extend({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  model: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['success', 'error']).optional()),
  apiKeyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  /** 起始日期 YYYY-MM-DD */
  startDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 结束日期 YYYY-MM-DD */
  endDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

const statsQuerySchema = z.object({
  startDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  endDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 分组维度:model / day / user */
  groupBy: z.enum(['model', 'day', 'user']).default('model'),
})

const relayLogsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/logs — 调用日志列表 =====
  server.get('/admin/relay/logs', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, userId, model, status, startDate, endDate } = q.data

    const conds: SQL[] = []
    if (userId) conds.push(eq(llmCallLogs.userId, userId))
    if (model) conds.push(eq(llmCallLogs.model, model))
    if (status) conds.push(eq(llmCallLogs.status, status))
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = conds.length > 0 ? and(...conds) : undefined

    // search 搜 model 或 errorMessage
    const searchCond = search
      ? or(
          ilike(llmCallLogs.model, `%${search}%`),
          ilike(llmCallLogs.errorMessage, `%${search}%`),
        )
      : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: llmCallLogs.id,
            userId: llmCallLogs.userId,
            model: llmCallLogs.model,
            promptTokens: llmCallLogs.promptTokens,
            completionTokens: llmCallLogs.completionTokens,
            totalTokens: llmCallLogs.totalTokens,
            latencyMs: llmCallLogs.latencyMs,
            status: llmCallLogs.status,
            errorMessage: llmCallLogs.errorMessage,
            metadata: llmCallLogs.metadata,
            createdAt: llmCallLogs.createdAt,
            username: users.username,
            email: users.email,
          })
          .from(llmCallLogs)
          .leftJoin(users, eq(llmCallLogs.userId, users.id))
          .where(finalWhere)
          .orderBy(desc(llmCallLogs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(llmCallLogs)
          .where(finalWhere),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志失败'))
    }
  })

  // ===== 2. GET /admin/relay/logs/stats — 聚合统计 =====
  server.get('/admin/relay/logs/stats', async (request, reply) => {
    const q = statsQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate, groupBy } = q.data

    const conds: SQL[] = []
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = conds.length > 0 ? and(...conds) : undefined

    try {
      let groupCol: SQL
      if (groupBy === 'model') {
        groupCol = sql<string>`${llmCallLogs.model}`
      } else if (groupBy === 'day') {
        groupCol = sql<string>`to_char(${llmCallLogs.createdAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`
      } else {
        groupCol = sql<string>`${llmCallLogs.userId}`
      }

      const rows = await dbRead
        .select({
          groupKey: groupCol.as('group_key'),
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          promptTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint::int`,
          completionTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint::int`,
          successCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'success')::int`,
          errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
          avgLatencyMs: sql<number>`coalesce(avg(${llmCallLogs.latencyMs}), 0)::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(groupCol)
        .orderBy(desc(sql`count(*)::int`))
        .limit(100)

      return reply.send(success({ groupBy, rows }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志统计失败'))
    }
  })
}

export default relayLogsRoutes
