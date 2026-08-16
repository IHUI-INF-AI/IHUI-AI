/**
 * SaaS 租户配额真实数据源(2026-08-06 立)。
 *
 * 背景:前端 QuotaCard 通过 GET /api/admin-saas/customers/:slug/quota 取配额,
 * 此前该路径被 admin-saas-proxy 透传到 admin-api(返回硬编码占位数据)。
 * 本项目数据库已有真实租户模型:tenants(租户主表) + tenant_quotas(配额表,
 * api_calls_used/limit、storage_used_mb/limit_mb、period_start/period_end) +
 * ai_cost_records(AI token 用量,按 tenant_id 聚合)。
 *
 * 2026-08-06 修复「用量恒 0」:api_calls_used 与 storage_used_mb 字段此前无写入侧,
 * admin 页展示恒 0。现改为**展示层实时真实聚合**(字段保留不动,其他消费方不受影响):
 * - apiCallsUsed = api_logs 按租户成员(user_id ∈ tenant_members)计数
 * - storageUsedMb = files 按租户成员(uploaded_by ∈ tenant_members,未软删)SUM(size)
 * - aiTokens    = ai_cost_records 按 tenant_id 聚合(已有)
 * 聚合口径与「租户配额」语义一致(累计值),不再依赖可能为 0 的静态字段。
 *
 * 本路由注册在与代理同一 prefix(/api/admin-saas),但使用更具体的
 * /customers/:slug/quota 路径,Fastify 路由优先级(parametric > wildcard)
 * 保证优先命中本路由,不再落入代理。
 *
 * 返回结构与 @ihui/api-client CustomerQuota 类型对齐,placeholder=false。
 * 数据库无该租户记录时返回 404,前端显示"无法获取配额数据"空态,不造假数字。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { tenants, tenantQuotas, aiCostRecords, apiLogs, files, tenantMembers } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

const MB = 1024 * 1024

/**
 * 套餐默认配额档位(与 apps/api/src/routes/tenant.ts 创建租户时初始化 tenant_quotas 的
 * 默认值保持一致)。仅当 tenant_quotas 尚无记录时作为 limit 兜底,used 始终取真实记录。
 */
const PLAN_DEFAULTS = {
  free: { apiCallsLimit: 100_000, storageLimitMb: 10_240 },
  pro: { apiCallsLimit: 1_000_000, storageLimitMb: 51_200 },
  enterprise: { apiCallsLimit: 10_000_000, storageLimitMb: 102_400 },
} as const

type PlanKey = keyof typeof PLAN_DEFAULTS

function planKey(plan: string | null | undefined): PlanKey {
  if (plan === 'pro' || plan === 'enterprise') return plan
  return 'free'
}

const slugParamSchema = z.object({
  slug: z.string().min(1),
})

export const adminSaasQuotaRoutes: FastifyPluginAsync = async (server) => {
  // 与 admin-saas-proxy 一致的 admin 鉴权:JWT + roleId >= 1
  server.addHook('preHandler', requireAdmin)

  server.get('/customers/:slug/quota', async (request, reply) => {
    const parsed = slugParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { slug } = parsed.data
    try {
      const [tenant] = await dbRead.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
      if (!tenant) {
        // 部署层存在但数据库无租户记录:无真实配额可报,返回 404 让前端显示空态
        return reply.status(404).send(error(404, '未找到该租户的配额数据'))
      }

      const [quota] = await dbRead
        .select()
        .from(tenantQuotas)
        .where(eq(tenantQuotas.tenantId, tenant.id))
        .limit(1)

      // AI token 用量:按 tenant_id 聚合 ai_cost_records.total_tokens(真实表)
      const [tokenAgg] = await dbRead
        .select({
          used: sql<number>`coalesce(sum(${aiCostRecords.totalTokens}), 0)::bigint::int`,
        })
        .from(aiCostRecords)
        .where(eq(aiCostRecords.tenantId, tenant.id))

      // API 调用次数:租户成员(tenant_members.user_id)在 api_logs 的记录数(真实聚合,2026-08-06)
      const [apiAgg] = await dbRead
        .select({ used: sql<number>`count(*)::int` })
        .from(apiLogs)
        .innerJoin(tenantMembers, eq(apiLogs.userId, tenantMembers.userId))
        .where(eq(tenantMembers.tenantId, tenant.id))

      // 存储用量:租户成员未软删文件 size 之和,字节 → MB(真实聚合,2026-08-06)
      const [storageAgg] = await dbRead
        .select({ usedBytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint` })
        .from(files)
        .innerJoin(tenantMembers, eq(files.uploadedBy, tenantMembers.userId))
        .where(and(eq(tenantMembers.tenantId, tenant.id), isNull(files.deletedAt)))

      const plan = planKey(tenant.plan)
      const apiCallsLimit = quota?.apiCallsLimit ?? PLAN_DEFAULTS[plan].apiCallsLimit
      const storageLimitMb = quota?.storageLimitMb ?? PLAN_DEFAULTS[plan].storageLimitMb
      // 展示层真实聚合:不读可能恒 0 的静态字段(api_calls_used / storage_used_mb)
      const apiCallsUsed = apiAgg?.used ?? 0
      const storageUsedMb = Math.floor(((storageAgg?.usedBytes ?? 0) as number) / MB)
      // tenant_quotas.limits jsonb 可选携带 aiTokensLimit/tokenLimit,未配置则为 null(无上限)
      const limits = (quota?.limits ?? {}) as Record<string, unknown>
      const aiTokensLimitRaw = limits.aiTokensLimit ?? limits.tokenLimit
      const aiTokensLimit =
        typeof aiTokensLimitRaw === 'number' && aiTokensLimitRaw >= 0 ? aiTokensLimitRaw : null
      const resetAt = quota && quota.periodEnd ? quota.periodEnd.toISOString() : null

      return reply.send(
        success({
          slug: tenant.slug,
          apiCalls: { used: apiCallsUsed, limit: apiCallsLimit, window: 'month', resetAt },
          aiTokens: {
            used: tokenAgg?.used ?? 0,
            limit: aiTokensLimit,
            window: 'month',
            resetAt,
          },
          storage: { usedBytes: storageUsedMb * MB, limitBytes: storageLimitMb * MB },
          placeholder: false,
          expectedFrom: '',
          generatedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询租户配额失败'))
    }
  })
}
