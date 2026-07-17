/**
 * /api/admin/oss/files 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { monitorAlerts, suppressionRules, apiLogs, systemConfigs } from '@ihui/database'
import { eq, ilike, desc, sql, and, or, inArray } from 'drizzle-orm'
import { paginationSchema, registerCrud, fields, idParamSchema } from './_shared.js'

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

  // POST /oss/files/batch-delete - 批量删除 OSS 文件(systemConfigs 表 category='oss_file')
  const batchDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) })
  server.post('/oss/files/batch-delete', async (request, reply) => {
    const parsed = batchDeleteSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const rows = await db
        .delete(systemConfigs)
        .where(
          and(eq(systemConfigs.category, 'oss_file'), inArray(systemConfigs.id, parsed.data.ids)),
        )
        .returning({ id: systemConfigs.id })
      return reply.send(success({ deleted: rows.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量删除 OSS 文件失败'))
    }
  })

  // GET /oss/files/:id/base64 - 获取 OSS 文件 base64 内容
  server.get('/oss/files/:id/base64', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [row] = await db
        .select()
        .from(systemConfigs)
        .where(and(eq(systemConfigs.category, 'oss_file'), eq(systemConfigs.id, p.data.id)))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '文件不存在'))
      let info: { url?: string; path?: string; mimeType?: string } = {}
      try {
        info = JSON.parse(row.value) as typeof info
      } catch {
        info = { url: row.value }
      }
      const fileUrl = info.url ?? info.path
      if (!fileUrl) return reply.status(404).send(error(404, '文件 URL 不存在'))
      const resp = await fetch(fileUrl)
      if (!resp.ok) return reply.status(502).send(error(502, '获取文件内容失败'))
      const buf = Buffer.from(await resp.arrayBuffer())
      const base64 = buf.toString('base64')
      const mimeType =
        resp.headers.get('content-type') ?? info.mimeType ?? 'application/octet-stream'
      return reply.send(success({ base64, mimeType }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '获取文件 base64 失败'))
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
