/**
 * AI 能力(从 frontend-stub-other-routes.ts 拆分)。
 * GET /v1/ai/capabilities/{list,categories,invoke,auto-match}
 * 注:/v1/ai/capabilities/ws/stream 真实实现在 plugins/ws-ai.ts (WebSocket 端点),此处不注册 HTTP 路由
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { aiCapabilities, aiCapabilityTemplates } from '@ihui/database'
import { parsePagination } from './_shared.js'

export const aiCapabilityRoutes: FastifyPluginAsync = async (server) => {
  // GET /v1/ai/capabilities/list — AI 能力列表
  server.get('/v1/ai/capabilities/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(aiCapabilities.enabled, true)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiCapabilities)
        .where(where)
        .orderBy(desc(aiCapabilities.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiCapabilities)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/ai/capabilities/categories — AI 能力分类(去重 + 模板)
  server.get('/v1/ai/capabilities/categories', async (_request, reply) => {
    const [categoryRows, templateRows] = await Promise.all([
      dbRead
        .select({ category: aiCapabilities.category })
        .from(aiCapabilities)
        .where(eq(aiCapabilities.enabled, true))
        .groupBy(aiCapabilities.category),
      dbRead.select().from(aiCapabilityTemplates).orderBy(desc(aiCapabilityTemplates.useCount)),
    ])
    return reply.send(
      success({
        categories: categoryRows.map((r) => r.category),
        templates: templateRows,
      }),
    )
  })

  // GET /v1/ai/capabilities/invoke — 能力调用说明(真实 invoke 需转发到 AI service)
  server.get('/v1/ai/capabilities/invoke', async (request, reply) => {
    const q = z.object({ name: z.string().min(1) }).safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const [cap] = await dbRead
      .select()
      .from(aiCapabilities)
      .where(and(eq(aiCapabilities.name, q.data.name), eq(aiCapabilities.enabled, true)))
      .limit(1)
    if (!cap) return reply.status(404).send(error(404, '能力不存在'))
    return reply.send(
      success({
        capability: cap,
        invokeUrl: '/api/ai-ext/capabilities/invoke',
        message: '请通过 POST /api/ai-ext/capabilities/invoke 调用',
      }),
    )
  })

  // GET /v1/ai/capabilities/auto-match — 按输入自动匹配能力
  server.get('/v1/ai/capabilities/auto-match', async (request, reply) => {
    const q = z
      .object({
        input: z.string().min(1).max(500),
        category: z.string().optional(),
      })
      .safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const conds = [eq(aiCapabilities.enabled, true)]
    if (q.data.category) conds.push(eq(aiCapabilities.category, q.data.category))
    const list = await dbRead
      .select()
      .from(aiCapabilities)
      .where(and(...conds))
      .orderBy(desc(aiCapabilities.qualityScore))
      .limit(5)
    return reply.send(success({ list, matched: list.length > 0 }))
  })
}
