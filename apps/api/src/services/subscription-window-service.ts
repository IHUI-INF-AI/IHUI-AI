// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 订阅窗口配额服务(2026-09-16 立)。
 *
 * 背景:此前 API 订阅激活时把 token 配额一次性累加进 developer_api_keys.token_balance,
 * 没有有效期也没有窗口概念,无法表达"包月每 20 万 token/天、200 万 token/月"这类商品。
 * 本服务基于 api_subscriptions(订阅实例) + api_subscription_window_usage(窗口用量),
 * 提供日/周/月三级窗口的额度校验与用量累计。
 *
 * 窗口口径(固定 UTC+8,中国无夏令时,与 tiered-pricing-service 月度口径一致):
 * - daily   → UTC+8 当日 00:00:00 ~ 次日 00:00:00
 * - weekly  → UTC+8 本周一 00:00:00 ~ 下周一 00:00:00
 * - monthly → UTC+8 当月 1 日 00:00:00 ~ 次月 1 日 00:00:00
 *
 * 限额语义(token):-1 = 不限(直接放行);0 = 未配置该维度(不参与校验);>0 = 上限。
 * 兼容性:无活跃订阅(存量用户只持有 token_balance)时,本服务一律返回"放行",
 * 不改变既有行为。
 *
 * 活跃订阅定义:status='active' AND start_at <= now() AND end_at > now()。
 * 续费时新订阅 start_at 取上一个订阅的 end_at(顺延),因此任一时刻至多一个活跃订阅。
 */
import { and, eq, lte, gt, sql, desc, inArray } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { apiSubscriptions, apiSubscriptionWindowUsage, type ApiSubscription } from '@ihui/database'

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 窗口类型。 */
export type WindowType = 'daily' | 'weekly' | 'monthly'

const ALL_WINDOW_TYPES: WindowType[] = ['daily', 'weekly', 'monthly']

/** 单个窗口的额度状态(对外返回,供前端画进度与倒计时)。 */
export interface SubscriptionWindowStatus {
  windowType: WindowType
  /** 限额 token:-1 不限;0 未配置;>0 上限 */
  limit: number
  used: number
  /** 剩余 token;limit<=0 时为 -1 */
  remaining: number
  windowStart: string
  windowEnd: string
  /** 距离窗口重置的秒数 */
  resetsInSeconds: number
}

/** 用户订阅 + 窗口总览。 */
export interface SubscriptionWindowView {
  subscription: {
    id: string
    planId: string | null
    planName: string
    startAt: string
    endAt: string
    autoRenew: boolean
  } | null
  windows: SubscriptionWindowStatus[]
}

/** 窗口校验结果。 */
export interface WindowQuotaCheck {
  allowed: boolean
  reason?: string
  blockedWindow?: SubscriptionWindowStatus
}

// =============================================================================
// 纯函数:窗口边界(可单测)
// =============================================================================

/** UTC+8 当日 00:00 对应的 UTC 时刻。 */
export function getUtc8DayStart(at: Date): Date {
  const shifted = new Date(at.getTime() + UTC8_OFFSET_MS)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0, 0) -
      UTC8_OFFSET_MS,
  )
}

/** UTC+8 本周一 00:00 对应的 UTC 时刻。 */
export function getUtc8WeekStart(at: Date): Date {
  const dayStart = getUtc8DayStart(at)
  const weekday = new Date(dayStart.getTime() + UTC8_OFFSET_MS).getUTCDay() // 0=周日
  const daysSinceMonday = (weekday + 6) % 7
  return new Date(dayStart.getTime() - daysSinceMonday * DAY_MS)
}

/** UTC+8 当月 1 日 00:00 对应的 UTC 时刻。 */
export function getUtc8MonthStart(at: Date): Date {
  const shifted = new Date(at.getTime() + UTC8_OFFSET_MS)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1, 0, 0, 0, 0) - UTC8_OFFSET_MS,
  )
}

/** 取某窗口类型在给定时刻的 [start, end) 边界。 */
export function getWindowBounds(
  windowType: WindowType,
  at: Date = new Date(),
): { start: Date; end: Date } {
  if (windowType === 'daily') {
    const start = getUtc8DayStart(at)
    return { start, end: new Date(start.getTime() + DAY_MS) }
  }
  if (windowType === 'weekly') {
    const start = getUtc8WeekStart(at)
    return { start, end: new Date(start.getTime() + 7 * DAY_MS) }
  }
  const start = getUtc8MonthStart(at)
  const shifted = new Date(start.getTime() + UTC8_OFFSET_MS)
  const nextMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1, 0, 0, 0, 0) - UTC8_OFFSET_MS,
  )
  return { start, end: nextMonth }
}

/** 从订阅实例取某窗口类型的限额。 */
export function limitOf(sub: ApiSubscription, windowType: WindowType): number {
  if (windowType === 'daily') return Number(sub.dailyTokenLimit ?? 0)
  if (windowType === 'weekly') return Number(sub.weeklyTokenLimit ?? 0)
  return Number(sub.monthlyTokenLimit ?? 0)
}

// =============================================================================
// 查询
// =============================================================================

/** 取用户当前活跃订阅(至多一条;按 startAt 降序取最新)。 */
export async function getActiveSubscription(
  userId: string,
  at: Date = new Date(),
): Promise<ApiSubscription | null> {
  try {
    const rows = await dbRead
      .select()
      .from(apiSubscriptions)
      .where(
        and(
          eq(apiSubscriptions.userId, userId),
          eq(apiSubscriptions.status, 'active'),
          lte(apiSubscriptions.startAt, at),
          gt(apiSubscriptions.endAt, at),
        ),
      )
      .orderBy(desc(apiSubscriptions.startAt))
      .limit(1)
    return (rows[0] as ApiSubscription) ?? null
  } catch {
    // 表未迁移等异常 → 视为无订阅,不影响调用
    return null
  }
}

/** 取某订阅在多个窗口上的已用量。 */
async function getWindowUsageMap(
  subscriptionId: string,
  at: Date,
): Promise<Map<WindowType, number>> {
  const result = new Map<WindowType, number>()
  const bounds = ALL_WINDOW_TYPES.map((w) => ({ w, ...getWindowBounds(w, at) }))
  try {
    const rows = await dbRead
      .select({
        windowType: apiSubscriptionWindowUsage.windowType,
        windowStart: apiSubscriptionWindowUsage.windowStart,
        tokensUsed: apiSubscriptionWindowUsage.tokensUsed,
      })
      .from(apiSubscriptionWindowUsage)
      .where(
        and(
          eq(apiSubscriptionWindowUsage.subscriptionId, subscriptionId),
          inArray(
            apiSubscriptionWindowUsage.windowStart,
            bounds.map((b) => b.start),
          ),
        ),
      )
    for (const r of rows) {
      const t = r.windowType as WindowType
      if (!ALL_WINDOW_TYPES.includes(t)) continue
      result.set(t, Number(r.tokensUsed ?? 0))
    }
  } catch {
    // 忽略:无用量数据
  }
  for (const b of bounds) if (!result.has(b.w)) result.set(b.w, 0)
  return result
}

/**
 * 组装用户订阅窗口总览(用户侧展示用)。
 * 无活跃订阅时 subscription=null、windows=[]。
 */
export async function getSubscriptionWindowView(
  userId: string,
  at: Date = new Date(),
): Promise<SubscriptionWindowView> {
  const sub = await getActiveSubscription(userId, at)
  if (!sub) return { subscription: null, windows: [] }
  const usage = await getWindowUsageMap(sub.id, at)
  const windows: SubscriptionWindowStatus[] = ALL_WINDOW_TYPES.map((w) => {
    const { start, end } = getWindowBounds(w, at)
    const limit = limitOf(sub, w)
    const used = usage.get(w) ?? 0
    const remaining = limit > 0 ? Math.max(0, limit - used) : -1
    return {
      windowType: w,
      limit,
      used,
      remaining,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      resetsInSeconds: Math.max(0, Math.floor((end.getTime() - at.getTime()) / 1000)),
    }
  })
  return {
    subscription: {
      id: sub.id,
      planId: sub.planId ?? null,
      planName: sub.planName,
      startAt: sub.startAt.toISOString(),
      endAt: sub.endAt.toISOString(),
      autoRenew: sub.autoRenew,
    },
    windows,
  }
}

/**
 * 校验窗口配额。
 *
 * 规则:对每个"已配置上限(limit>0)"的窗口,若 已用 + 预估 > limit 则拒绝。
 * 无活跃订阅 / 无限额配置 → 放行(兼容存量用户)。
 */
export async function checkSubscriptionWindowQuota(
  userId: string,
  estimatedTokens: number,
  at: Date = new Date(),
): Promise<WindowQuotaCheck> {
  const sub = await getActiveSubscription(userId, at)
  if (!sub) return { allowed: true }

  const configured = ALL_WINDOW_TYPES.filter((w) => limitOf(sub, w) > 0)
  if (configured.length === 0) return { allowed: true }

  const usage = await getWindowUsageMap(sub.id, at)
  const need = Math.max(0, estimatedTokens)

  for (const w of configured) {
    const limit = limitOf(sub, w)
    const used = usage.get(w) ?? 0
    if (used + need > limit) {
      const { start, end } = getWindowBounds(w, at)
      return {
        allowed: false,
        reason: `subscription_${w}_limit_exceeded`,
        blockedWindow: {
          windowType: w,
          limit,
          used,
          remaining: Math.max(0, limit - used),
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          resetsInSeconds: Math.max(0, Math.floor((end.getTime() - at.getTime()) / 1000)),
        },
      }
    }
  }
  return { allowed: true }
}

/**
 * 累加窗口用量(结算时调用)。
 *
 * 对每个"已配置上限"的窗口做 UPSERT 累加;并发下由
 * (subscription_id, window_type, window_start) 唯一索引保证只有一行,
 * 冲突时在 SQL 侧累加,避免读改写竞态。
 *
 * 失败不抛出(仅记录),调用方不应因用量统计异常而回滚计费。
 */
export async function consumeSubscriptionWindowUsage(
  userId: string,
  tokens: number,
  costCents: number,
  at: Date = new Date(),
): Promise<boolean> {
  const deltaTokens = Math.max(0, Math.round(tokens))
  if (deltaTokens === 0 && Math.max(0, costCents) === 0) return false
  try {
    const sub = await getActiveSubscription(userId, at)
    if (!sub) return false
    // 仅对配置了上限的窗口记账,避免无意义行膨胀
    const targets = ALL_WINDOW_TYPES.filter((w) => limitOf(sub, w) !== 0)
    if (targets.length === 0) return false

    const safeCost = Math.max(0, costCents)
    for (const w of targets) {
      const { start, end } = getWindowBounds(w, at)
      await db
        .insert(apiSubscriptionWindowUsage)
        .values({
          subscriptionId: sub.id,
          userId,
          windowType: w,
          windowStart: start,
          windowEnd: end,
          tokensUsed: deltaTokens,
          costUsedCents: safeCost,
        })
        .onConflictDoUpdate({
          target: [
            apiSubscriptionWindowUsage.subscriptionId,
            apiSubscriptionWindowUsage.windowType,
            apiSubscriptionWindowUsage.windowStart,
          ],
          set: {
            tokensUsed: sql`${apiSubscriptionWindowUsage.tokensUsed} + ${deltaTokens}`,
            costUsedCents: sql`${apiSubscriptionWindowUsage.costUsedCents} + ${safeCost}`,
            windowEnd: end,
            updatedAt: new Date(),
          },
        })
    }
    return true
  } catch {
    return false
  }
}

// =============================================================================
// 订阅实例创建(支付到账时调用)
// =============================================================================

/** 创建订阅实例入参。 */
export interface CreateSubscriptionInput {
  userId: string
  planId: string | null
  planName: string
  orderId?: string | null
  orderNo?: string | null
  validityDays: number
  dailyTokenLimit: number
  weeklyTokenLimit: number
  monthlyTokenLimit: number
  autoRenew?: boolean
  now?: Date
}

/**
 * 创建订阅实例。
 *
 * 有效期顺延规则:若用户已有活跃订阅(end_at > now),新订阅从旧订阅到期时刻开始
 * (start_at = 旧 end_at),使续费叠加时长而非覆盖;否则从 now 开始。
 *
 * 幂等:同一 orderNo 已创建过订阅时直接返回既有实例(回调重试安全)。
 */
export async function createSubscriptionForOrder(
  input: CreateSubscriptionInput,
): Promise<ApiSubscription | null> {
  const now = input.now ?? new Date()
  try {
    if (input.orderNo) {
      const [existing] = await dbRead
        .select()
        .from(apiSubscriptions)
        .where(eq(apiSubscriptions.orderNo, input.orderNo))
        .limit(1)
      if (existing) return existing as ApiSubscription
    }

    const validityDays =
      Number.isFinite(input.validityDays) && input.validityDays > 0
        ? Math.floor(input.validityDays)
        : 30

    const [current] = await dbRead
      .select({ endAt: apiSubscriptions.endAt })
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

    const startAt = current?.endAt && current.endAt.getTime() > now.getTime() ? current.endAt : now
    const endAt = new Date(startAt.getTime() + validityDays * DAY_MS)

    const [row] = await db
      .insert(apiSubscriptions)
      .values({
        userId: input.userId,
        planId: input.planId,
        orderId: input.orderId ?? null,
        orderNo: input.orderNo ?? null,
        planName: input.planName,
        status: 'active',
        startAt,
        endAt,
        dailyTokenLimit: input.dailyTokenLimit ?? 0,
        weeklyTokenLimit: input.weeklyTokenLimit ?? 0,
        monthlyTokenLimit: input.monthlyTokenLimit ?? 0,
        autoRenew: input.autoRenew ?? false,
      })
      .returning()
    return (row as ApiSubscription) ?? null
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
