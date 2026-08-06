/**
 * /api/admin/relay/pricing 模型价格历史 + 限时折扣调度 + 动态调价建议
 * (2026-08-01 立,P0 中转站造血能力对标批次)。
 *
 * 端点清单:
 * 1. GET    /admin/relay/pricing/history         — 价格历史(趋势曲线,?modelId=xxx&days=30)
 * 2. POST   /admin/relay/pricing/history         — 记录调价(改倍率时调,写历史快照)
 * 3. GET    /admin/relay/pricing/discounts       — 列限时折扣(?enabled=&modelId=)
 * 4. POST   /admin/relay/pricing/discounts       — 建折扣(预设)
 * 5. PATCH  /admin/relay/pricing/discounts/:id   — 改折扣
 * 6. DELETE /admin/relay/pricing/discounts/:id   — 删折扣
 * 7. GET    /admin/relay/pricing/suggestions     — 动态调价建议(按 7d 利润率)
 *
 * 全部 requireAdmin。复用 model_price_history + price_discount_schedules 表 +
 * price-history-service.ts。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { booleanStringSchemaOptional } from '../../utils/parse-boolean.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'
import {
  recordPriceChange,
  getPriceHistory,
  listDiscountSchedules,
  createDiscountSchedule,
  updateDiscountSchedule,
  deleteDiscountSchedule,
  getPricingSuggestions,
} from '../../services/price-history-service.js'

// =============================================================================
// Zod 校验 schema
// =============================================================================

const historyQuerySchema = z.object({
  modelId: z.transform(emptyToUndefined).pipe(z.string().min(1).max(128)),
  days: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).max(365).optional()),
})

const recordHistoryBodySchema = z.object({
  modelId: z.string().min(1, 'model_id 不能为空').max(128),
  inputTokenPriceCents: z.number().int().min(0, '输入单价不能为负'),
  outputTokenPriceCents: z.number().int().min(0, '输出单价不能为负'),
  relayMultiplier: z.number().min(0.01, '倍率必须 > 0').max(99.99, '倍率不能超过 99.99'),
  reason: z.string().max(256).optional(),
  changedBy: z.uuid().optional(),
})

const listDiscountsQuerySchema = z.object({
  // P1 修复(2026-08-06):z.coerce.boolean() 将 "false"/"0" 解析为 true,改用严格布尔 schema
  enabled: booleanStringSchemaOptional,
  modelId: z.transform(emptyToUndefined).pipe(z.string().max(128).optional()),
})

const createDiscountBodySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(128),
  /** null=全部模型,不传默认 null */
  modelId: z.string().max(128).nullable().optional(),
  /** 0.80 = 8 折 */
  discountMultiplier: z.number().min(0.01, '折扣倍率必须 > 0').max(99.99),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  enabled: z.boolean().optional(),
  createdBy: z.uuid().optional(),
})

const updateDiscountBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  modelId: z.string().max(128).nullable().optional(),
  discountMultiplier: z.number().min(0.01).max(99.99).optional(),
  startsAt: z.transform(emptyToUndefined).pipe(z.iso.datetime().optional()),
  endsAt: z.transform(emptyToUndefined).pipe(z.iso.datetime().optional()),
  enabled: z.boolean().optional(),
})

// =============================================================================
// 路由
// =============================================================================

const adminRelayPricingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/pricing/history — 价格历史 =====
  server.get('/admin/relay/pricing/history', async (request, reply) => {
    const q = historyQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const list = await getPriceHistory(q.data.modelId, q.data.days)
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询价格历史失败'))
    }
  })

  // ===== 2. POST /admin/relay/pricing/history — 记录调价 =====
  server.post('/admin/relay/pricing/history', async (request, reply) => {
    const parsed = recordHistoryBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      await recordPriceChange({
        modelId: parsed.data.modelId,
        inputTokenPriceCents: parsed.data.inputTokenPriceCents,
        outputTokenPriceCents: parsed.data.outputTokenPriceCents,
        relayMultiplier: parsed.data.relayMultiplier,
        reason: parsed.data.reason,
        changedBy: parsed.data.changedBy,
      })
      return reply.status(201).send(success({ recorded: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '记录调价历史失败'))
    }
  })

  // ===== 3. GET /admin/relay/pricing/discounts — 列限时折扣 =====
  server.get('/admin/relay/pricing/discounts', async (request, reply) => {
    const q = listDiscountsQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const list = await listDiscountSchedules({
        enabled: q.data.enabled,
        modelId: q.data.modelId,
      })
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询限时折扣失败'))
    }
  })

  // ===== 4. POST /admin/relay/pricing/discounts — 建折扣 =====
  server.post('/admin/relay/pricing/discounts', async (request, reply) => {
    const parsed = createDiscountBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 校验时间窗口
    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    if (endsAt <= startsAt) {
      return reply.status(400).send(error(400, 'endsAt 必须晚于 startsAt'))
    }

    try {
      const row = await createDiscountSchedule({
        name: parsed.data.name,
        modelId: parsed.data.modelId ?? null,
        discountMultiplier: parsed.data.discountMultiplier,
        startsAt,
        endsAt,
        enabled: parsed.data.enabled ?? true,
        createdBy: parsed.data.createdBy,
      })
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建限时折扣失败'))
    }
  })

  // ===== 5. PATCH /admin/relay/pricing/discounts/:id — 改折扣 =====
  server.patch('/admin/relay/pricing/discounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = updateDiscountBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send(error(400, '至少更新一个字段'))
    }

    // 校验时间窗口(若同时传了 startsAt/endsAt)
    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined
    const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined
    if (startsAt && endsAt && endsAt <= startsAt) {
      return reply.status(400).send(error(400, 'endsAt 必须晚于 startsAt'))
    }

    try {
      const row = await updateDiscountSchedule(p.data.id, {
        name: parsed.data.name,
        modelId: parsed.data.modelId,
        discountMultiplier: parsed.data.discountMultiplier,
        startsAt,
        endsAt,
        enabled: parsed.data.enabled,
      })
      if (!row) return reply.status(404).send(error(404, '折扣不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新限时折扣失败'))
    }
  })

  // ===== 6. DELETE /admin/relay/pricing/discounts/:id — 删折扣 =====
  server.delete('/admin/relay/pricing/discounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))

    try {
      const deleted = await deleteDiscountSchedule(p.data.id)
      if (!deleted) return reply.status(404).send(error(404, '折扣不存在'))
      return reply.send(success({ id: p.data.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除限时折扣失败'))
    }
  })

  // ===== 7. GET /admin/relay/pricing/suggestions — 动态调价建议 =====
  server.get('/admin/relay/pricing/suggestions', async (request, reply) => {
    try {
      const list = await getPricingSuggestions()
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '生成调价建议失败'))
    }
  })
}

export default adminRelayPricingRoutes
