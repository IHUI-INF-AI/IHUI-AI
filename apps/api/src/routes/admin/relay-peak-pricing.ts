// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/peak-pricing 分时(高峰/低谷)倍率规则管理(2026-09-16 立)。
 *
 * 端点清单(全部 requireAdmin):
 * 1. GET    /relay/peak-pricing/rules        — 规则列表(含未启用)
 * 2. POST   /relay/peak-pricing/rules        — 新建规则
 * 3. PATCH  /relay/peak-pricing/rules/:id    — 更新规则
 * 4. DELETE /relay/peak-pricing/rules/:id    — 删除规则
 * 5. GET    /relay/peak-pricing/preview      — 预览某模型/时刻命中的倍率(排障用)
 *
 * 语义提醒:
 * - 命中即用不叠加,priority 大者优先;无规则时倍率恒为 1(账单不变)。
 * - daysOfWeek 为空 = 每天;startMinute === endMinute = 全天;start > end = 跨天。
 * - 时段一律按 UTC+8 判定。
 * - 写操作后服务内部自动失效 60s 缓存,改完即生效。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'
import {
  listPeakPricingRules,
  createPeakPricingRule,
  updatePeakPricingRule,
  deletePeakPricingRule,
  resolvePeakMultiplier,
  validatePeakRuleInput,
} from '../../services/peak-pricing-service.js'

const ruleBodySchema = z.object({
  name: z.string().min(1).max(64),
  modelId: z.transform(emptyToUndefined).pipe(z.string().max(128).optional()).nullable().optional(),
  providerCode: z
    .transform(emptyToUndefined)
    .pipe(z.string().max(64).optional())
    .nullable()
    .optional(),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
  startMinute: z.coerce.number().int().min(0).max(1439),
  endMinute: z.coerce.number().int().min(0).max(1440),
  multiplier: z.coerce.number().min(0).max(100),
  priority: z.coerce.number().int().min(0).max(10000).optional(),
  enabled: z.coerce.boolean().optional(),
  remark: z.transform(emptyToUndefined).pipe(z.string().max(255).optional()).nullable().optional(),
})

const rulePatchSchema = ruleBodySchema.partial()

const previewQuerySchema = z.object({
  modelId: z.transform(emptyToUndefined).pipe(z.string().min(1).max(128)),
  /** ISO 时间字符串;缺省用当前时刻 */
  at: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

const adminRelayPeakPricingRoutes: FastifyPluginAsync = async (server) => {
  // 权限:全部端点仅管理员(与 relay-pricing / relay-models 同口径)
  server.addHook('preHandler', requireAdmin)

  // 1. 规则列表
  server.get('/relay/peak-pricing/rules', async (request, reply) => {
    try {
      const list = await listPeakPricingRules()
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询分时倍率规则失败'))
    }
  })

  // 2. 新建规则
  server.post('/relay/peak-pricing/rules', async (request, reply) => {
    const parsed = ruleBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    const invalid = validatePeakRuleInput(parsed.data)
    if (invalid) return reply.status(400).send(error(400, invalid))
    try {
      const row = await createPeakPricingRule(parsed.data)
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建分时倍率规则失败'))
    }
  })

  // 3. 更新规则
  server.patch('/relay/peak-pricing/rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    const parsed = rulePatchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const row = await updatePeakPricingRule(idParsed.data.id, parsed.data)
      if (!row) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新分时倍率规则失败'))
    }
  })

  // 4. 删除规则
  server.delete('/relay/peak-pricing/rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    try {
      const okDeleted = await deletePeakPricingRule(idParsed.data.id)
      if (!okDeleted) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success({ deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除分时倍率规则失败'))
    }
  })

  // 5. 预览命中倍率(排障:确认某模型在某时刻实际生效的倍率)
  server.get('/relay/peak-pricing/preview', async (request, reply) => {
    const parsed = previewQuerySchema.safeParse(request.query ?? {})
    if (!parsed.success) return reply.status(400).send(error(400, 'modelId 必填且不合法'))
    const at = parsed.data.at ? new Date(parsed.data.at) : new Date()
    if (Number.isNaN(at.getTime())) return reply.status(400).send(error(400, 'at 时间格式不合法'))
    try {
      const resolved = await resolvePeakMultiplier(parsed.data.modelId, at)
      return reply.send(
        success({
          modelId: parsed.data.modelId,
          at: at.toISOString(),
          multiplier: resolved.multiplier,
          ruleId: resolved.ruleId,
          ruleName: resolved.ruleName,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '解析分时倍率失败'))
    }
  })
}

export default adminRelayPeakPricingRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
