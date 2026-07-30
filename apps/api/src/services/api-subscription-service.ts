/**
 * API 订阅 service(P0-6 中转站产品化,2026-07-31 立)。
 *
 * 职责:
 * 1. activateApiSubscription: 订单激活时把 plan 的 token 配额写入用户当前活跃 Key
 * 2. getUserSubscriptionStatus: 查询用户当前订阅状态 + 剩余 token + 历史
 * 3. listApiSubscriptionPlans: 列出 3 档 API 订阅方案(name 以 'API ' 前缀 + isActive=true)
 * 4. parseTokenQuotaFromFeatures: 从 plan.features 字符串数组解析 token 配额
 *
 * 幂等:用 orders 表查 paid 订单(orderType=6 + userId + planId)做去重,无需新增表。
 *
 * 配额写入策略:
 * - 用户有 active Key → UPDATE token_balance += quota(累加,允许多次订阅叠加)
 * - 用户无 Key → 自动创建默认 Key 并设 token_balance = quota
 *
 * 不修改 plans 表结构,不依赖 user_subscriptions 表(不存在)。
 */
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { plans, orders, developerApiKeys } from '@ihui/database'
import { generateApiKey, hashSecret } from '../utils/api-key-hash.js'

// =============================================================================
// 类型定义
// =============================================================================

/** 订阅方案信息(自包含,不泄漏内部 DB 行)。 */
export interface PlanInfo {
  id: string
  name: string
  description: string | null
  price: number
  interval: string
  features: string[]
  billingPeriod: string
}

/** 订阅历史记录。 */
export interface SubscriptionRecord {
  orderId: string
  orderNo: string
  planId: string
  planName: string
  amount: number
  paidAt: Date | null
  status: string
}

/** 用户订阅状态查询结果。 */
export interface UserSubscriptionStatus {
  activePlan: PlanInfo | null
  remainingTokens: number
  history: SubscriptionRecord[]
}

/** 激活结果。 */
export interface ActivateResult {
  success: boolean
  keyId?: string
  tokenQuota?: number
  reason?: string
}

// =============================================================================
// 4. parseTokenQuotaFromFeatures — 从 features 解析 token 配额
// =============================================================================

/**
 * 从 plan.features 字符串数组解析 token 配额。
 *
 * 支持格式:
 * - "500000 tokens/month" → 500000
 * - "1000000 tokens" → 1000000
 * - "2000000 tokens/month" → 2000000
 * - "unlimited tokens" → -1(无限)
 * - "10000000 tokens/month" → 10000000
 *
 * @param features plan.features(jsonb 数组,运行时为 unknown)
 * @returns token 配额数字;无 token 字段返回 0;unlimited 返回 -1
 */
export function parseTokenQuotaFromFeatures(features: unknown): number {
  if (!Array.isArray(features)) return 0
  for (const item of features) {
    if (typeof item !== 'string') continue
    // unlimited 优先匹配
    if (/unlimited\s+tokens?/i.test(item)) return -1
    // 提取数字 + tokens 关键字
    const match = item.match(/(\d+)\s+tokens?/i)
    if (match) {
      const n = Number.parseInt(match[1] ?? '', 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return 0
}

// =============================================================================
// 3. listApiSubscriptionPlans — 列出 API 订阅方案
// =============================================================================

/**
 * 列出所有 API 订阅方案(name 以 'API ' 前缀 + isActive=true,按 sortOrder 升序)。
 *
 * 实现说明:plans 表无 orderType 字段,以 name LIKE 'API %' 作为隐式筛选
 * (匹配 seed 中的 "API Starter" / "API Pro" / "API Enterprise")。
 */
export async function listApiSubscriptionPlans(): Promise<PlanInfo[]> {
  const rows = await dbRead
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      price: plans.price,
      interval: plans.interval,
      features: plans.features,
      billingPeriod: plans.billingPeriod,
      sortOrder: plans.sortOrder,
    })
    .from(plans)
    .where(and(eq(plans.isActive, true), sql`${plans.name} LIKE 'API %'`))
    .orderBy(plans.sortOrder)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    interval: r.interval,
    features: normalizeFeatures(r.features),
    billingPeriod: r.billingPeriod,
  }))
}

// =============================================================================
// 2. getUserSubscriptionStatus — 查询用户订阅状态
// =============================================================================

/**
 * 查询用户当前 API 订阅状态。
 *
 * - activePlan:用户最近一笔已支付 orderType=6 订单关联的 plan(无则 null)
 * - remainingTokens:用户所有 active Key 的 token_balance 之和(>0 才计入,-1 表示无限)
 * - history:用户所有 orderType=6 订单(按 paidAt/createdAt 降序)
 */
export async function getUserSubscriptionStatus(
  userId: string,
): Promise<UserSubscriptionStatus> {
  // 1. 查用户所有 orderType=6 订单(关联 plans 拿 planName)
  const orderRows = await dbRead
    .select({
      orderId: orders.id,
      orderNo: orders.orderNo,
      planId: orders.planId,
      planName: plans.name,
      amount: orders.amount,
      paidAt: orders.paidAt,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(plans, eq(orders.planId, plans.id))
    .where(and(eq(orders.userId, userId), eq(orders.orderType, 6)))
    .orderBy(desc(orders.paidAt), desc(orders.createdAt))

  const history: SubscriptionRecord[] = orderRows.map((r) => ({
    orderId: r.orderId,
    orderNo: r.orderNo,
    planId: r.planId ?? '',
    planName: r.planName ?? '(已下架方案)',
    amount: r.amount,
    paidAt: r.paidAt,
    status: r.status,
  }))

  // 2. activePlan:最近一笔 paid 订单关联的 plan
  const paidOrder = orderRows.find((r) => r.status === 'paid' && r.planId)
  let activePlan: PlanInfo | null = null
  if (paidOrder?.planId) {
    const [planRow] = await dbRead
      .select({
        id: plans.id,
        name: plans.name,
        description: plans.description,
        price: plans.price,
        interval: plans.interval,
        features: plans.features,
        billingPeriod: plans.billingPeriod,
      })
      .from(plans)
      .where(eq(plans.id, paidOrder.planId!))
      .limit(1)
    if (planRow) {
      activePlan = {
        id: planRow.id,
        name: planRow.name,
        description: planRow.description,
        price: planRow.price,
        interval: planRow.interval,
        features: normalizeFeatures(planRow.features),
        billingPeriod: planRow.billingPeriod,
      }
    }
  }

  // 3. remainingTokens:用户所有 active Key 的 token_balance 之和
  const keyRows = await dbRead
    .select({ tokenBalance: developerApiKeys.tokenBalance })
    .from(developerApiKeys)
    .where(and(eq(developerApiKeys.userId, userId), eq(developerApiKeys.status, 'active')))
  const hasInfinite = keyRows.some((k) => Number(k.tokenBalance) === -1)
  const remainingTokens = hasInfinite
    ? -1
    : keyRows.reduce((s, k) => s + Math.max(Number(k.tokenBalance), 0), 0)

  return { activePlan, remainingTokens, history }
}

// =============================================================================
// 1. activateApiSubscription — 激活订阅(写 token 配额到 Key)
// =============================================================================

/**
 * 激活 API 订阅:把 plan 的 token 配额写入用户当前活跃 Key 的 token_balance。
 *
 * 流程:
 * 1. 查 plan → 解析 features 拿 tokenQuota(0 视为无配额,仍返回 success)
 * 2. 幂等检查:orders 表是否已有 paid + orderType=6 + userId + planId 的订单
 *    (本函数被 activateOrderSubscription 调用前订单已落 paid,因此查到=已激活过)
 *    → 已激活则跳过(返回 success=false, reason='already_activated')
 * 3. 找用户当前活跃 Key(status=active,按 lastUsedAt desc + createdAt desc)
 * 4. 有 Key → UPDATE token_balance += quota
 *    无 Key → 自动创建默认 Key(token_balance = quota)
 *
 * @returns { success, keyId, tokenQuota, reason }
 */
export async function activateApiSubscription(
  userId: string,
  planId: string,
): Promise<ActivateResult> {
  // 1. 查 plan
  const [planRow] = await dbRead
    .select({
      id: plans.id,
      name: plans.name,
      features: plans.features,
    })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1)
  if (!planRow) return { success: false, reason: 'plan_not_found' }

  const tokenQuota = parseTokenQuotaFromFeatures(planRow.features)

  // 2. 幂等:查 paid + orderType=6 + userId + planId 订单
  //    (调用方 activateOrderSubscription 在订单 paid 后才调本函数;
  //     若同 plan 已有 paid 订单,视为重复激活,跳过)
  const [existingPaid] = await dbRead
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.planId, planId),
        eq(orders.orderType, 6),
        eq(orders.status, 'paid'),
      ),
    )
    .limit(1)
  // 注意:当前订单本身也是 paid 状态,会被查到;此处通过"是否已有 ≥2 条 paid 订单"判断重复
  // 简化:查 paid 订单总数,>1 视为重复(第 1 次激活时只有当前这 1 条)
  const [countRow] = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.planId, planId),
        eq(orders.orderType, 6),
        eq(orders.status, 'paid'),
      ),
    )
  const paidCount = Number(countRow?.c ?? 0)
  if (existingPaid && paidCount > 1) {
    return { success: false, reason: 'already_activated' }
  }

  // 3. 找用户当前活跃 Key
  const [activeKey] = await dbRead
    .select({
      id: developerApiKeys.id,
      tokenBalance: developerApiKeys.tokenBalance,
    })
    .from(developerApiKeys)
    .where(and(eq(developerApiKeys.userId, userId), eq(developerApiKeys.status, 'active')))
    .orderBy(desc(developerApiKeys.lastUsedAt), desc(developerApiKeys.createdAt))
    .limit(1)

  // 4. 写入配额
  if (activeKey) {
    // 累加:quota=-1(无限) → 设为 -1;quota>0 → token_balance += quota(若已 -1 保持 -1)
    if (tokenQuota === -1) {
      await db
        .update(developerApiKeys)
        .set({ tokenBalance: -1, updatedAt: new Date() })
        .where(eq(developerApiKeys.id, activeKey.id))
    } else if (tokenQuota > 0) {
      // 已是无限额度则保持,否则累加
      if (Number(activeKey.tokenBalance) === -1) {
        // 已经无限,无需变更
      } else {
        await db
          .update(developerApiKeys)
          .set({
            tokenBalance: Number(activeKey.tokenBalance) + tokenQuota,
            updatedAt: new Date(),
          })
          .where(eq(developerApiKeys.id, activeKey.id))
      }
    }
    return { success: true, keyId: activeKey.id, tokenQuota }
  }

  // 5. 无 Key → 自动创建默认 Key
  const { key, secret } = generateApiKey()
  const hashed = hashSecret(secret)
  const [newKey] = await db
    .insert(developerApiKeys)
    .values({
      userId,
      name: `API 订阅自动创建 (${planRow.name})`,
      key,
      secret: hashed,
      permissions: [],
      status: 'active',
      rateLimit: 60,
      tokenBalance: tokenQuota === -1 ? -1 : Math.max(tokenQuota, 0),
    })
    .returning({ id: developerApiKeys.id })
  if (!newKey) return { success: false, reason: 'create_key_failed' }
  return { success: true, keyId: newKey.id, tokenQuota }
}

// =============================================================================
// 工具函数
// =============================================================================

/** 把 plan.features(unknown)规范化为 string[]。 */
function normalizeFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return []
  return features.filter((f): f is string => typeof f === 'string')
}
