// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { orgPolicies } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import {
  clearOrgPolicyCache,
  getOrgIdForUser,
  isOrgAdmin,
  isOrgPolicyKey,
  type OrgPolicyKey,
} from '../services/org-policy-service.js'

/**
 * G6 企业治理面 - 组织统账聚合 + 策略读写路由(2026-10-30 立)。
 *
 * 守卫:组织管理员(organization_members.role ∈ {owner, admin},复用 organization.ts 的
 * 存量成员关系表),未登录 401、无组织/非管理员 403。管理端 UI 后续票直接消费本契约。
 *
 * 端点(注册时挂 prefix '/api'):
 * - GET /api/org/billing/summary?from=&to=  组织维度聚合成员用量:按成员/按模型/按日
 *   (数据源 ai_cost_records;agent_billings 为 Coze 平台级账单、无组织归属列,
 *   故单列一节按模型汇总作参考,不参与成员归属);
 * - GET /api/org/policies                   本组织全部策略(含停用行,管理页数据源);
 * - PUT /api/org/policies/:key              管理员 upsert 策略(存在则 version+1,不存在则
 *   version=1 新建;写后清策略缓存,最迟下一次解析即生效)。
 *
 * 待挂两行(主线程代挂 routes/index.ts,本文件不改 index):
 *   import { orgBillingRoutes } from './org-billing.js'
 *   server.register(orgBillingRoutes, { prefix: '/api' })
 */

// =============================================================================
// Zod 校验 schema(policyValue 逐键契约,形态对齐 org-policy-service.ts 类型)
// =============================================================================

const policyValueSchemas: Record<OrgPolicyKey, z.ZodTypeAny> = {
  model_allowlist: z.object({
    modelIds: z.array(z.string().min(1).max(128)),
    mode: z.enum(['allow', 'block']),
  }),
  feature_flags: z.record(z.string().max(64), z.boolean()),
  spend_budget_daily: z.object({ credits: z.number().nonnegative() }),
  data_retention_days: z.object({ days: z.number().int().positive() }),
}

const putPolicySchema = z.object({
  policyValue: z.unknown(),
  enabled: z.boolean().optional(),
})

const summaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

/**
 * 组织管理员守卫:authenticate → 归属组织 → role ∈ {owner, admin}。
 * 通过返回 {userId, orgId};未通过时响应已发出(401/403),调用方直接 return null。
 */
async function requireOrgAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string; orgId: string } | null> {
  let userId: string
  try {
    await authenticate(request)
    userId = request.userId!
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    return null
  }
  const orgId = await getOrgIdForUser(userId)
  if (!orgId) {
    reply.status(403).send(error(403, '当前用户无组织归属'))
    return null
  }
  if (!(await isOrgAdmin(orgId, userId))) {
    reply.status(403).send(error(403, '需要组织管理员权限'))
    return null
  }
  return { userId, orgId }
}

// =============================================================================
// 路由
// =============================================================================

export const orgBillingRoutes: FastifyPluginAsync = async (server) => {
  // ---------------------------------------------------------------------------
  // GET /api/org/billing/summary?from=&to= - 组织统账聚合(组织管理员)
  // ---------------------------------------------------------------------------
  server.get('/org/billing/summary', async (request, reply) => {
    const ctx = await requireOrgAdmin(request, reply)
    if (!ctx) return

    const parsed = summaryQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const to = parsed.data.to ?? new Date()
    const from = parsed.data.from ?? new Date(to.getTime() - 30 * 24 * 3600 * 1000)
    const { orgId } = ctx

    try {
      // 按成员聚合(ai_cost_records × organization_members 生效成员)
      const byMember = (await db.execute(
        sql`SELECT c."user_id"::text AS "userId",
                   COALESCE(SUM(c."cost"), 0)::text AS "cost",
                   COALESCE(SUM(c."total_tokens"), 0)::int AS "tokens",
                   COUNT(*)::int AS "calls"
            FROM ai_cost_records c
            JOIN organization_members m ON m."user_id"::text = c."user_id"::text
            WHERE m."org_id"::text = ${orgId} AND m."status" = 1
              AND c."created_at" >= ${from} AND c."created_at" <= ${to}
            GROUP BY c."user_id"
            ORDER BY SUM(c."cost") DESC`,
      )) as Record<string, unknown>[]

      // 按模型聚合
      const byModel = (await db.execute(
        sql`SELECT c."model" AS "model",
                   COALESCE(SUM(c."cost"), 0)::text AS "cost",
                   COALESCE(SUM(c."total_tokens"), 0)::int AS "tokens",
                   COUNT(*)::int AS "calls"
            FROM ai_cost_records c
            JOIN organization_members m ON m."user_id"::text = c."user_id"::text
            WHERE m."org_id"::text = ${orgId} AND m."status" = 1
              AND c."created_at" >= ${from} AND c."created_at" <= ${to}
            GROUP BY c."model"
            ORDER BY SUM(c."cost") DESC`,
      )) as Record<string, unknown>[]

      // 按日聚合
      const byDay = (await db.execute(
        sql`SELECT to_char(c."created_at", 'YYYY-MM-DD') AS "date",
                   COALESCE(SUM(c."cost"), 0)::text AS "cost",
                   COALESCE(SUM(c."total_tokens"), 0)::int AS "tokens",
                   COUNT(*)::int AS "calls"
            FROM ai_cost_records c
            JOIN organization_members m ON m."user_id"::text = c."user_id"::text
            WHERE m."org_id"::text = ${orgId} AND m."status" = 1
              AND c."created_at" >= ${from} AND c."created_at" <= ${to}
            GROUP BY to_char(c."created_at", 'YYYY-MM-DD')
            ORDER BY 1 ASC`,
      )) as Record<string, unknown>[]

      // agent_billings(Coze 智能体账单)无组织/成员归属列,按模型单列平台级参考汇总
      const agentByModel = (await db.execute(
        sql`SELECT a."model_id" AS "modelId",
                   COALESCE(SUM(a."change_balance"), 0)::text AS "balance",
                   COALESCE(SUM(a."model_input_token" + a."model_output_token"), 0)::int AS "tokens",
                   COUNT(*)::int AS "calls"
            FROM agent_billings a
            WHERE a."created_at" >= ${from} AND a."created_at" <= ${to}
            GROUP BY a."model_id"
            ORDER BY SUM(a."change_balance") DESC`,
      )) as Record<string, unknown>[]

      return reply.send(
        success({
          orgId,
          period: { from: from.toISOString(), to: to.toISOString() },
          byMember,
          byModel,
          byDay,
          agentBillings: {
            note: 'agent_billings 为 Coze 平台级账单,无组织归属列,按模型汇总仅作参考',
            byModel: agentByModel,
          },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '组织统账聚合失败'))
    }
  })

  // ---------------------------------------------------------------------------
  // GET /api/org/policies - 本组织策略列表(组织管理员;含停用行,管理页数据源)
  // ---------------------------------------------------------------------------
  server.get('/org/policies', async (request, reply) => {
    const ctx = await requireOrgAdmin(request, reply)
    if (!ctx) return
    const rows = await db.select().from(orgPolicies).where(eq(orgPolicies.orgId, ctx.orgId))
    return reply.send(success(rows))
  })

  // ---------------------------------------------------------------------------
  // PUT /api/org/policies/:key - 管理员 upsert 策略(version+1 / 新建 version=1)
  // ---------------------------------------------------------------------------
  server.put('/org/policies/:key', async (request, reply) => {
    const ctx = await requireOrgAdmin(request, reply)
    if (!ctx) return

    const { key } = request.params as { key: string }
    if (!isOrgPolicyKey(key)) {
      return reply.status(400).send(error(400, `未知策略键: ${key}`))
    }
    const parsed = putPolicySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const valueParsed = policyValueSchemas[key].safeParse(parsed.data.policyValue)
    if (!valueParsed.success) {
      return reply
        .status(400)
        .send(error(400, `策略值不符合 ${key} 契约: ${valueParsed.error.issues[0]?.message ?? ''}`))
    }

    const [existing] = await db
      .select()
      .from(orgPolicies)
      .where(and(eq(orgPolicies.orgId, ctx.orgId), eq(orgPolicies.policyKey, key)))
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(orgPolicies)
        .set({
          policyValue: valueParsed.data,
          ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(orgPolicies.id, existing.id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '策略不存在'))
      clearOrgPolicyCache()
      return reply.send(success(row))
    }

    const [row] = await db
      .insert(orgPolicies)
      .values({
        orgId: ctx.orgId,
        policyKey: key,
        policyValue: valueParsed.data,
        enabled: parsed.data.enabled ?? true,
        version: 1,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '策略创建失败'))
    clearOrgPolicyCache()
    return reply.send(success(row))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
