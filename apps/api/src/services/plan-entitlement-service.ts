/**
 * Plan-Driven 权益服务(AGENTS.md §24 P0-2a / P0-2b)
 *
 * 职责:VIP 订阅激活时,根据 vipLevels.benefits 配额配置,自动 upsert aiBudgets。
 *
 * benefits jsonb 标准结构(VipPlanQuota):
 * {
 *   "dailyTokenLimit": 500000,
 *   "monthlyTokenLimit": 10000000,
 *   "dailyCostLimit": 50.00,
 *   "monthlyCostLimit": 500.00,
 *   "apiQps": 20,
 *   "concurrency": 10,
 *   "modelWhitelist": []
 * }
 *
 * 4 档 VIP(0=免费/1=个人/2=团队/3=企业),旧数据回退到 DEFAULT_PLAN_QUOTAS。
 *
 * 集成点:activateOrderSubscription(orderType=2 VIP)调用 applyPlanEntitlements。
 * apiQps / concurrency / modelWhitelist 不入 aiBudgets(只管 token/cost),
 * 供 API 限流中间件从 DEFAULT_PLAN_QUOTAS[levelValue] 读取(后续 P0-2c)。
 */

import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiBudgets, vipLevels } from '@ihui/database'

type VipLevel = typeof vipLevels.$inferSelect

// VipPlanQuota Zod schema(解析 benefits jsonb)
export const VipPlanQuotaSchema = z.object({
  dailyTokenLimit: z.number().int().positive().default(10_000),
  monthlyTokenLimit: z.number().int().positive().default(100_000),
  dailyCostLimit: z.number().positive().default(1.0),
  monthlyCostLimit: z.number().positive().default(10.0),
  apiQps: z.number().int().positive().default(5),
  concurrency: z.number().int().positive().default(2),
  modelWhitelist: z.array(z.string()).default([]),
})

export type VipPlanQuota = z.infer<typeof VipPlanQuotaSchema>

// 4 档 VIP 默认配额(0=免费/1=个人/2=团队/3=企业)
export const DEFAULT_PLAN_QUOTAS: Record<number, VipPlanQuota> = {
  0: {
    dailyTokenLimit: 10_000,
    monthlyTokenLimit: 100_000,
    dailyCostLimit: 1.0,
    monthlyCostLimit: 10.0,
    apiQps: 5,
    concurrency: 2,
    modelWhitelist: [],
  },
  1: {
    dailyTokenLimit: 500_000,
    monthlyTokenLimit: 10_000_000,
    dailyCostLimit: 50.0,
    monthlyCostLimit: 500.0,
    apiQps: 20,
    concurrency: 10,
    modelWhitelist: [],
  },
  2: {
    dailyTokenLimit: 2_000_000,
    monthlyTokenLimit: 50_000_000,
    dailyCostLimit: 200.0,
    monthlyCostLimit: 2000.0,
    apiQps: 60,
    concurrency: 50,
    modelWhitelist: [],
  },
  3: {
    dailyTokenLimit: 10_000_000,
    monthlyTokenLimit: 200_000_000,
    dailyCostLimit: 1000.0,
    monthlyCostLimit: 10_000.0,
    apiQps: 200,
    concurrency: 200,
    modelWhitelist: [],
  },
}

/**
 * 从 vipLevels.benefits 解析配额。
 * - benefits 是对象:用 Zod 解析,失败回退到默认
 * - benefits 是数组(旧格式)或 null:回退到 DEFAULT_PLAN_QUOTAS[levelValue]
 */
export function resolvePlanQuota(level: VipLevel): VipPlanQuota {
  const fallback = DEFAULT_PLAN_QUOTAS[level.levelValue] ?? DEFAULT_PLAN_QUOTAS[0] ?? DEFAULT_PLAN_QUOTAS[0]!
  const benefits = level.benefits as unknown
  if (Array.isArray(benefits)) return fallback
  if (typeof benefits === 'object' && benefits !== null) {
    const parsed = VipPlanQuotaSchema.safeParse(benefits)
    if (parsed.success) return parsed.data
  }
  return fallback
}

/**
 * 应用 plan 权益:upsert aiBudgets(scope='user', scopeKey=userId, model=NULL)。
 * 在 activateOrderSubscription(orderType=2 VIP)后调用,失败不阻塞支付完成。
 */
export async function applyPlanEntitlements(
  userId: string,
  vipLevel: VipLevel,
): Promise<void> {
  const quota = resolvePlanQuota(vipLevel)

  // 查询用户级总预算(model IS NULL)
  const [existing] = await db
    .select({ id: aiBudgets.id })
    .from(aiBudgets)
    .where(
      and(
        eq(aiBudgets.scope, 'user'),
        eq(aiBudgets.scopeKey, userId),
        isNull(aiBudgets.model),
      ),
    )
    .limit(1)

  const now = new Date()
  const costFields = {
    dailyTokenLimit: quota.dailyTokenLimit,
    monthlyTokenLimit: quota.monthlyTokenLimit,
    dailyCostLimit: quota.dailyCostLimit.toFixed(4),
    monthlyCostLimit: quota.monthlyCostLimit.toFixed(4),
    updatedAt: now,
  }

  if (existing) {
    await db.update(aiBudgets).set(costFields).where(eq(aiBudgets.id, existing.id))
  } else {
    await db.insert(aiBudgets).values({
      scope: 'user',
      scopeKey: userId,
      model: null,
      ...costFields,
      createdAt: now,
    })
  }
}

/**
 * 查询用户当前 plan 配额(供 API 限流中间件用)。
 * 优先读 aiBudgets(已配置),否则按 levelValue 回退到 DEFAULT_PLAN_QUOTAS。
 */
export async function getUserPlanQuota(
  userId: string,
  levelValue: number,
): Promise<VipPlanQuota> {
  const [budget] = await db
    .select({
      dailyTokenLimit: aiBudgets.dailyTokenLimit,
      monthlyTokenLimit: aiBudgets.monthlyTokenLimit,
      dailyCostLimit: aiBudgets.dailyCostLimit,
      monthlyCostLimit: aiBudgets.monthlyCostLimit,
    })
    .from(aiBudgets)
    .where(
      and(
        eq(aiBudgets.scope, 'user'),
        eq(aiBudgets.scopeKey, userId),
        isNull(aiBudgets.model),
      ),
    )
    .limit(1)

  const fallback = DEFAULT_PLAN_QUOTAS[levelValue] ?? DEFAULT_PLAN_QUOTAS[0] ?? DEFAULT_PLAN_QUOTAS[0]!
  if (budget) {
    return {
      dailyTokenLimit: budget.dailyTokenLimit,
      monthlyTokenLimit: budget.monthlyTokenLimit,
      dailyCostLimit: Number(budget.dailyCostLimit),
      monthlyCostLimit: Number(budget.monthlyCostLimit),
      apiQps: fallback.apiQps,
      concurrency: fallback.concurrency,
      modelWhitelist: fallback.modelWhitelist,
    }
  }
  return fallback
}
