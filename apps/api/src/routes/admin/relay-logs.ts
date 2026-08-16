/**
 * /api/admin/relay/logs 中转站调用日志查询(P0-5b 配套,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET /admin/relay/logs — 调用日志列表(筛选 userId/model/status/apiKeyId/provider/clientIp/latency/httpStatus/cost/时间范围,分页)
 * 2. GET /admin/relay/logs/stats — 聚合统计(按模型/按日 统计 token + 成本 + 调用次数)
 * 3. GET /admin/relay/logs/error-clusters — 错误聚类(按 error_message 前 80 字符 group by,定位错误突增)
 *
 * 复用 llm_call_logs 表(apiKeyId 关联到 developerApiKeys)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, sql, ilike, or, like, type SQL } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { llmCallLogs, users } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema } from './_shared.js'
import { sanitizeLogEntry } from '../../services/log-sanitizer.js'

const listQuerySchema = paginationSchema.extend({
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  model: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  status: z.transform(emptyToUndefined).pipe(z.enum(['success', 'error']).optional()),
  apiKeyId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  /** 渠道筛选,精确匹配 provider_code */
  provider: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  /** 客户端 IP 筛选,支持 LIKE 通配符(如 '192.168.%')*/
  clientIp: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  /** 最小耗时毫秒,筛选 latency_ms >= minLatency(慢调用分析)*/
  minLatency: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** 最大耗时毫秒 */
  maxLatency: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** HTTP 状态码筛选(如 429 限流/500 错误专项)*/
  httpStatus: z
    .transform(emptyToUndefined)
    .pipe(z.coerce.number().int().min(100).max(599).optional()),
  /** 最小成本分 */
  minCost: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** 最大成本分 */
  maxCost: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** 起始日期 YYYY-MM-DD */
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 结束日期 YYYY-MM-DD */
  endDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 返回原始日志(不脱敏),仅 admin(roleId>=1)可用 */
  raw: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

/** 错误聚类查询 schema(仅支持时间范围筛选)*/
const errorClustersQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  endDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

const statsQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  endDate: z.transform(emptyToUndefined).pipe(
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
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const {
      page,
      pageSize,
      search,
      userId,
      model,
      status,
      startDate,
      endDate,
      apiKeyId,
      provider,
      clientIp,
      minLatency,
      maxLatency,
      httpStatus,
      minCost,
      maxCost,
      raw,
    } = q.data

    const conds: SQL[] = []
    if (userId) conds.push(eq(llmCallLogs.userId, userId))
    if (model) conds.push(eq(llmCallLogs.model, model))
    if (status) conds.push(eq(llmCallLogs.status, status))
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    if (apiKeyId) conds.push(eq(llmCallLogs.apiKeyId, apiKeyId))
    if (provider) conds.push(eq(llmCallLogs.providerCode, provider))
    if (clientIp) conds.push(like(llmCallLogs.clientIp, clientIp))
    if (minLatency !== undefined) conds.push(gte(llmCallLogs.latencyMs, minLatency))
    if (maxLatency !== undefined) conds.push(lte(llmCallLogs.latencyMs, maxLatency))
    if (httpStatus !== undefined) conds.push(eq(llmCallLogs.httpStatus, httpStatus))
    if (minCost !== undefined) conds.push(gte(llmCallLogs.costCents, minCost))
    if (maxCost !== undefined) conds.push(lte(llmCallLogs.costCents, maxCost))
    const where = conds.length > 0 ? and(...conds) : undefined

    // search 搜 model 或 errorMessage
    const searchCond = search
      ? or(ilike(llmCallLogs.model, `%${search}%`), ilike(llmCallLogs.errorMessage, `%${search}%`))
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
            // 高级筛选配套返回字段(字段由 schema subagent 同步添加)
            apiKeyId: llmCallLogs.apiKeyId,
            providerCode: llmCallLogs.providerCode,
            clientIp: llmCallLogs.clientIp,
            costCents: llmCallLogs.costCents,
            httpStatus: llmCallLogs.httpStatus,
            ttftMs: llmCallLogs.ttftMs,
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
      // 日志脱敏集成(2026-07-31 立):默认对所有日志条目调用 sanitizeLogEntry,
      // raw=true 时传 keepOriginalForAdmin:true 跳过脱敏(仅 admin roleId>=1 可用)
      const keepOriginal = raw === 'true' || raw === '1'
      const sanitizedList = list.map((entry) =>
        sanitizeLogEntry(entry, { keepOriginalForAdmin: keepOriginal }),
      )
      reply.header('X-Log-Sanitized', keepOriginal ? 'false' : 'true')
      return reply.send(
        success({ list: sanitizedList, total: totalRows[0]?.c ?? 0, page, pageSize }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志失败'))
    }
  })

  // ===== 2. GET /admin/relay/logs/stats — 聚合统计 =====
  server.get('/admin/relay/logs/stats', async (request, reply) => {
    const q = statsQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
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

  // ===== 3. GET /admin/relay/logs/error-clusters — 错误聚类(2026-07-31 立)=====
  // 按 error_message 前 80 字符 group by,返回 top 20 错误类型 + count + 最近发生时间 + 示例 logId
  // 用于快速定位"今天为什么 500 错误突增"
  server.get('/admin/relay/logs/error-clusters', async (request, reply) => {
    const q = errorClustersQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate } = q.data

    const conds: SQL[] = [
      eq(llmCallLogs.status, 'error'),
      sql`${llmCallLogs.errorMessage} IS NOT NULL`,
    ]
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = and(...conds)

    try {
      const errorPrefix = sql<string>`left(${llmCallLogs.errorMessage}, 80)`
      const rows = await dbRead
        .select({
          errorPrefix: errorPrefix.as('error_prefix'),
          count: sql<number>`count(*)::int`,
          lastSeen: sql<Date>`max(${llmCallLogs.createdAt})`,
          sampleLogId: sql<string>`(array_agg(${llmCallLogs.id} ORDER BY ${llmCallLogs.createdAt} DESC))[1]`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(errorPrefix)
        .orderBy(desc(sql`count(*)::int`))
        .limit(20)

      return reply.send(success({ clusters: rows, total: rows.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询错误聚类失败'))
    }
  })
}

export default relayLogsRoutes
