// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { authenticate, requireActiveUser } from '../plugins/auth.js'
import { requireAdminRouteGuard } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { PRICING_RULE_MODES, pricingRules, type PricingRule } from '@ihui/database'
import { loadActiveRules } from '../services/pricing-engine.js'

/**
 * G4 计费弹性 - 组合定价规则路由(2026-10-30 立)。
 *
 * 用户面:GET /api/pricing-rules —— 登录可见,返回当前生效规则 + 错峰窗口人话说明
 *   (价格公示页数据源;只回 enabled 且落在生效区间的规则)。
 * 管理面:/api/admin/pricing-rules CRUD —— 鉴权对齐 admin.ts 既有风格
 *   (整段挂 requireAdminRouteGuard preHandler,authenticate + requireActiveUser + admin 判定)。
 *
 * 写面纪律:
 * - rule_key 全表唯一,重复创建 409(同模型改价走 PUT 并把 version +1);
 * - DELETE = 软下线(enabled=false, version+1),结算历史里的 ruleId 永远可回查;
 * - PUT 局部更新,未传字段保留原值(同 pricing-service.upsertPricing 的取向)。
 */

// =============================================================================
// Zod 校验 schema
// =============================================================================

const timeOfDayWindowSchema = z.object({
  factor: z.number().min(0),
  tz: z.string().max(64).optional(),
})

const createRuleSchema = z.object({
  ruleKey: z.string().min(1).max(128),
  displayName: z.string().min(1).max(255),
  currency: z.string().max(16).optional().default('CNY'),
  mode: z.enum(PRICING_RULE_MODES),
  basePrice: z.number().min(0),
  tierMultipliers: z.record(z.string(), z.number().min(0)).optional().default({}),
  timeOfDayFactor: z.record(z.string(), timeOfDayWindowSchema).nullable().optional(),
  enabled: z.boolean().optional().default(true),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
})

const updateRuleSchema = createRuleSchema.partial()

/** 唯一约束冲突(PG 23505)→ 409,其余上抛由调用方归位 500 */
function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === '23505'
}

/** 错峰窗口 → 人话说明(用户面价格页直接渲染,不再各自解析 jsonb) */
function describeTimeOfDay(rule: PricingRule): string[] {
  const map = rule.timeOfDayFactor as Record<string, { factor?: number; tz?: string }> | null
  if (!map || typeof map !== 'object') return []
  return Object.entries(map).map(
    ([window, spec]) =>
      `错峰窗口 ${window}(时区 ${spec?.tz ?? 'Asia/Shanghai'}):单价 × ${spec?.factor ?? 1}`,
  )
}

/** 用户面视图:剥掉审计列,附错峰窗口说明 */
function toUserView(rule: PricingRule) {
  return {
    id: rule.id,
    ruleKey: rule.ruleKey,
    displayName: rule.displayName,
    currency: rule.currency,
    mode: rule.mode,
    basePrice: rule.basePrice,
    tierMultipliers: rule.tierMultipliers,
    timeOfDayFactor: rule.timeOfDayFactor,
    timeOfDayDescriptions: describeTimeOfDay(rule),
    version: rule.version,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  }
}

// =============================================================================
// 路由
// =============================================================================

export const pricingRulesRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // 用户面:GET /api/pricing-rules(登录可见)
  // ===========================================================================
  server.get('/pricing-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
      await requireActiveUser(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    }
    const rules = await loadActiveRules(new Date())
    return reply.send(success(rules.map(toUserView)))
  })

  // ===========================================================================
  // 管理面:/api/admin/pricing-rules CRUD
  // 独立 encapsulated 上下文整段挂 requireAdminRouteGuard(对齐 admin.ts L109 姿势)。
  // ===========================================================================
  await server.register(async (admin) => {
    admin.addHook('preHandler', requireAdminRouteGuard)

    // GET /admin/pricing-rules - 全量列表(含停用规则,管理页数据源)
    admin.get('/admin/pricing-rules', async (_request, reply) => {
      const rows = await db.select().from(pricingRules).orderBy(desc(pricingRules.updatedAt))
      return reply.send(success(rows))
    })

    // POST /admin/pricing-rules - 新建规则(version 从 1 起)
    admin.post('/admin/pricing-rules', async (request, reply) => {
      const parsed = createRuleSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const b = parsed.data
      try {
        const [row] = await db
          .insert(pricingRules)
          .values({
            ruleKey: b.ruleKey,
            displayName: b.displayName,
            currency: b.currency,
            mode: b.mode,
            basePrice: b.basePrice,
            tierMultipliers: b.tierMultipliers,
            timeOfDayFactor: b.timeOfDayFactor ?? null,
            enabled: b.enabled,
            version: 1,
            effectiveFrom: b.effectiveFrom ?? new Date(),
            effectiveTo: b.effectiveTo ?? null,
          })
          .returning()
        if (!row) return reply.status(500).send(error(500, '定价规则创建失败'))
        return reply.send(success(row))
      } catch (e) {
        if (isUniqueViolation(e)) {
          return reply.status(409).send(error(409, `规则键已存在: ${b.ruleKey}`))
        }
        return reply.status(500).send(error(500, '定价规则创建失败'))
      }
    })

    // PUT /admin/pricing-rules/:id - 更新规则(version 自动 +1,结算明细可审计回溯)
    admin.put('/admin/pricing-rules/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updateRuleSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const b = parsed.data
      const [existing] = await db.select().from(pricingRules).where(eq(pricingRules.id, id))
      if (!existing) return reply.status(404).send(error(404, '定价规则不存在'))
      try {
        const [row] = await db
          .update(pricingRules)
          .set({
            ...(b.displayName !== undefined ? { displayName: b.displayName } : {}),
            ...(b.currency !== undefined ? { currency: b.currency } : {}),
            ...(b.mode !== undefined ? { mode: b.mode } : {}),
            ...(b.basePrice !== undefined ? { basePrice: b.basePrice } : {}),
            ...(b.tierMultipliers !== undefined ? { tierMultipliers: b.tierMultipliers } : {}),
            ...(b.timeOfDayFactor !== undefined ? { timeOfDayFactor: b.timeOfDayFactor } : {}),
            ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
            ...(b.effectiveFrom !== undefined ? { effectiveFrom: b.effectiveFrom } : {}),
            ...(b.effectiveTo !== undefined ? { effectiveTo: b.effectiveTo } : {}),
            version: existing.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(pricingRules.id, id))
          .returning()
        if (!row) return reply.status(404).send(error(404, '定价规则不存在'))
        return reply.send(success(row))
      } catch (e) {
        if (isUniqueViolation(e)) {
          return reply.status(409).send(error(409, `规则键已存在: ${b.ruleKey ?? ''}`))
        }
        return reply.status(500).send(error(500, '定价规则更新失败'))
      }
    })

    // DELETE /admin/pricing-rules/:id - 软下线(enabled=false, version+1)
    // 物理删除会切断结算明细 ruleId 的回查链,故只下线不删行。
    admin.delete('/admin/pricing-rules/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      const [existing] = await db.select().from(pricingRules).where(eq(pricingRules.id, id))
      if (!existing) return reply.status(404).send(error(404, '定价规则不存在'))
      const [row] = await db
        .update(pricingRules)
        .set({ enabled: false, version: existing.version + 1, updatedAt: new Date() })
        .where(eq(pricingRules.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '定价规则不存在'))
      return reply.send(success({ id, disabled: true, version: row.version }))
    })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
