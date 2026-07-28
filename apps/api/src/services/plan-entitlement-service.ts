/**
 * Plan-Driven 权益服务(P0-2b,2026-07-28)
 *
 * 职责:用户订阅 VIP 等级时,读取 vipLevels 表的配额字段,
 * 自动 upsert aiBudgets 记录(scope='user'),实现"订阅即配额生效"。
 *
 * 配额字段(来自 P0-2a vipLevels 表):
 * - aiBudgetDefaults: {dailyTokenLimit, monthlyTokenLimit, dailyCostLimit, monthlyCostLimit}
 * - apiQps: API 每秒查询限制(运行时由 API 中间件读取 users.isVip → vipLevels.apiQps)
 * - maxConcurrency: 最大并发(同上)
 * - modelWhitelist: 模型白名单(同上)
 *
 * 注:apiQps/maxConcurrency/modelWhitelist 是运行时实时读取的(不复制到用户表),
 * 避免数据冗余和同步问题。只有 aiBudgets 需要 upsert(因为 ai-cost 插件按 scope 查询)。
 */

import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { vipLevels, aiBudgets } from '@ihui/database'

/** aiBudgetDefaults jsonb 结构(与 vipLevels.aiBudgetDefaults 对齐) */
interface AiBudgetDefaults {
  dailyTokenLimit: number
  monthlyTokenLimit: number
  dailyCostLimit: string
  monthlyCostLimit: string
}

/** 应用结果(用于日志/调试) */
export interface EntitlementResult {
  userId: string
  vipLevelId: string
  levelValue: number
  budgetUpserted: boolean
  apiQps: number
  maxConcurrency: number
  modelWhitelist: string[] | null
}

/**
 * 读取 VIP 等级的配额配置。
 * @returns 配额对象;vipLevelId 不存在时返回 null
 */
export async function getVipLevelEntitlements(vipLevelId: string): Promise<{
  levelValue: number
  aiBudgetDefaults: AiBudgetDefaults
  apiQps: number
  maxConcurrency: number
  modelWhitelist: string[] | null
} | null> {
  const [level] = await db
    .select({
      levelValue: vipLevels.levelValue,
      aiBudgetDefaults: vipLevels.aiBudgetDefaults,
      apiQps: vipLevels.apiQps,
      maxConcurrency: vipLevels.maxConcurrency,
      modelWhitelist: vipLevels.modelWhitelist,
    })
    .from(vipLevels)
    .where(eq(vipLevels.id, vipLevelId))
    .limit(1)

  if (!level) return null

  const defaults = level.aiBudgetDefaults as AiBudgetDefaults
  return {
    levelValue: level.levelValue,
    aiBudgetDefaults: {
      dailyTokenLimit: defaults.dailyTokenLimit ?? 100_000,
      monthlyTokenLimit: defaults.monthlyTokenLimit ?? 1_000_000,
      dailyCostLimit: defaults.dailyCostLimit ?? '10',
      monthlyCostLimit: defaults.monthlyCostLimit ?? '100',
    },
    apiQps: level.apiQps,
    maxConcurrency: level.maxConcurrency,
    modelWhitelist: level.modelWhitelist as string[] | null,
  }
}

/**
 * Upsert 用户级 AI 预算(scope='user', scopeKey=userId)。
 * - 已存在:更新配额为 VIP 等级默认值
 * - 不存在:插入新记录
 */
async function upsertUserAiBudget(
  userId: string,
  defaults: AiBudgetDefaults,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: aiBudgets.id })
    .from(aiBudgets)
    .where(and(eq(aiBudgets.scope, 'user'), eq(aiBudgets.scopeKey, userId)))
    .limit(1)

  if (existing) {
    await db
      .update(aiBudgets)
      .set({
        dailyTokenLimit: defaults.dailyTokenLimit,
        monthlyTokenLimit: defaults.monthlyTokenLimit,
        dailyCostLimit: defaults.dailyCostLimit,
        monthlyCostLimit: defaults.monthlyCostLimit,
        updatedAt: new Date(),
      })
      .where(eq(aiBudgets.id, existing.id))
    return true
  }

  await db.insert(aiBudgets).values({
    scope: 'user',
    scopeKey: userId,
    dailyTokenLimit: defaults.dailyTokenLimit,
    monthlyTokenLimit: defaults.monthlyTokenLimit,
    dailyCostLimit: defaults.dailyCostLimit,
    monthlyCostLimit: defaults.monthlyCostLimit,
  })
  return true
}

/**
 * 应用 VIP 等级权益到用户(订阅激活时调用)。
 *
 * 流程:
 * 1. 读取 VIP 等级配额配置
 * 2. Upsert 用户级 aiBudgets
 * 3. 返回配额摘要(apiQps/maxConcurrency/modelWhitelist 运行时实时读取,不需持久化)
 *
 * @returns 应用结果;vipLevelId 不存在时返回 null
 */
export async function applyPlanEntitlements(
  userId: string,
  vipLevelId: string,
): Promise<EntitlementResult | null> {
  const entitlements = await getVipLevelEntitlements(vipLevelId)
  if (!entitlements) return null

  await upsertUserAiBudget(userId, entitlements.aiBudgetDefaults)

  return {
    userId,
    vipLevelId,
    levelValue: entitlements.levelValue,
    budgetUpserted: true,
    apiQps: entitlements.apiQps,
    maxConcurrency: entitlements.maxConcurrency,
    modelWhitelist: entitlements.modelWhitelist,
  }
}

/**
 * 查询用户当前生效的配额(运行时 API 中间件调用)。
 * 通过 users.isVip → vipLevels.levelValue 查找对应档位的配额。
 *
 * @param levelValue users.isVip 字段值(0=免费 1=个人 2=团队 3=企业)
 * @returns 配额对象;未找到匹配档位时返回免费档默认值
 */
export async function getEntitlementsByLevelValue(levelValue: number): Promise<{
  apiQps: number
  maxConcurrency: number
  modelWhitelist: string[] | null
  aiBudgetDefaults: AiBudgetDefaults
}> {
  const [level] = await db
    .select({
      apiQps: vipLevels.apiQps,
      maxConcurrency: vipLevels.maxConcurrency,
      modelWhitelist: vipLevels.modelWhitelist,
      aiBudgetDefaults: vipLevels.aiBudgetDefaults,
    })
    .from(vipLevels)
    .where(and(eq(vipLevels.levelValue, levelValue), eq(vipLevels.status, 1)))
    .limit(1)

  if (!level) {
    // 免费档默认值(无 VIP 等级匹配时)
    return {
      apiQps: 10,
      maxConcurrency: 3,
      modelWhitelist: null,
      aiBudgetDefaults: {
        dailyTokenLimit: 100_000,
        monthlyTokenLimit: 1_000_000,
        dailyCostLimit: '10',
        monthlyCostLimit: '100',
      },
    }
  }

  const defaults = level.aiBudgetDefaults as AiBudgetDefaults
  return {
    apiQps: level.apiQps,
    maxConcurrency: level.maxConcurrency,
    modelWhitelist: level.modelWhitelist as string[] | null,
    aiBudgetDefaults: {
      dailyTokenLimit: defaults.dailyTokenLimit ?? 100_000,
      monthlyTokenLimit: defaults.monthlyTokenLimit ?? 1_000_000,
      dailyCostLimit: defaults.dailyCostLimit ?? '10',
      monthlyCostLimit: defaults.monthlyCostLimit ?? '100',
    },
  }
}
