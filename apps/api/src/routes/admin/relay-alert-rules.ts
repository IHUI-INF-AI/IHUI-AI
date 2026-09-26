// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/alert-rules 告警规则引擎管理端点(2026-09-16 立,补强 U)。
 *
 * 端点清单(全部 requireAdmin,与 relay-pricing 同口径):
 * 1. GET    /relay/alert-rules           — 规则列表
 * 2. POST   /relay/alert-rules           — 新建规则
 * 3. PATCH  /relay/alert-rules/:id       — 更新规则
 * 4. DELETE /relay/alert-rules/:id       — 删除规则
 * 5. GET    /relay/alert-rules/events    — 最近告警事件流(默认 50 条)
 * 6. POST   /relay/alert-rules/evaluate  — 立即评估(返回 evaluated/triggered/skipped)
 *
 * 注册由主会话接线到 routes/index.ts(prefix /api/admin)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'
import {
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listRecentAlertEvents,
  listAlertSilences,
  createAlertSilence,
  deleteAlertSilence,
  validateAlertRuleInput,
  type AlertMetric,
} from '../../services/relay-alert-rules-service.js'
import { runAlertRuleEvaluation } from '../../jobs/relay-alert-rules-evaluation.js'

const ruleBodySchema = z.object({
  name: z.string().min(1).max(100),
  metric: z.enum(['error_rate_1h', 'avg_latency_1h', 'failed_calls_24h', 'low_balance_keys']),
  comparison: z.enum(['gt', 'lt']).default('gt'),
  threshold: z.coerce.number(),
  cooldownMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  enabled: z.coerce.boolean().optional(),
  remark: z.transform(emptyToUndefined).pipe(z.string().max(255).optional()).nullable().optional(),
})

const rulePatchSchema = ruleBodySchema.partial()

const silenceBodySchema = z.object({
  scope: z.enum(['rule', 'all']),
  ruleId: z.string().uuid().optional(),
  reason: z.string().max(255).optional(),
  endsAt: z.string().min(1),
  createdBy: z.string().max(64).optional(),
})

const adminRelayAlertRulesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 规则列表
  server.get('/relay/alert-rules', async (request, reply) => {
    try {
      const list = await listAlertRules()
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询告警规则失败'))
    }
  })

  // 2. 新建规则
  server.post('/relay/alert-rules', async (request, reply) => {
    const parsed = ruleBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    const d = parsed.data
    const invalid = validateAlertRuleInput({
      name: d.name,
      metric: d.metric,
      comparison: d.comparison,
      threshold: d.threshold,
      cooldownMinutes: d.cooldownMinutes,
    })
    if (invalid) return reply.status(400).send(error(400, invalid))
    try {
      const row = await createAlertRule({
        name: d.name,
        metric: d.metric as AlertMetric,
        comparison: d.comparison,
        threshold: d.threshold,
        cooldownMinutes: d.cooldownMinutes,
        enabled: d.enabled,
        remark: d.remark ?? null,
      })
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建告警规则失败'))
    }
  })

  // 3. 更新规则
  server.patch('/relay/alert-rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    const parsed = rulePatchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const row = await updateAlertRule(idParsed.data.id, parsed.data)
      if (!row) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新告警规则失败'))
    }
  })

  // 4. 删除规则
  server.delete('/relay/alert-rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    try {
      const okDeleted = await deleteAlertRule(idParsed.data.id)
      if (!okDeleted) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success({ deleted: okDeleted }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除告警规则失败'))
    }
  })

  // 5. 最近告警事件流
  server.get('/relay/alert-rules/events', async (request, reply) => {
    try {
      const q = z
        .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
        .safeParse(request.query ?? {})
      const limit = q.success ? (q.data.limit ?? 50) : 50
      const events = await listRecentAlertEvents(limit)
      return reply.send(success({ events, total: events.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询告警事件失败'))
    }
  })

  // 6. 立即评估(管理端手动触发;调度器每 5 分钟也会自动评估)
  server.post('/relay/alert-rules/evaluate', async (request, reply) => {
    try {
      const result = await runAlertRuleEvaluation()
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '评估告警规则失败'))
    }
  })

  // 7. 告警静默(2026-09-16 立,对标竞品 /alert-silences):维护窗口/已知故障期抑制告警。
  //    scope=all 抑制全部规则 / scope=rule 抑制指定规则;到期自动失效,评估触发前检查。
  server.get('/relay/alert-silences', async (request, reply) => {
    try {
      const list = await listAlertSilences(false)
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询告警静默失败'))
    }
  })

  server.post('/relay/alert-silences', async (request, reply) => {
    const parsed = silenceBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    const d = parsed.data
    if (d.scope === 'rule' && !d.ruleId) {
      return reply.status(400).send(error(400, 'scope=rule 时必须指定 ruleId'))
    }
    try {
      const row = await createAlertSilence({
        scope: d.scope,
        ruleId: d.ruleId ?? null,
        reason: d.reason ?? null,
        endsAt: new Date(d.endsAt),
        createdBy: d.createdBy ?? null,
      })
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建告警静默失败'))
    }
  })

  server.delete('/relay/alert-silences/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '静默 id 不合法'))
    try {
      const okDeleted = await deleteAlertSilence(idParsed.data.id)
      if (!okDeleted) return reply.status(404).send(error(404, '静默不存在'))
      return reply.send(success({ deleted: okDeleted }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除告警静默失败'))
    }
  })
}
export default adminRelayAlertRulesRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
