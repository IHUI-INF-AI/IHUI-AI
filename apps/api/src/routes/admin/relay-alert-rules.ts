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
 * 7. GET    /relay/alert-silences        — 告警静默列表
 * 8. POST   /relay/alert-silences/batch-delete — 批量删除静默(支持 expectedIds 执行前复验)
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
import { isUuidString } from '../../utils/uuid.js'

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

/**
 * 批量处置静默的"确认集合"入参(票2,G-998148,出处 b76-12b)。
 *
 * `expectedIds` = **确认框打开时看到的静默 id 集合**。CLI/服务端在执行批量删除**前**复验:
 * 当前存量集合必须与它完全一致(只比集合、不比顺序),否则整体拒绝、一条都不删 ——
 * 防止确认框打开后桌面/手机并发增删,把用户没确认过的新静默一并处置、或对已消失的静默空删。
 *
 * 缺省(不携带)= 迁移期放行,行为与旧单条删除一致;显式携带 = 复验。
 * 复验失败回 409 + 独立错误码 `EXPECTED_IDS_CHANGED`(不复用容量/权限码),
 * 响应体回带 `addedIds`(新增未确认的)/ `removedIds`(已消失的)/ `currentIds`(现存全集)。
 */
const batchSilenceDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  expectedIds: z.array(z.string().uuid()).optional(),
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
    if (!isUuidString(idParsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
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
    if (!isUuidString(idParsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
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
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(idParsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    try {
      const okDeleted = await deleteAlertSilence(idParsed.data.id)
      if (!okDeleted) return reply.status(404).send(error(404, '静默不存在'))
      return reply.send(success({ deleted: okDeleted }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除告警静默失败'))
    }
  })

  // 8. 批量删除静默(票2,G-998148):expectedIds 缺省=迁移期放行;显式携带=执行前复验集合一致性。
  server.post('/relay/alert-silences/batch-delete', async (request, reply) => {
    const parsed = batchSilenceDeleteSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    // 去重:重复 id 只处置一次,计数不得虚增(与 batchWriteOutcome 的库确认口径同精神)。
    const targetIds = [...new Set(parsed.data.ids)]
    try {
      if (parsed.data.expectedIds) {
        // 执行前复验:当前存量集合必须与确认窗集合完全一致,不一致则整体拒绝、一条不动。
        const currentRows = await listAlertSilences(false)
        const currentIds = currentRows.map((r) => r.id)
        const currentSet = new Set(currentIds)
        const expectedSet = new Set(parsed.data.expectedIds)
        const addedIds = currentIds.filter((id) => !expectedSet.has(id))
        const removedIds = [...new Set(parsed.data.expectedIds)].filter((id) => !currentSet.has(id))
        if (addedIds.length > 0 || removedIds.length > 0) {
          const detail = [
            addedIds.length > 0 ? `新增未确认的 ${addedIds.join(', ')}` : '',
            removedIds.length > 0 ? `已消失的 ${removedIds.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('；')
          return reply.status(409).send({
            code: 409,
            message: `告警静默集合已变化（${detail}），请刷新确认窗后重试`,
            errorCode: 'EXPECTED_IDS_CHANGED',
            data: { addedIds, removedIds, currentIds },
          })
        }
      }
      const deletedIds: string[] = []
      const missedIds: string[] = []
      for (const id of targetIds) {
        if (await deleteAlertSilence(id)) deletedIds.push(id)
        else missedIds.push(id)
      }
      return reply.send(success({ deleted: deletedIds.length, deletedIds, missedIds }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量删除告警静默失败'))
    }
  })
}
export default adminRelayAlertRulesRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
