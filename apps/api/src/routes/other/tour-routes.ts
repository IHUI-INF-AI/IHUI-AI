/**
 * 旅游(从 frontend-stub-other-routes.ts 拆分)。
 * GET /tour/{permissions,spots}
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, desc, sql } from 'drizzle-orm'
import { success } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { tourContent } from '@ihui/database'
import { parsePagination } from './_shared.js'

export const tourRoutes: FastifyPluginAsync = async (server) => {
  // GET /tour/permissions — 旅游模块权限列表(静态)
  server.get('/tour/permissions', async (_request, reply) => {
    return reply.send(
      success({
        list: [
          { code: 'tour:view', name: '查看旅游内容' },
          { code: 'tour:create', name: '创建旅游内容' },
          { code: 'tour:edit', name: '编辑旅游内容' },
          { code: 'tour:delete', name: '删除旅游内容' },
          { code: 'tour:publish', name: '发布旅游内容' },
        ],
      }),
    )
  })

  // GET /tour/spots — 旅游景点列表(tourContent where type=scenic)
  server.get('/tour/spots', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(tourContent.type, 'scenic'), eq(tourContent.status, 'published'))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(tourContent)
        .where(where)
        .orderBy(desc(tourContent.publishedAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(tourContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })
}
