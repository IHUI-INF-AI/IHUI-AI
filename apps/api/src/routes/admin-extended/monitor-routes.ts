/**
 * 监控告警路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/monitor, /admin/monitoring
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { monitorAlerts } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

export const monitorRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/admin/monitor/alerts/:id/ack',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .update(monitorAlerts)
        .set({ status: 'suppressed' })
        .where(eq(monitorAlerts.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '告警不存在'))
      return reply.send(success(row))
    },
  )
  server.post(
    '/admin/monitor/alerts/:id/resolve',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .update(monitorAlerts)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(monitorAlerts.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '告警不存在'))
      return reply.send(success(row))
    },
  )
  server.get('/admin/monitor/funnel/:id', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.status(501).send(error(501, '监控漏斗暂未实现,无对应数据表'))
  })
  server.get('/admin/monitoring/alerts', { preHandler: requireAdmin }, async (_request, reply) => {
    const list = await db
      .select()
      .from(monitorAlerts)
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(100)
    return reply.send(success({ list, total: list.length }))
  })
}
