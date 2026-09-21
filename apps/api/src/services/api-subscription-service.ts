// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 订阅 service(P0-6 中转站产品化,2026-07-31 立)。
 *
 * 职责:
 * 1. activateApiSubscription: 订单激活时把 plan 的 token 配额写入用户当前活跃 Key
 * 2. getUserSubscriptionStatus: 查询用户当前订阅状态 + 剩余 token + 历史
 * 3. listApiSubscriptionPlans: 列出 3 档 API 订阅方案(name 以 'API ' 前缀 + isActive=true)
 * 4. parseTokenQuotaFromFeatures: 从 plan.features 字符串数组解析 token 配额
 *
 * 幂等:以订单 orderNo + token_flows(related_order_no, op_type=6)唯一键做去重,
 * 续费(新订单号)可正常发放,回调重试(同订单号)被拦截,无需新增表。
 *
 * 配额写入策略:
 * - 用户有 active Key → UPDATE token_balance += quota(累加,允许多次订阅叠加)
 * - 用户无 Key → 自动创建默认 Key 并设 token_balance = quota
 *
 * 不修改 plans 表结构,不依赖 user_subscriptions 表(不存在)。
 */
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { plans, orders, developerApiKeys, tokenFlows, userBillingGroups } from '@ihui/database'
import { generateApiKey, hashSecret } from '../utils/api-key-hash.js'
import { logger } from '../utils/logger.js'
// 窗口型订阅(2026-09-16 立):套餐配了日/周/月限额时,额外创建订阅实例
import {
  createSubscriptionForOrder,
  getSubscriptionWindowView,
  type SubscriptionWindowStatus,
  type SubscriptionWindowView,
} from './subscription-window-service.js'
// 分组售卖闭环(2026-09-16 立):套餐绑定计费分组时,订阅激活自动入组应用分组倍率
import { assignUserToGroup } from './user-billing-group-service.js'

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
  // ── 结构化商品字段(2026-09-16 立,对标同类中转站的套餐卡片) ──
  /** 划线原价(分);0 = 不展示原价 */
  originalPrice: number
  /** 有效期(天);0 = 不过期 */
  validityDays: number
  /** 日窗口限额(token):-1 不限 / 0 未配置 / >0 上限 */
  dailyTokenLimit: number
  /** 周窗口限额(token) */
  weeklyTokenLimit: number
  /** 月窗口限额(token) */
  monthlyTokenLimit: number
  /** 套餐可用模型白名单(空数组 = 全部模型) */
  modelWhitelist: string[]
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
  /** 当前订阅实例(含有效期);无活跃订阅时为 null(2026-09-16 立) */
  subscription: SubscriptionWindowView['subscription']
  /** 日/周/月窗口额度与重置倒计时;无活跃订阅时为空数组(2026-09-16 立) */
  windows: SubscriptionWindowStatus[]
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
      originalPrice: plans.originalPrice,
      validityDays: plans.validityDays,
      dailyTokenLimit: plans.dailyTokenLimit,
      weeklyTokenLimit: plans.weeklyTokenLimit,
      monthlyTokenLimit: plans.monthlyTokenLimit,
      modelWhitelist: plans.modelWhitelist,
    })
    .from(plans)
    // isForSale(2026-09-16):管理端下架后不再对外展示,已购订阅不受影响
    .where(
      and(eq(plans.isActive, true), eq(plans.isForSale, true), sql`${plans.name} LIKE 'API %'`),
    )
    .orderBy(plans.sortOrder)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    interval: r.interval,
    features: normalizeFeatures(r.features),
    billingPeriod: r.billingPeriod,
    originalPrice: Number(r.originalPrice ?? 0),
    validityDays: Number(r.validityDays ?? 30),
    dailyTokenLimit: Number(r.dailyTokenLimit ?? 0),
    weeklyTokenLimit: Number(r.weeklyTokenLimit ?? 0),
    monthlyTokenLimit: Number(r.monthlyTokenLimit ?? 0),
    modelWhitelist: normalizeFeatures(r.modelWhitelist),
  }))
}

/** 按 id 取单个 API 订阅方案(含结构化字段);不存在返回 null。 */
export async function getApiSubscriptionPlan(planId: string): Promise<PlanInfo | null> {
  const [row] = await dbRead
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      price: plans.price,
      interval: plans.interval,
      features: plans.features,
      billingPeriod: plans.billingPeriod,
      originalPrice: plans.originalPrice,
      validityDays: plans.validityDays,
      dailyTokenLimit: plans.dailyTokenLimit,
      weeklyTokenLimit: plans.weeklyTokenLimit,
      monthlyTokenLimit: plans.monthlyTokenLimit,
      modelWhitelist: plans.modelWhitelist,
    })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    interval: row.interval,
    features: normalizeFeatures(row.features),
    billingPeriod: row.billingPeriod,
    originalPrice: Number(row.originalPrice ?? 0),
    validityDays: Number(row.validityDays ?? 30),
    dailyTokenLimit: Number(row.dailyTokenLimit ?? 0),
    weeklyTokenLimit: Number(row.weeklyTokenLimit ?? 0),
    monthlyTokenLimit: Number(row.monthlyTokenLimit ?? 0),
    modelWhitelist: normalizeFeatures(row.modelWhitelist),
  }
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
export async function getUserSubscriptionStatus(userId: string): Promise<UserSubscriptionStatus> {
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
  //    复用 getApiSubscriptionPlan,保证与套餐列表返回同构(含 2026-09-16 新增结构化字段),
  //    避免两处 select 字段漂移导致前端拿到的套餐字段不一致。
  const paidOrder = orderRows.find((r) => r.status === 'paid' && r.planId)
  const activePlan = paidOrder?.planId ? await getApiSubscriptionPlan(paidOrder.planId) : null

  // 3. remainingTokens:用户所有 active Key 的 token_balance 之和
  const keyRows = await dbRead
    .select({ tokenBalance: developerApiKeys.tokenBalance })
    .from(developerApiKeys)
    .where(and(eq(developerApiKeys.userId, userId), eq(developerApiKeys.status, 'active')))
  const hasInfinite = keyRows.some((k) => Number(k.tokenBalance) === -1)
  const remainingTokens = hasInfinite
    ? -1
    : keyRows.reduce((s, k) => s + Math.max(Number(k.tokenBalance), 0), 0)

  // 4. 订阅窗口额度(2026-09-16 立):日/周/月已用量与重置倒计时。
  //    无活跃订阅(存量用户只有 token_balance)时返回空数组,前端据此隐藏窗口区块。
  const windowView = await getSubscriptionWindowView(userId)

  return {
    activePlan,
    remainingTokens,
    history,
    subscription: windowView.subscription,
    windows: windowView.windows,
  }
}

// =============================================================================
// 1. activateApiSubscription — 激活订阅(写 token 配额到 Key)
// =============================================================================

/**
 * 激活 API 订阅:把 plan 的 token 配额写入用户当前活跃 Key 的 token_balance。
 *
 * 流程:
 * 1. 查 plan → 解析 features 拿 tokenQuota(0 视为无配额,仍返回 success)
 * 2. 幂等检查:以订单 orderNo 为幂等键,查 token_flows(related_order_no=orderNo, op_type=6)
 *    是否已有配额发放流水 → 有则视为该订单已激活,跳过(回调重试幂等)
 * 3. 找用户当前活跃 Key(status=active,按 lastUsedAt desc + createdAt desc)
 * 4. 有 Key → 事务内 UPDATE token_balance += quota + 写 token_flows 流水
 *    无 Key → 事务内自动创建默认 Key(token_balance = quota) + 写流水
 *
 * P1 修复(2026-08-06):原幂等判断用「paid + orderType=6 + userId + planId 订单数量 > 1」,
 * 用户同方案续费会产生第 2 条 paid 订单 → 被误判 already_activated,续费配额不发放。
 * 改为按订单 orderNo + token_flows 唯一键,续费(新订单号)天然通过,回调重试(同订单号)被拦截。
 *
 * @param userId 用户 id
 * @param planId 订阅方案 id
 * @param orderNo 当前支付订单号(幂等键,必须传;缺失时降级按旧逻辑处理)
 * @returns { success, keyId, tokenQuota, reason }
 */
export async function activateApiSubscription(
  userId: string,
  planId: string,
  orderNo?: string,
): Promise<ActivateResult> {
  // 1. 查 plan
  const [planRow] = await dbRead
    .select({
      id: plans.id,
      name: plans.name,
      features: plans.features,
      validityDays: plans.validityDays,
      dailyTokenLimit: plans.dailyTokenLimit,
      weeklyTokenLimit: plans.weeklyTokenLimit,
      monthlyTokenLimit: plans.monthlyTokenLimit,
      billingGroupCode: plans.billingGroupCode,
    })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1)
  if (!planRow) return { success: false, reason: 'plan_not_found' }

  // 窗口限额配置(2026-09-16 立):任一维度非 0 即视为"窗口型订阅"。
  // 语义:-1 = 不限;0 = 未配置该维度;>0 = 窗口上限(token)。
  const windowLimits = {
    daily: Number(planRow.dailyTokenLimit ?? 0),
    weekly: Number(planRow.weeklyTokenLimit ?? 0),
    monthly: Number(planRow.monthlyTokenLimit ?? 0),
  }
  const hasWindowLimits =
    windowLimits.daily !== 0 || windowLimits.weekly !== 0 || windowLimits.monthly !== 0

  // 配额(2026-09-16 调整):优先用 features 声明的配额(兼容存量方案);
  // 若套餐只配了窗口限额而未在 features 里声明总量,则取窗口限额最大值作为
  // Key 余额上限,避免"余额为 0 且未声明无限额度"导致订阅后仍被 checkQuota 拒绝。
  const declaredQuota = parseTokenQuotaFromFeatures(planRow.features)
  const tokenQuota =
    declaredQuota !== 0
      ? declaredQuota
      : hasWindowLimits
        ? Math.max(windowLimits.daily, windowLimits.weekly, windowLimits.monthly)
        : 0

  // 2. 幂等:以订单 orderNo 为键,查该订单是否已发放过配额流水
  //    (op_type=6 = API 订阅配额发放;token_flows (related_order_no, op_type) 唯一索引兜底)
  if (orderNo) {
    const [existingFlow] = await dbRead
      .select({ id: tokenFlows.id })
      .from(tokenFlows)
      .where(and(eq(tokenFlows.relatedOrderNo, orderNo), eq(tokenFlows.opType, 6)))
      .limit(1)
    if (existingFlow) {
      return { success: false, reason: 'already_activated' }
    }
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

  // 4. 事务内:写入配额 + 记录发放流水(流水唯一索引拦截并发重复回调)
  const result = await db.transaction(async (tx) => {
    // 4.1 事务内二次幂等检查(防 TOCTOU:查无流水 → 并发回调重复发放)
    if (orderNo) {
      const [existingFlow] = await tx
        .select({ id: tokenFlows.id })
        .from(tokenFlows)
        .where(and(eq(tokenFlows.relatedOrderNo, orderNo), eq(tokenFlows.opType, 6)))
        .limit(1)
      if (existingFlow) return { success: false, reason: 'already_activated' }
    }

    let keyId: string
    let appliedQuota: number
    if (activeKey) {
      keyId = activeKey.id
      // 累加:quota=-1(无限) → 设为 -1;quota>0 → token_balance += quota(若已 -1 保持 -1)
      if (tokenQuota === -1) {
        await tx
          .update(developerApiKeys)
          .set({ tokenBalance: -1, updatedAt: new Date() })
          .where(eq(developerApiKeys.id, activeKey.id))
        appliedQuota = 0
      } else if (tokenQuota > 0) {
        // 已是无限额度则保持,否则累加
        if (Number(activeKey.tokenBalance) === -1) {
          // 已经无限,无需变更
          appliedQuota = 0
        } else {
          await tx
            .update(developerApiKeys)
            .set({
              tokenBalance: Number(activeKey.tokenBalance) + tokenQuota,
              updatedAt: new Date(),
            })
            .where(eq(developerApiKeys.id, activeKey.id))
          appliedQuota = tokenQuota
        }
      } else {
        appliedQuota = 0
      }
    } else {
      // 5. 无 Key → 自动创建默认 Key
      const { key, secret } = generateApiKey()
      const hashed = hashSecret(secret)
      const [newKey] = await tx
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
      keyId = newKey.id
      appliedQuota = tokenQuota === -1 ? 0 : Math.max(tokenQuota, 0)
    }

    // 4.2 写配额发放流水作为幂等标记(仅当 orderNo 存在;op_type=6 避免与佣金 4 冲突)
    if (orderNo && appliedQuota > 0) {
      await tx.insert(tokenFlows).values({
        userId,
        opType: 6,
        quantity: appliedQuota,
        balanceAfter: 0,
        remark: `API 订阅配额发放:${planRow.name}`,
        relatedOrderNo: orderNo,
      })
    }

    return { success: true, keyId, tokenQuota }
  })

  // 5/6. 窗口型订阅实例 + 分组自动入组(两者相互独立,任一配置即执行,2026-09-16 立)。
  //    - 幂等:createSubscriptionForOrder 以 orderNo 去重、assignUserToGroup 以 userId upsert,
  //      回调重试不会重复建实例/重复入组。
  //    - 续费顺延:已有活跃订阅时,新实例从旧订阅到期时刻开始,叠加时长而非覆盖。
  //    - 失败仅告警:实例创建失败降级为"仅 Key 余额"模式;入组失败不影响发放,均不阻断到账。
  if (result.success && (hasWindowLimits || planRow.billingGroupCode)) {
    let subEndAt: Date | undefined
    if (hasWindowLimits) {
      const sub = await createSubscriptionForOrder({
        userId,
        planId,
        planName: planRow.name,
        orderNo: orderNo ?? null,
        validityDays: Number(planRow.validityDays ?? 30),
        dailyTokenLimit: windowLimits.daily,
        weeklyTokenLimit: windowLimits.weekly,
        monthlyTokenLimit: windowLimits.monthly,
      })
      if (sub) {
        subEndAt = sub.endAt
      } else {
        logger.warn('[api-subscription] 订阅实例创建失败,降级为仅余额模式', {
          userId,
          planId,
          orderNo,
        })
      }
    }

    // 6. 分组售卖闭环:套餐绑定计费分组时,激活即自动入组——用户立即应用分组倍率
    //    与限流(买 Pro → vip 组,买 Enterprise → svip 组,这正是 user_billing_groups
    //    表注释写明但一直未实现的设计意图)。按分组 name 软关联(billingGroupCode
    //    存 name,该表以 name 唯一);members.expiresAt = 订阅 endAt,到期自动降级。
    const groupName = planRow.billingGroupCode
    if (groupName) {
      try {
        const [group] = await dbRead
          .select({ id: userBillingGroups.id })
          .from(userBillingGroups)
          .where(and(eq(userBillingGroups.name, groupName), eq(userBillingGroups.enabled, true)))
          .limit(1)
        if (group) {
          await assignUserToGroup(userId, group.id, 'subscription', subEndAt)
        } else {
          logger.warn('[api-subscription] 订阅分组不存在或未启用,跳过入组', {
            userId,
            groupName,
          })
        }
      } catch (e) {
        logger.warn('[api-subscription] 订阅入组失败(不影响到账)', {
          userId,
          groupName,
          err: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return result
}

// =============================================================================
// 工具函数
// =============================================================================

/** 把 plan.features(unknown)规范化为 string[]。 */
function normalizeFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return []
  return features.filter((f): f is string => typeof f === 'string')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
