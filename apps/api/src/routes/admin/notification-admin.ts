/**
 * /api/admin/notifications/logs 路由:admin 全量视角通知日志查询。
 * 与 /api/notifications/logs 区别:不强制按当前用户过滤,支持 userId 筛选。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'

const listLogsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  channel: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().optional()),
  userId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
})

const notificationAdminRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/notifications/logs', async (request, reply) => {
    const parsed = listLogsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, type, channel, status, startDate, endDate, userId } = parsed.data
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    if (userId) conds.push(sql`"user_id" = ${userId}`)
    if (type) conds.push(sql`"type" = ${type}`)
    if (channel) conds.push(sql`"channel" = ${channel}`)
    if (status) conds.push(sql`"status" = ${status}`)
    if (startDate) conds.push(sql`"created_at" >= ${startDate}::timestamp`)
    if (endDate) conds.push(sql`"created_at" <= ${`${endDate} 23:59:59`}::timestamp`)
    const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
    try {
      const rows = await db.execute(
        sql`SELECT id, user_id, type, title, content, channel, status, error_message, created_at
            FROM notification_logs
            ${where}
            ORDER BY created_at DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM notification_logs ${where}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询通知日志失败'))
    }
  })
}

export default notificationAdminRoutes
