// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, lte, sql } from 'drizzle-orm'
import { orgPolicies, type OrgPolicy } from '@ihui/database'
import { db } from '../db/index.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

/**
 * G6 企业治理面 - 组织策略解析服务(2026-10-30 立)。
 *
 * 职责:把 org_policies 表(orgId × policyKey 一行)解析成准入链检查点可用的判定结果。
 * - getOrgIdForUser:用户 → 组织归属,复用 organization.ts 路由的存量成员关系表
 *   (organization_members,org_id/user_id 一律 ::text 比较,取最早加入的生效成员行);
 * - resolvePolicy:(orgId, key) 点查,带短 TTL 内存缓存(形态对齐 ai-cost.ts 的 promptCache:
 *   Map + expiredAt + 容量上限,miss 也缓存以挡住高频穿透);
 * - checkModelAllowed / checkFeatureEnabled / checkOrgSpendBudget:准入链检查点的判定核;
 * - guardModelAdmission:可复用 guard,聊天/模型执行入口在请求进入执行前调用。
 *
 * 默认开放纪律(不破坏存量行为):
 * - ORG_POLICIES_ENABLED 关 ⇒ 所有检查点直通,逐字节旧行为;
 * - 无组织 / 无策略 / 策略停用 / 未到生效点 / 值形态非法 / 查询异常 ⇒ 一律放行(fail-open,
 *   治理面故障绝不抬高存量调用链的拒绝率)。
 */

// =============================================================================
// policyKey 封闭集与服务内契约类型(首批四键)
// =============================================================================

/** 首批策略键枚举(表里 policy_key 是 varchar,合法键以本清单为准) */
export const ORG_POLICY_KEYS = [
  'model_allowlist',
  'feature_flags',
  'spend_budget_daily',
  'data_retention_days',
] as const
export type OrgPolicyKey = (typeof ORG_POLICY_KEYS)[number]

export function isOrgPolicyKey(v: string): v is OrgPolicyKey {
  return (ORG_POLICY_KEYS as readonly string[]).includes(v)
}

/** model_allowlist:mode='allow' 白名单(仅列内可用);mode='block' 黑名单(列内禁用) */
export interface ModelAllowlistPolicy {
  modelIds: string[]
  mode: 'allow' | 'block'
}

/** feature_flags:特性键 → 布尔(如 delegation / automations);缺键默认开 */
export type FeatureFlagsPolicy = Record<string, boolean>

/** spend_budget_daily:组织每日积分(credits)花费上限 */
export interface SpendBudgetDailyPolicy {
  credits: number
}

/** data_retention_days:组织数据保留天数 */
export interface DataRetentionDaysPolicy {
  days: number
}

// =============================================================================
// 短 TTL 内存缓存(形态对齐 ai-cost.ts promptCache)
// =============================================================================

interface PolicyCacheEntry {
  value: unknown
  expiredAt: number
}

const POLICY_CACHE_TTL_MS = 30 * 1000 // 30 秒:策略改动最迟 30s 后全量生效
const POLICY_CACHE_MAX = 1000

/** 成员归属缓存:key = `member:${userId}`;策略缓存:key = `policy:${orgId}|${policyKey}` */
const policyCache = new Map<string, PolicyCacheEntry>()

function cacheGet(key: string): { hit: boolean; value: unknown } {
  const entry = policyCache.get(key)
  if (!entry) return { hit: false, value: null }
  if (Date.now() > entry.expiredAt) {
    policyCache.delete(key)
    return { hit: false, value: null }
  }
  // 命中:删除后重新插入到末尾(MRU 端),与 promptCache 同型
  policyCache.delete(key)
  policyCache.set(key, entry)
  return { hit: true, value: entry.value }
}

function cacheSet(key: string, value: unknown): void {
  if (policyCache.size >= POLICY_CACHE_MAX) {
    const firstKey = policyCache.keys().next().value
    if (firstKey) policyCache.delete(firstKey)
  }
  policyCache.set(key, { value, expiredAt: Date.now() + POLICY_CACHE_TTL_MS })
}

/** 清空策略缓存(测试与管理端改策略后的即时失效口) */
export function clearOrgPolicyCache(): void {
  policyCache.clear()
}

// =============================================================================
// 组织归属与管理员判定(复用 organization.ts 的存量表)
// =============================================================================

/**
 * 用户 → 组织归属:organization_members 生效成员行(status=1),多组织时取最早加入的一条
 * (与 ai-cost resolveTenantIdForUser 的"取最早加入"取向一致)。
 * 无成员行/查询异常 ⇒ null(视为无组织,所有检查点直通)。
 */
export async function getOrgIdForUser(userId: string): Promise<string | null> {
  const cacheKey = `member:${userId}`
  const cached = cacheGet(cacheKey)
  if (cached.hit) return cached.value as string | null
  let orgId: string | null = null
  try {
    const rows = (await db.execute(
      sql`SELECT "org_id"::text AS org_id FROM organization_members
          WHERE "user_id"::text = ${userId} AND "status" = 1
          ORDER BY "joined_at" ASC LIMIT 1`,
    )) as Array<{ org_id?: string }>
    orgId = rows[0]?.org_id ?? null
  } catch (err) {
    // 归属查询失败按"无组织"处理:治理面绝不因自身故障拦截存量调用
    logger.warn(
      `[org-policy] getOrgIdForUser 失败,按无组织放行: userId=${userId} err=${String(err)}`,
    )
    orgId = null
  }
  cacheSet(cacheKey, orgId)
  return orgId
}

/** 组织管理员判定:organization_members.role ∈ {owner, admin} 且成员行生效 */
export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  try {
    const rows = (await db.execute(
      sql`SELECT "role" FROM organization_members
          WHERE "org_id"::text = ${orgId} AND "user_id"::text = ${userId} AND "status" = 1
          LIMIT 1`,
    )) as Array<{ role?: string }>
    const role = rows[0]?.role
    return role === 'owner' || role === 'admin'
  } catch (err) {
    logger.warn(
      `[org-policy] isOrgAdmin 查询失败,按非管理员处理: org=${orgId} user=${userId} err=${String(err)}`,
    )
    return false
  }
}

// =============================================================================
// 策略解析
// =============================================================================

/**
 * 解析 (orgId, key) 现行策略:enabled=true 且已到生效点;miss/停用/未到点 ⇒ null。
 * null 也进缓存(挡住无策略组织的高频穿透)。查询异常按 null 放行。
 */
export async function resolvePolicy<T extends object>(
  orgId: string,
  key: OrgPolicyKey,
): Promise<T | null> {
  const cacheKey = `policy:${orgId}|${key}`
  const cached = cacheGet(cacheKey)
  if (cached.hit) return cached.value as T | null
  let value: T | null = null
  try {
    const [row] = await db
      .select()
      .from(orgPolicies)
      .where(
        and(
          eq(orgPolicies.orgId, orgId),
          eq(orgPolicies.policyKey, key),
          eq(orgPolicies.enabled, true),
          lte(orgPolicies.effectiveFrom, new Date()),
        ),
      )
      .limit(1)
    value = row ? ((row as OrgPolicy).policyValue as T) : null
  } catch (err) {
    logger.warn(
      `[org-policy] resolvePolicy 查询失败,按无策略放行: org=${orgId} key=${key} err=${String(err)}`,
    )
    value = null
  }
  cacheSet(cacheKey, value)
  return value
}

/** 便捷核:值形态合法性逐键判定(非法 ⇒ 视为无策略放行,绝不因脏数据拦截) */
function isModelAllowlist(p: unknown): p is ModelAllowlistPolicy {
  if (!p || typeof p !== 'object') return false
  const v = p as Record<string, unknown>
  return (v.mode === 'allow' || v.mode === 'block') && Array.isArray(v.modelIds)
}

function isSpendBudgetDaily(p: unknown): p is SpendBudgetDailyPolicy {
  return (
    !!p &&
    typeof p === 'object' &&
    typeof (p as Record<string, unknown>).credits === 'number' &&
    Number.isFinite((p as Record<string, unknown>).credits as number)
  )
}

// =============================================================================
// 准入链检查点判定核
// =============================================================================

/**
 * 模型准入判定:开关关 / 无 userId / 无组织 / 无策略 / 形态非法 ⇒ allowed=true(直通)。
 * allow 模式:仅 modelIds 内可用;block 模式:modelIds 内禁用,其余可用。
 */
export async function checkModelAllowed(
  userId: string | undefined,
  modelId: string | undefined,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!config.ORG_POLICIES_ENABLED) return { allowed: true }
  if (!userId || !modelId) return { allowed: true }
  const orgId = await getOrgIdForUser(userId)
  if (!orgId) return { allowed: true }
  const policy = await resolvePolicy<ModelAllowlistPolicy>(orgId, 'model_allowlist')
  if (!isModelAllowlist(policy)) return { allowed: true }
  const listed = policy.modelIds.some((m) => String(m) === modelId)
  if (policy.mode === 'allow' && !listed) {
    return { allowed: false, reason: `模型 ${modelId} 不在组织白名单内` }
  }
  if (policy.mode === 'block' && listed) {
    return { allowed: false, reason: `模型 ${modelId} 已被组织策略禁用` }
  }
  return { allowed: true }
}

/**
 * 可复用模型准入 guard:返回 null = 放行;返回拒绝描述 = 调用方按此发 403。
 * 响应形态对齐 BUDGET_EXHAUSTED 的既有约定(顶层 errorCode 供前端精准提示)。
 */
export async function guardModelAdmission(
  userId: string | undefined,
  modelId: string | undefined,
): Promise<{
  statusCode: 403
  errorCode: 'ORG_MODEL_BLOCKED'
  message: string
  model: string
} | null> {
  const verdict = await checkModelAllowed(userId, modelId)
  if (verdict.allowed) return null
  return {
    statusCode: 403,
    errorCode: 'ORG_MODEL_BLOCKED',
    message: verdict.reason ?? '该模型已被组织策略禁用',
    model: modelId ?? '',
  }
}

/**
 * 特性开关判定:开关关 / 无组织 / 无策略 / 非对象形态 ⇒ true(默认开放)。
 * 策略存在且含该 feature 键(布尔)时按其值;缺键默认 true。
 */
export async function checkFeatureEnabled(
  userId: string | undefined,
  feature: string,
): Promise<boolean> {
  if (!config.ORG_POLICIES_ENABLED) return true
  if (!userId) return true
  const orgId = await getOrgIdForUser(userId)
  if (!orgId) return true
  const policy = await resolvePolicy<FeatureFlagsPolicy>(orgId, 'feature_flags')
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return true
  const v = (policy as Record<string, unknown>)[feature]
  return typeof v === 'boolean' ? v : true
}

/**
 * 组织日花费预算判定(spend_budget_daily,{credits:number}):
 * 统计本组织全部生效成员今日 ai_cost_records.cost 之和,与上限比较。
 * 开关关 / 无组织 / 无策略 / 形态非法 ⇒ allowed=true(直通);查询异常同样放行。
 * min(个人,组织)语义由调用方(ai-cost checkBudget)叠加实现:两维各自独立判定,
 * 任一触顶即拒,等效取更严的一档。
 */
export async function checkOrgSpendBudget(
  userId: string,
): Promise<{ allowed: boolean; usedCredits?: number; limitCredits?: number; reason?: string }> {
  if (!config.ORG_POLICIES_ENABLED) return { allowed: true }
  const orgId = await getOrgIdForUser(userId)
  if (!orgId) return { allowed: true }
  const policy = await resolvePolicy<SpendBudgetDailyPolicy>(orgId, 'spend_budget_daily')
  if (!isSpendBudgetDaily(policy)) return { allowed: true }
  try {
    // 今日 0 点起算(与 ai-cost checkBudget 同口径)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const rows = (await db.execute(
      sql`SELECT COALESCE(SUM(c."cost"), 0)::text AS used
          FROM ai_cost_records c
          JOIN organization_members m ON m."user_id"::text = c."user_id"::text
          WHERE m."org_id"::text = ${orgId} AND m."status" = 1 AND c."created_at" >= ${todayStart}`,
    )) as Array<{ used?: string }>
    const usedCredits = Number(rows[0]?.used ?? 0)
    if (!Number.isFinite(usedCredits)) return { allowed: true }
    if (usedCredits >= policy.credits) {
      return {
        allowed: false,
        usedCredits,
        limitCredits: policy.credits,
        reason: '组织日预算已用尽',
      }
    }
    return { allowed: true, usedCredits, limitCredits: policy.credits }
  } catch (err) {
    logger.warn(
      `[org-policy] checkOrgSpendBudget 聚合失败,按放行处理: org=${orgId} err=${String(err)}`,
    )
    return { allowed: true }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
