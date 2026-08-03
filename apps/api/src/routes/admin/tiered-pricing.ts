/**
 * /api/admin/tiered-pricing 阶梯计价规则管理(2026-08-01 立,用得越多越便宜)。
 *
 * 端点清单:
 * 1. GET    /admin/tiered-pricing/rules         — 规则列表(可按 model 筛选)
 * 2. POST   /admin/tiered-pricing/rules         — 创建规则
 * 3. PATCH  /admin/tiered-pricing/rules/:id     — 更新规则
 * 4. DELETE /admin/tiered-pricing/rules/:id     — 删除规则
 *
 * 全部 requireAdmin。复用 tieredPricingRules 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tieredPricingRules } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const listQuerySchema = z.object({
  /** 按模型筛选(精确匹配 model_id) */
  model: z.transform(emptyToUndefined).pipe(z.string().max(128).optional()),
  /** 只返回启用的规则 */
  enabled: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
})

const createBodySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  /** 模型名,'*' 表示全局规则 */
  modelId: z.string().min(1, 'model_id 不能为空').max(128),
  fromTokens: z.number().int().min(0, 'from_tokens 不能为负'),
  /** null = 无上限 */
  toTokens: z.number().int().min(0).nullable().optional(),
  /** 倍率(0.01-99.99) */
  multiplier: z.number().min(0.01).max(99.99),
  enabled: z.boolean().optional(),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(128).optional(),
  fromTokens: z.number().int().min(0).optional(),
  toTokens: z.number().int().min(0).nullable().optional(),
  multiplier: z.number().min(0.01).max(99.99).optional(),
  enabled: z.boolean().optional(),
})

const tieredPricingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/tiered-pricing/rules — 规则列表 =====
  server.get('/admin/tiered-pricing/rules', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { model, enabled } = q.data

    const conds = []
    if (model) conds.push(eq(tieredPricingRules.modelId, model))
    if (enabled === 'true') conds.push(eq(tieredPricingRules.enabled, true))
    if (enabled === 'false') conds.push(eq(tieredPricingRules.enabled, false))

    const query = db
      .select()
      .from(tieredPricingRules)
      .orderBy(asc(tieredPricingRules.modelId), asc(tieredPricingRules.fromTokens))

    const list = conds.length > 0 ? await query.where(and(...conds)) : await query

    return reply.send(success({ list, total: list.length }))
  })

  // ===== 2. POST /admin/tiered-pricing/rules — 创建规则 =====
  server.post('/admin/tiered-pricing/rules', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const [row] = await db
        .insert(tieredPricingRules)
        .values({
          name: parsed.data.name,
          modelId: parsed.data.modelId,
          fromTokens: parsed.data.fromTokens,
          toTokens: parsed.data.toTokens ?? null,
          multiplier: String(parsed.data.multiplier),
          enabled: parsed.data.enabled ?? true,
        })
        .returning()
      if (!row) return reply.status(500).send(error(500, '创建失败'))
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建阶梯计价规则失败'))
    }
  })

  // ===== 3. PATCH /admin/tiered-pricing/rules/:id — 更新规则 =====
  server.patch('/admin/tiered-pricing/rules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = updateBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    if (Object.keys(parsed.data).length === 0)
      return reply.status(400).send(error(400, '至少更新一个字段'))

    const setClause: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) setClause.name = parsed.data.name
    if (parsed.data.modelId !== undefined) setClause.modelId = parsed.data.modelId
    if (parsed.data.fromTokens !== undefined) setClause.fromTokens = parsed.data.fromTokens
    if (parsed.data.toTokens !== undefined) setClause.toTokens = parsed.data.toTokens
    if (parsed.data.multiplier !== undefined) setClause.multiplier = String(parsed.data.multiplier)
    if (parsed.data.enabled !== undefined) setClause.enabled = parsed.data.enabled

    const [row] = await db
      .update(tieredPricingRules)
      .set(setClause)
      .where(eq(tieredPricingRules.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '规则不存在'))
    return reply.send(success(row))
  })

  // ===== 4. DELETE /admin/tiered-pricing/rules/:id — 删除规则 =====
  server.delete('/admin/tiered-pricing/rules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const [row] = await db
      .delete(tieredPricingRules)
      .where(eq(tieredPricingRules.id, p.data.id))
      .returning({ id: tieredPricingRules.id })
    if (!row) return reply.status(404).send(error(404, '规则不存在'))
    return reply.send(success({ id: row.id }))
  })
}

export default tieredPricingRoutes
