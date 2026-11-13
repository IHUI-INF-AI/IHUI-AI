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
import { eq, and, desc, gt, sql, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  plans,
  orders,
  developerApiKeys,
  tokenFlows,
  userBillingGroups,
  apiSubscriptions,
} from '@ihui/database'
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

/** 事务句柄(仅约束本文件写 Key 所需的 update 能力)。 */
type KeyGrantTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * F-370:套餐模型白名单字段的唯一构造入口。
 *
 * 语义(与修复前一致):空数组/未配置 = 套餐不限制模型 = 不改动 Key 现状(全放行);
 * 非空 = 覆盖式写入(最后购买的套餐定边界)。
 */
function modelWhitelistFields(keyAllowedModels: string[] | null): { allowedModels?: string[] } {
  return keyAllowedModels && keyAllowedModels.length > 0
    ? { allowedModels: keyAllowedModels }
    : {}
}

/**
 * F-370:Key 授信(额度 + 模型白名单)写库的唯一出口。
 *
 * 历史缺陷:allowedModels 写在「累加额度」单一分支的 set 里,于是 quota=-1(无限套餐)、
 * Key 已是 -1、quota=0 三支只改余额/不写库,套餐 modelWhitelist 永不落库 ⇒
 * 低价套餐照样可调旗舰模型。现在任何分支都只能经由本函数写 Key,
 * 白名单随每次授信一起落库,新增额度分支也绕不过去。
 *
 * @param tokenBalance null = 本支不改余额(Key 已无限 / quota=0)
 */
async function applyKeyGrant(
  tx: KeyGrantTx,
  keyId: string,
  tokenBalance: number | SQL | null,
  keyAllowedModels: string[] | null,
): Promise<void> {
  const whitelistFields = modelWhitelistFields(keyAllowedModels)
  // 余额与白名单都无变更时不发 SQL(保留「Key 已无限再购有限套餐不 update」的既有语义)。
  if (tokenBalance === null && !whitelistFields.allowedModels) return
  await tx
    .update(developerApiKeys)
    .set({
      ...(tokenBalance !== null ? { tokenBalance } : {}),
      ...whitelistFields,
      updatedAt: new Date(),
    })
    .where(eq(developerApiKeys.id, keyId))
}

// =============================================================================
// 1.1 订阅有效期续期(F-373)— max(now, 当前到期) 起算 + 累计上限
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

/** 累计有效期上限(年)。 */
export const MAX_SUBSCRIPTION_YEARS = 5
/** 累计有效期上限(天);导出便于测试与运营核对。 */
export const MAX_SUBSCRIPTION_DAYS = MAX_SUBSCRIPTION_YEARS * 365

/** 有效期未配置时的既有默认值(与 subscription-window-service 保持一致)。 */
const DEFAULT_VALIDITY_DAYS = 30

/**
 * 「不过期」哨兵值,必须与 subscription-window-service 的 PERMANENT_END_AT 一致
 * (该文件不在 F-373 修改范围,这里只复制其语义)。
 */
const PERMANENT_END_AT = new Date('9999-12-31T23:59:59.999Z')

/** 有效期归一化:未配置 → 30 天;显式 0 = 永久;负数/非有限值 → 非法(null)。 */
function normalizeValidityDays(raw: number | null | undefined): number | null {
  if (raw === undefined || raw === null) return DEFAULT_VALIDITY_DAYS
  if (!Number.isFinite(raw) || raw < 0) return null
  return Math.floor(raw)
}

/** 单次续期的起止时刻。 */
export interface RenewalPeriod {
  allowed: boolean
  reason?: 'invalid_validity'
  /** 归一化后的有效期(天);0 = 永久 */
  validityDays: number
  /** 新周期起点 = max(now, 当前到期时刻) */
  startAt: Date
  /** 新周期到期时刻(已按累计上限截断) */
  endAt: Date
  /** 是否被累计上限截断 */
  truncated: boolean
}

/**
 * 计算一次续费后的到期时刻(纯函数,可单测)。
 *
 * F-373 规则:
 * 1. 续费基准是 `max(now, 当前到期时刻)`,不是 now —— 未到期续费从原到期日顺延,
 *    不会把已经买过、尚未用完的时间重复计费;
 * 2. 显式 0 天 = 永久订阅,沿用既有哨兵语义,不参与累计上限截断;
 * 3. 累计到期时刻不超过 `now + MAX_SUBSCRIPTION_DAYS`,超限即截断(由调用方告警)。
 */
export function computeRenewalPeriod(input: {
  now: Date
  validityDays?: number | null
  currentEndAt?: Date | null
}): RenewalPeriod {
  const now = input.now
  const validityDays = normalizeValidityDays(input.validityDays)
  const currentEndAt =
    input.currentEndAt && input.currentEndAt.getTime() > now.getTime() ? input.currentEndAt : null
  const startAt = currentEndAt ?? now
  if (validityDays === null) {
    return {
      allowed: false,
      reason: 'invalid_validity',
      validityDays: 0,
      startAt,
      endAt: startAt,
      truncated: false,
    }
  }
  if (validityDays === 0) {
    return { allowed: true, validityDays: 0, startAt, endAt: PERMANENT_END_AT, truncated: false }
  }
  const capAt = new Date(now.getTime() + MAX_SUBSCRIPTION_DAYS * DAY_MS)
  const rawEndAt = new Date(startAt.getTime() + validityDays * DAY_MS)
  if (startAt.getTime() >= capAt.getTime()) {
    // 当前到期已顶到上限:本次续期不再推进
    return { allowed: true, validityDays, startAt, endAt: capAt, truncated: true }
  }
  const truncated = rawEndAt.getTime() > capAt.getTime()
  return { allowed: true, validityDays, startAt, endAt: truncated ? capAt : rawEndAt, truncated }
}

/** 续费/叠加订阅入参。 */
export interface SubscriptionRenewalInput {
  userId: string
  planId: string
  planName: string
  orderNo?: string | null
  /** 有效期(天):0 = 永久;未配置/null = 30 天 */
  validityDays?: number | null
  dailyTokenLimit: number
  weeklyTokenLimit: number
  monthlyTokenLimit: number
  /** 可注入的当前时刻(测试替身用;生产不传,取系统时间) */
  now?: Date
}

/** 续费/叠加订阅结果。 */
export interface SubscriptionRenewalResult {
  ok: boolean
  reason?: 'invalid_validity' | 'create_failed' | 'write_failed'
  subscriptionId?: string
  endAt?: Date
  /** true = 本次续期被累计上限截断 */
  truncated?: boolean
}

/** 锁行结果:同套餐走原地续期,其余走新建实例。 */
type LockOutcome =
  | { kind: 'create'; current: { id: string; endAt: Date } | null }
  | { kind: 'same_plan'; result: SubscriptionRenewalResult }

/** 上限截断告警(F-373):重复激活被收敛必须留痕。 */
function warnRenewalTruncated(input: {
  userId: string
  planId: string
  orderNo?: string | null
  endAt: Date
}): void {
  logger.warn('[api-subscription] 订阅累计有效期超过上限,已按 5 年截断', {
    userId: input.userId,
    planId: input.planId,
    orderNo: input.orderNo ?? null,
    capDays: MAX_SUBSCRIPTION_DAYS,
    endAt: input.endAt.toISOString(),
  })
}

/**
 * 续费/叠加订阅有效期(F-373)。
 *
 * - 同一 planId:`SELECT ... FOR UPDATE` 锁住用户当前活跃订阅行,在行上按
 *   `max(now, endAt) + period` 延长并提交。并发回调因此串行:后到事务等前行提交后
 *   才读取 endAt,不会各自基于旧值重复叠加,也不会覆盖前一笔的延长。
 * - 跨 planId:剩余时长按 1:1 折算为保留时长,新套餐从旧订阅到期时刻起算
 *   (沿用既有「顺延」交互),同样受累计上限约束。
 * - 上限:任何路径的到期时刻不超过 `now + MAX_SUBSCRIPTION_DAYS`,超限截断并告警。
 */
export async function extendApiSubscriptionPeriod(
  input: SubscriptionRenewalInput,
): Promise<SubscriptionRenewalResult> {
  const now = input.now ?? new Date()
  const validityDays = normalizeValidityDays(input.validityDays)
  if (validityDays === null) return { ok: false, reason: 'invalid_validity' }

  let outcome: LockOutcome
  try {
    outcome = await db.transaction(async (tx): Promise<LockOutcome> => {
      const [current] = await tx
        .select({
          id: apiSubscriptions.id,
          planId: apiSubscriptions.planId,
          endAt: apiSubscriptions.endAt,
        })
        .from(apiSubscriptions)
        .where(
          and(
            eq(apiSubscriptions.userId, input.userId),
            eq(apiSubscriptions.status, 'active'),
            gt(apiSubscriptions.endAt, now),
          ),
        )
        .orderBy(desc(apiSubscriptions.endAt))
        .limit(1)
        .for('update')
      if (!current || (current.planId ?? null) !== input.planId) {
        return { kind: 'create', current: current ? { id: current.id, endAt: current.endAt } : null }
      }

      const period = computeRenewalPeriod({ now, validityDays, currentEndAt: current.endAt })
      if (!period.allowed) {
        return { kind: 'same_plan', result: { ok: false, reason: 'invalid_validity' } }
      }
      if (period.truncated) {
        warnRenewalTruncated({
          userId: input.userId,
          planId: input.planId,
          orderNo: input.orderNo,
          endAt: period.endAt,
        })
      }
      if (period.endAt.getTime() <= current.endAt.getTime()) {
        // 已顶到上限:幂等返回,不推进 endAt(重复激活无法继续延长)
        return {
          kind: 'same_plan',
          result: {
            ok: true,
            subscriptionId: current.id,
            endAt: current.endAt,
            truncated: true,
          },
        }
      }
      await tx
        .update(apiSubscriptions)
        .set({ endAt: period.endAt })
        .where(eq(apiSubscriptions.id, current.id))
      return {
        kind: 'same_plan',
        result: {
          ok: true,
          subscriptionId: current.id,
          endAt: period.endAt,
          truncated: period.truncated,
        },
      }
    })
  } catch (e) {
    logger.error('[api-subscription] 订阅续期失败', {
      userId: input.userId,
      planId: input.planId,
      orderNo: input.orderNo ?? null,
      err: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, reason: 'write_failed' }
  }

  if (outcome.kind === 'same_plan') return outcome.result

  // 无活跃订阅 / 跨套餐:新实例从 max(now, 旧到期) 起算,时长同样截断到上限内
  const period = computeRenewalPeriod({
    now,
    validityDays,
    currentEndAt: outcome.current?.endAt ?? null,
  })
  if (!period.allowed) return { ok: false, reason: 'invalid_validity' }
  if (period.truncated) {
    warnRenewalTruncated({
      userId: input.userId,
      planId: input.planId,
      orderNo: input.orderNo,
      endAt: period.endAt,
    })
  }
  const grantDays =
    period.validityDays === 0
      ? 0
      : Math.floor((period.endAt.getTime() - period.startAt.getTime()) / DAY_MS)
  if (period.validityDays !== 0 && grantDays <= 0) {
    return {
      ok: true,
      subscriptionId: outcome.current?.id,
      endAt: period.endAt,
      truncated: true,
    }
  }
  const created = await createSubscriptionForOrder({
    userId: input.userId,
    planId: input.planId,
    planName: input.planName,
    orderNo: input.orderNo ?? null,
    validityDays: period.validityDays === 0 ? 0 : grantDays,
    dailyTokenLimit: input.dailyTokenLimit,
    weeklyTokenLimit: input.weeklyTokenLimit,
    monthlyTokenLimit: input.monthlyTokenLimit,
    now: period.startAt,
  })
  if (!created) return { ok: false, reason: 'create_failed' }
  return {
    ok: true,
    subscriptionId: created.id,
    endAt: created.endAt,
    truncated: period.truncated,
  }
}

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
      modelWhitelist: plans.modelWhitelist,
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
  // SDB-04 修复(2026-11-08):窗口语义 -1 = 不限,不能参与 Math.max ——
  // 否则「日=-1 且周/月=0」会被算成 0,新 Key token_balance=0,relay 余额闸
  // (tokenBalance !== -1 && < estimated) 恒拒,该配置的付费套餐 100% 不可用。
  // 只要任一窗口为 -1,总量即 -1(无限);全部为 >0 时才取 max。
  const declaredQuota = parseTokenQuotaFromFeatures(planRow.features)
  const windowQuotaUnlimited =
    windowLimits.daily === -1 || windowLimits.weekly === -1 || windowLimits.monthly === -1
  const tokenQuota =
    declaredQuota !== 0
      ? declaredQuota
      : hasWindowLimits
        ? windowQuotaUnlimited
          ? -1
          : Math.max(windowLimits.daily, windowLimits.weekly, windowLimits.monthly)
        : 0

  // 模型白名单强制生效(2026-10-09 立,资损防线):
  // 套餐 modelWhitelist 必须落到 Key.allowedModels,否则低价套餐用户可以调旗舰模型
  // (gpt-5.6 输出成本 90 元/M),用 9.9 元套餐烧穿成本 —— 这是"白名单只在目录展示
  // 不参与鉴权"的洞。语义:覆盖式(最后购买的套餐定边界),防"低价套餐补余额 +
  // 保留旧高端白名单"的套利;空数组 = 套餐未配白名单 = 不改动 Key 现状。
  const planWhitelist = normalizeFeatures(planRow.modelWhitelist)
  const keyAllowedModels = planWhitelist.length > 0 ? planWhitelist : null

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

    // 4.2 事务内取活跃 Key 并锁行（DB-03 P1：原实现在事务外读快照）。
    //     READ COMMITTED 下事务外读到的 token_balance 可能已被并发入账改掉，
    //     应用层 `旧值 + quota` 写回会覆盖并发增量 ⇒ 丢账。
    //     FOR UPDATE 让同一 Key 的配额发放串行：后到事务等前行提交后
    //     再读取最新 token_balance，累加结果正确。
    const [activeKey] = await tx
      .select({
        id: developerApiKeys.id,
        tokenBalance: developerApiKeys.tokenBalance,
      })
      .from(developerApiKeys)
      .where(and(eq(developerApiKeys.userId, userId), eq(developerApiKeys.status, 'active')))
      .orderBy(desc(developerApiKeys.lastUsedAt), desc(developerApiKeys.createdAt))
      .limit(1)
      .for('update')

    let keyId: string
    let appliedQuota: number
    let balanceAfter: number
    if (activeKey) {
      keyId = activeKey.id
      // 累加:quota=-1(无限) → 设为 -1;quota>0 → token_balance += quota(若已 -1 保持 -1)
      if (tokenQuota === -1) {
        // 余额写 -1,白名单同样必须落库(F-370)
        await applyKeyGrant(tx, activeKey.id, -1, keyAllowedModels)
        // SDB-05:无限额度也是"授予量",流水 quantity 记 -1,与有限额度正数区分;
        // 原先记 0 会让流水与"零发放"无法区分。
        appliedQuota = -1
        balanceAfter = -1
      } else if (tokenQuota > 0) {
        // 已是无限额度则保持,否则累加
        if (Number(activeKey.tokenBalance) === -1) {
          // 余额不变,但白名单仍必须落库(F-370)
          await applyKeyGrant(tx, activeKey.id, null, keyAllowedModels)
          // 已经无限,无需变更
          appliedQuota = 0
          balanceAfter = -1
        } else {
          // F-369(P1):余额必须由数据库侧原子累加,禁止用读到的余额做绝对值 SET ——
          // 否则并发窗口内 relay 已扣掉的额度会被静默恢复(免扣费/双花)。
          // CASE 兜底:已无限(-1)的行保持 -1,不会被加回有限值。
          await applyKeyGrant(
            tx,
            activeKey.id,
            sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 ELSE ${developerApiKeys.tokenBalance} + ${tokenQuota} END`,
            keyAllowedModels,
          )
          // 审计用余额:FOR UPDATE 已锁行,快照即本次更新前的真值,不参与上面的写入。
          balanceAfter = Number(activeKey.tokenBalance) + tokenQuota
          appliedQuota = tokenQuota
        }
      } else {
        // quota=0:余额不变,白名单同样要落库(F-370)
        await applyKeyGrant(tx, activeKey.id, null, keyAllowedModels)
        appliedQuota = 0
        balanceAfter = Number(activeKey.tokenBalance)
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
          // F-370:新建 Key 同样经由唯一白名单构造入口
          ...modelWhitelistFields(keyAllowedModels),
        })
        .returning({ id: developerApiKeys.id })
      if (!newKey) return { success: false, reason: 'create_key_failed' }
      keyId = newKey.id
      appliedQuota = tokenQuota === -1 ? -1 : Math.max(tokenQuota, 0)
      // DB-03:流水 balance_after 必须等于落库后的真实余额
      balanceAfter = tokenQuota === -1 ? -1 : Math.max(tokenQuota, 0)
    }

    // 4.2 写配额发放流水作为幂等标记:只要订单号存在就写,与"实际发放量"解耦。
    //     SDB-05(2026-11-11):原守卫是 appliedQuota > 0,无限配额支路(quantity=0/-1)
    //     永远不落流水,回调重放既无幂等依据也无审计痕迹;且 balanceAfter 曾写死 0,
    //     财务对账读不出真实结余。quantity 语义:>0 实际发放量 / 0 余额未变更
    //     (如 Key 已无限) / -1 发放无限额度;balanceAfter 恒写事务内落库后的真实余额。
    //     op_type=6(API 订阅配额)避免与佣金 4 冲突,(related_order_no, op_type)
    //     唯一索引兜底并发重复回调。
    if (orderNo) {
      await tx.insert(tokenFlows).values({
        userId,
        opType: 6,
        quantity: appliedQuota,
        balanceAfter,
        remark: `API 订阅配额发放:${planRow.name}`,
        relatedOrderNo: orderNo,
      })
    }

    return { success: true, keyId, tokenQuota }
  })

  // 5/6. 窗口型订阅实例 + 分组自动入组(两者相互独立,任一配置即执行,2026-09-16 立)。
  //    - 幂等:extendApiSubscriptionPeriod 锁行原地续期(同套餐)/ createSubscriptionForOrder
  //      以 orderNo 去重(新建)、assignUserToGroup 以 userId upsert,回调重试不会重复建实例。
  //    - 顺延规则(F-373):新周期从 max(now, 当前到期) 起算,累计有效期不超过 5 年,
  //      重复激活不会无限延长。
  //    - 失败仅告警:实例创建失败降级为"仅 Key 余额"模式;入组失败不影响发放,均不阻断到账。
  if (result.success && (hasWindowLimits || planRow.billingGroupCode)) {
    let subEndAt: Date | undefined
    if (hasWindowLimits) {
      const renewal = await extendApiSubscriptionPeriod({
        userId,
        planId,
        planName: planRow.name,
        orderNo: orderNo ?? null,
        // SDB-03:有效期语义(0 = 永久 / 未填 = 30 天)只在 computeRenewalPeriod 与
        // createSubscriptionForOrder 判定,这里原样透传,避免第二份默认值把 0 吞掉。
        validityDays: planRow.validityDays,
        dailyTokenLimit: windowLimits.daily,
        weeklyTokenLimit: windowLimits.weekly,
        monthlyTokenLimit: windowLimits.monthly,
      })
      if (renewal.ok) {
        subEndAt = renewal.endAt
      } else {
        logger.warn('[api-subscription] 订阅实例创建/续期失败,降级为仅余额模式', {
          userId,
          planId,
          orderNo,
          reason: renewal.reason,
        })
      }
    } else if (planRow.billingGroupCode) {
      // F-374:无窗口限额时不建订阅实例,subEndAt 原为 undefined,入组时被写成
      // expiresAt=null,折扣判定把 null 当「永久」⇒ 一次误配即永久折扣。这里用套餐
      // 有效期显式推导到期时刻:0 天 = 永久(9999 哨兵),未配置 = 既有 30 天默认,
      // 非法有效期则拿不到周期(后面拒绝入组),绝不再透传 undefined。
      const period = computeRenewalPeriod({ now: new Date(), validityDays: planRow.validityDays })
      if (period.allowed) subEndAt = period.endAt
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
          if (!subEndAt) {
            // F-374:拿不到明确周期时拒绝入组(写 null 会被当永久折扣),宁可不给折扣
            logger.warn('[api-subscription] 套餐缺少有效订阅周期,拒绝写入计费分组', {
              userId,
              planId,
              orderNo,
              groupName,
              reason: 'missing_period',
            })
          } else {
            await assignUserToGroup(userId, group.id, 'subscription', subEndAt)
          }
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
