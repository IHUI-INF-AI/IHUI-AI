import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, count } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { monitorAlerts } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const errorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  level: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
})

export const adminErrorDashboardRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /error-dashboard/stats — 错误统计
  server.get('/error-dashboard/stats', async (_request, reply) => {
    const [totalRow] = await dbRead.select({ total: count() }).from(monitorAlerts)

    const [todayRow] = await dbRead
      .select({ total: count() })
      .from(monitorAlerts)
      .where(sql`${monitorAlerts.createdAt} > now() - interval '1 day'`)

    const [criticalRow] = await dbRead
      .select({ total: count() })
      .from(monitorAlerts)
      .where(eq(monitorAlerts.severity, 'critical'))

    const [resolvedRow] = await dbRead
      .select({ total: count() })
      .from(monitorAlerts)
      .where(eq(monitorAlerts.status, 'resolved'))

    return reply.send(
      success({
        total: totalRow?.total ?? 0,
        today: todayRow?.total ?? 0,
        critical: criticalRow?.total ?? 0,
        resolved: resolvedRow?.total ?? 0,
      }),
    )
  })

  // GET /error-dashboard/errors — 错误列表（支持 level/status 筛选）
  server.get('/error-dashboard/errors', async (request, reply) => {
    const parsed = errorsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, level, status } = parsed.data
    const offset = (page - 1) * pageSize
    const conditions = []
    if (level) conditions.push(eq(monitorAlerts.severity, level))
    if (status) conditions.push(eq(monitorAlerts.status, status))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const list = await dbRead
      .select()
      .from(monitorAlerts)
      .where(where)
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(pageSize)
      .offset(offset)

    return reply.send(success({ list, page, pageSize }))
  })
}
