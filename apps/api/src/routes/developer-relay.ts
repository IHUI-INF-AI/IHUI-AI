/**
 * /api/developer/relay 中转站用户侧端点(P0-5f 配套,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET  /developer/relay/keys     — 当前用户的 API Key 列表(含 tokenBalance/costBalanceCents 余额)
 * 2. GET  /developer/relay/usage    — 当前用户的用量明细(按模型/按日 聚合)
 * 3. GET  /developer/relay/logs     — 当前用户的调用日志(分页)
 * 4. POST /developer/relay/keys/:id/recharge — 充值(用钱包余额充值 API Key 余额,生产环境需接支付)
 *
 * 复用 developerApiKeys + llmCallLogs 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, desc, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { developerApiKeys, llmCallLogs } from '@ihui/database'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import { paginationSchema } from './admin/_shared.js'
import { adjustBalance } from '../services/relay-billing-service.js'
import { idParamSchema } from './admin/_shared.js'

const usageQuerySchema = z.object({
  /** 起始日期 YYYY-MM-DD(默认近 30 天) */
  startDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 分组维度:model / day(默认 model) */
  groupBy: z.enum(['model', 'day']).default('model'),
})

const logsQuerySchema = paginationSchema.extend({
  model: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['success', 'error']).optional()),
})

const rechargeBodySchema = z.object({
  /** 充值 token 数(与 costCentsCents 二选一,或都填) */
  tokenDelta: z.number().int().optional(),
  /** 充值成本额度(分) */
  costDeltaCents: z.number().int().optional(),
}).refine(
  (d) => (d.tokenDelta !== undefined && d.tokenDelta !== 0) || (d.costDeltaCents !== undefined && d.costDeltaCents !== 0),
  { message: 'tokenDelta 或 costDeltaCents 至少填一个且非 0' },
)

const developerRelayRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // ===== 1. GET /developer/relay/keys — API Key 列表(含余额,脱敏 secret) =====
  server.get('/developer/relay/keys', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    try {
      const rows = await dbRead
        .select({
          id: developerApiKeys.id,
          name: developerApiKeys.name,
          key: developerApiKeys.key,
          permissions: developerApiKeys.permissions,
          status: developerApiKeys.status,
          rateLimit: developerApiKeys.rateLimit,
          tokenBalance: developerApiKeys.tokenBalance,
          costBalanceCents: developerApiKeys.costBalanceCents,
          tokenUsedTotal: developerApiKeys.tokenUsedTotal,
          costUsedTotalCents: developerApiKeys.costUsedTotalCents,
          lastUsedAt: developerApiKeys.lastUsedAt,
          createdAt: developerApiKeys.createdAt,
          updatedAt: developerApiKeys.updatedAt,
        })
        .from(developerApiKeys)
        .where(eq(developerApiKeys.userId, userId))
        .orderBy(desc(developerApiKeys.createdAt))
      return reply.send(success({ list: rows }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 API Key 列表失败'))
    }
  })

  // ===== 2. GET /developer/relay/usage — 用量明细(按模型/按日 聚合) =====
  server.get('/developer/relay/usage', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = usageQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { startDate, groupBy } = q.data

    const conds: ReturnType<typeof eq>[] = [eq(llmCallLogs.userId, userId)]
    if (startDate) {
      conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    } else {
      // 默认近 30 天
      conds.push(gte(llmCallLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    }
    const where = and(...conds)

    try {
      const groupCol =
        groupBy === 'day'
          ? sql<string>`to_char(${llmCallLogs.createdAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`
          : sql<string>`${llmCallLogs.model}`

      const rows = await dbRead
        .select({
          groupKey: groupCol.as('group_key'),
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          promptTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint::int`,
          completionTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint::int`,
          successCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'success')::int`,
          errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(groupCol)
        .orderBy(desc(sql`count(*)::int`))
        .limit(100)

      // 汇总
      const [summary] = await dbRead
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int`,
        })
        .from(llmCallLogs)
        .where(where)

      return reply.send(
        success({
          groupBy,
          rows,
          summary: {
            totalCalls: summary?.totalCalls ?? 0,
            totalTokens: summary?.totalTokens ?? 0,
            totalCostCents: summary?.totalCostCents ?? 0,
          },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询用量明细失败'))
    }
  })

  // ===== 3. GET /developer/relay/logs — 调用日志(分页) =====
  server.get('/developer/relay/logs', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = logsQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, model, status } = q.data

    const conds: ReturnType<typeof eq>[] = [eq(llmCallLogs.userId, userId)]
    if (model) conds.push(eq(llmCallLogs.model, model))
    if (status) conds.push(eq(llmCallLogs.status, status))
    const where = and(...conds)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: llmCallLogs.id,
            model: llmCallLogs.model,
            promptTokens: llmCallLogs.promptTokens,
            completionTokens: llmCallLogs.completionTokens,
            totalTokens: llmCallLogs.totalTokens,
            latencyMs: llmCallLogs.latencyMs,
            status: llmCallLogs.status,
            errorMessage: llmCallLogs.errorMessage,
            metadata: llmCallLogs.metadata,
            createdAt: llmCallLogs.createdAt,
          })
          .from(llmCallLogs)
          .where(where)
          .orderBy(desc(llmCallLogs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(llmCallLogs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志失败'))
    }
  })

  // ===== 4. POST /developer/relay/keys/:id/recharge — 充值 API Key 余额 =====
  server.post('/developer/relay/keys/:id/recharge', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = rechargeBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    // 校验 Key 归属权
    const [existing] = await dbRead
      .select({ id: developerApiKeys.id, userId: developerApiKeys.userId })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, p.data.id))
      .limit(1)
    if (!existing || existing.userId !== userId)
      return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))

    try {
      const result = await adjustBalance(
        p.data.id,
        parsed.data.tokenDelta ?? 0,
        parsed.data.costDeltaCents ?? 0,
      )
      if (!result) return reply.status(404).send(error(404, 'API Key 不存在'))
      return reply.send(success({ id: p.data.id, ...result }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '充值失败'))
    }
  })
}

export default developerRelayRoutes
