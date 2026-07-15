/**
 * /api/admin/oss/files 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { monitorAlerts, suppressionRules, apiLogs, systemConfigs } from '@ihui/database'
import { eq, ilike, desc, sql, and, or } from 'drizzle-orm'
import { paginationSchema, registerCrud, fields } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const ossFilesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/oss/files', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    try {
      const baseCond = eq(systemConfigs.category, 'oss_file')
      const searchCond = search
        ? or(ilike(systemConfigs.key, `%${search}%`), ilike(systemConfigs.value, `%${search}%`))
        : undefined
      const where = searchCond ? and(baseCond, searchCond) : baseCond
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(systemConfigs)
          .where(where)
          .orderBy(desc(systemConfigs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(systemConfigs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 OSS 文件列表失败'))
    }
  })

  // ===========================================================================
  // 6. 监控/运维模块 — 路由已迁移至 admin-monitoring-routes.ts
  // ===========================================================================
  registerCrud(server, '/monitor/alerts', monitorAlerts, {
    searchField: monitorAlerts.name,
    hasUpdatedAt: false,
    map: fields({
      name: 'string',
      source: 'string',
      severity: 'string',
      status: 'string',
      message: 'string',
      labels: 'json',
      annotations: 'json',
      firedAt: 'date',
      resolvedAt: 'date',
    }),
  })
  registerCrud(server, '/monitor/alert-rules', suppressionRules, {
    searchField: suppressionRules.name,
    map: fields({
      name: 'string',
      matchLabels: 'json',
      matchSource: 'string',
      isActive: 'boolean',
      suppressMinutes: 'number',
    }),
  })
  // /monitor/perf, /monitor/services — 已迁移至 admin-monitoring-routes.ts
  registerCrud(server, '/monitoring/logs', apiLogs, {
    searchField: apiLogs.path,
    hasUpdatedAt: false,
    map: fields({
      userId: 'string',
      method: 'string',
      path: 'string',
      statusCode: 'number',
      duration: 'number',
      ip: 'string',
      userAgent: 'string',
      requestBody: 'json',
      responseBody: 'json',
      error: 'string',
    }),
  })
  // /monitoring/perf, /monitoring/services, /performance-dashboard/*, /system/monitor/* — 已迁移至 admin-monitoring-routes.ts
}

export default ossFilesRoutes
