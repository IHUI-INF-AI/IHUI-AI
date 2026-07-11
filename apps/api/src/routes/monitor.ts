import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { monitorAlerts, suppressionRules } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { getAuditLog } from '../services/canary-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const alertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  severity: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  source: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
})

// =============================================================================
// 路由
// =============================================================================

const monitorRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有监控端点需管理员权限
  server.addHook('preHandler', requireAdmin)

  // GET /alerts — 告警历史（分页 + status/severity/source 筛选）
  server.get('/alerts', async (request, reply) => {
    const parsed = alertsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, severity, source } = parsed.data
    const offset = (page - 1) * pageSize
    const conditions = [eq(monitorAlerts.status, status ?? 'firing')]
    if (severity) conditions.push(eq(monitorAlerts.severity, severity))
    if (source) conditions.push(eq(monitorAlerts.source, source))

    const list = await db
      .select()
      .from(monitorAlerts)
      .where(and(...conditions))
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(pageSize)
      .offset(offset)

    return reply.send(success({ list, page, pageSize }))
  })

  // GET /backfill-status — 回填状态（返回抑制规则数量作为回填进度近似指标）
  server.get('/backfill-status', async (_request, reply) => {
    const rules = await db
      .select()
      .from(suppressionRules)
      .where(eq(suppressionRules.isActive, true))
    const firingAlerts = await db
      .select()
      .from(monitorAlerts)
      .where(eq(monitorAlerts.status, 'firing'))
    return reply.send(
      success({
        activeSuppressionRules: rules.length,
        firingAlerts: firingAlerts.length,
        status: 'idle',
      }),
    )
  })

  // GET /suppression-rules — 抑制规则列表
  server.get('/suppression-rules', async (_request, reply) => {
    const list = await db.select().from(suppressionRules).orderBy(desc(suppressionRules.createdAt))
    return reply.send(success({ list }))
  })

  // GET /canary-audit — 金丝雀审计（调用 canary-service 获取审计日志）
  server.get('/canary-audit', async (request, reply) => {
    const { configName } = request.query as { configName?: string }
    const list = await getAuditLog(configName)
    return reply.send(success({ list }))
  })
}

export default monitorRoutes
