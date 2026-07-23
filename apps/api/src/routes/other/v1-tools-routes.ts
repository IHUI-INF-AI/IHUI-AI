/**
 * v1 工具(从 frontend-stub-other-routes.ts 拆分)。
 * GET /v1/tools/{list,categories,upload}
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, asc, desc, sql } from 'drizzle-orm'
import { success } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { tools } from '@ihui/database'
import { parsePagination } from './_shared.js'

export const v1ToolsRoutes: FastifyPluginAsync = async (server) => {
  // GET /v1/tools/list — 工具列表
  server.get('/v1/tools/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(tools.status, 'published')
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(tools)
        .where(where)
        .orderBy(asc(tools.sortOrder), desc(tools.rating))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/tools/categories — 工具分类(去重)
  server.get('/v1/tools/categories', async (_request, reply) => {
    const rows = await dbRead
      .select({ category: tools.category })
      .from(tools)
      .where(eq(tools.status, 'published'))
      .groupBy(tools.category)
      .orderBy(asc(tools.category))
    return reply.send(success({ list: rows.map((r) => r.category) }))
  })

  // GET /v1/tools/upload — 工具上传配置
  server.get('/v1/tools/upload', async (_request, reply) => {
    return reply.send(
      success({
        uploadUrl: '/api/upload/init',
        maxFileSize: 100 * 1024 * 1024,
        allowedTypes: ['image/*', 'application/pdf', 'video/*'],
      }),
    )
  })
}
