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
    const { configName } = z.object({ configName: z.string().optional() }).parse(request.query)
    const list = await getAuditLog(configName)
    return reply.send(success({ list }))
  })

  // ===========================================================================
  // 抑制规则实验场 (inhibition playground)
  // ===========================================================================

  // POST /suppression-rules — 创建抑制规则
  server.post('/suppression-rules', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(200),
        matchLabels: z.record(z.string(), z.string()).default({}),
        matchSource: z.string().max(100).optional(),
        isActive: z.boolean().default(true),
        suppressMinutes: z.number().int().min(1).max(10080).default(60),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(suppressionRules)
      .values({
        name: body.data.name,
        matchLabels: body.data.matchLabels,
        matchSource: body.data.matchSource ?? null,
        isActive: body.data.isActive,
        suppressMinutes: body.data.suppressMinutes,
      })
      .returning()
    return reply.status(201).send(success(created))
  })

  // PUT /suppression-rules/:id — 更新抑制规则
  server.put('/suppression-rules/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        matchLabels: z.record(z.string(), z.string()).optional(),
        matchSource: z.string().max(100).optional(),
        isActive: z.boolean().optional(),
        suppressMinutes: z.number().int().min(1).max(10080).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [updated] = await db
      .update(suppressionRules)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(suppressionRules.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '抑制规则不存在'))
    return reply.send(success(updated))
  })

  // DELETE /suppression-rules/:id — 删除抑制规则
  server.delete('/suppression-rules/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const [deleted] = await db
      .delete(suppressionRules)
      .where(eq(suppressionRules.id, id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '抑制规则不存在'))
    return reply.send(success({ success: true }))
  })

  // POST /inhibition-playground — 抑制规则实验场:输入告警标签,返回命中的抑制规则
  server.post('/inhibition-playground', async (request, reply) => {
    const body = z
      .object({
        labels: z.record(z.string(), z.string()).default({}),
        source: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const rules = await db
      .select()
      .from(suppressionRules)
      .where(eq(suppressionRules.isActive, true))
    const matched = rules.filter((r) => {
      if (r.matchSource && body.data.source && r.matchSource !== body.data.source) return false
      const matchLabels = (r.matchLabels ?? {}) as Record<string, string>
      return Object.entries(matchLabels).every(([k, v]) => body.data.labels[k] === v)
    })
    return reply.send(
      success({
        matched: matched.length > 0,
        matchedRules: matched,
        evaluatedLabels: body.data.labels,
        evaluatedSource: body.data.source ?? null,
      }),
    )
  })

  // ===========================================================================
  // 灰度自动提升器 (canary promoter)
  // ===========================================================================

  // GET /canary-promoter/status — 灰度提升状态
  server.get('/canary-promoter/status', async (_request, reply) => {
    const firingAlerts = await db
      .select()
      .from(monitorAlerts)
      .where(eq(monitorAlerts.status, 'firing'))
    const criticalAlerts = firingAlerts.filter((a) => a.severity === 'critical')
    return reply.send(
      success({
        autoPromoteEnabled: criticalAlerts.length === 0,
        firingAlerts: firingAlerts.length,
        criticalAlerts: criticalAlerts.length,
        blockedByCritical: criticalAlerts.length > 0,
        recommendation:
          criticalAlerts.length > 0 ? 'hold' : firingAlerts.length > 5 ? 'slow' : 'promote',
      }),
    )
  })

  // POST /canary-promoter/override — 灰度提升器 override(强制提升/回滚)
  server.post('/canary-promoter/override', async (request, reply) => {
    const body = z
      .object({
        action: z.enum(['promote', 'rollback', 'hold']),
        reason: z.string().max(500).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    return reply.send(
      success({
        action: body.data.action,
        reason: body.data.reason ?? null,
        executedAt: new Date().toISOString(),
        success: true,
      }),
    )
  })
}

export default monitorRoutes
