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

/**
 * 「不过期」的到期时刻哨兵值(SDB-03)。
 *
 * 为什么不写 NULL:api_subscriptions.end_at 在 schema 里是 NOT NULL,
 * 且本次修复不允许加迁移;写年份 9999 后,所有既有读取处
 * (gt(end_at, now) / end_at 排序 / toISOString 展示)无需改动即天然生效。
 */
const PERMANENT_END_AT = new Date('9999-12-31T23:59:59.999Z')

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
  /**
   * 判定本身失败(数据源不可用)时为 true:调用方应短暂退避后重试,
   * 而不是把它当成"额度耗尽"或"无订阅"。
   */
  retryable?: boolean
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

/** 查询用的数据源。配额判定与用量累计必须显式传主库 db(副本延迟会导致判错订阅)。 */
type ReadClient = typeof db

/**
 * 取用户当前活跃订阅(至多一条;按 startAt 降序取最新)。
 *
 * 不吞异常:查询失败(连接/权限/表缺失)会抛出,由调用方决定 fail-closed(配额/记账)
 * 还是降级(仅展示)。「查询失败」与「确无订阅」必须在调用方区分开。
 */
async function fetchActiveSubscription(
  client: ReadClient,
  userId: string,
  at: Date,
): Promise<ApiSubscription | null> {
  const rows = await client
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
}

/**
 * 取用户当前活跃订阅(展示用)。
 *
 * 查询失败降级为 null(等价于无订阅),只影响页面展示;配额判定与用量累计
 * 不走这里,而是直接走 fetchActiveSubscription(db, ...) 并 fail-closed。
 */
export async function getActiveSubscription(
  userId: string,
  at: Date = new Date(),
): Promise<ApiSubscription | null> {
  try {
    return await fetchActiveSubscription(dbRead, userId, at)
  } catch {
    // 展示路径:表未迁移等异常 → 视为无订阅,不影响调用
    return null
  }
}

/**
 * 取某订阅在多个窗口上的已用量。
 *
 * 不吞异常:查询失败由调用方决定 fail-closed 或降级,避免把"查不到用量"
 * 当成"用量为 0"而放行。
 */
async function fetchWindowUsageMap(
  client: ReadClient,
  subscriptionId: string,
  at: Date,
): Promise<Map<WindowType, number>> {
  const result = new Map<WindowType, number>()
  const bounds = ALL_WINDOW_TYPES.map((w) => ({ w, ...getWindowBounds(w, at) }))
  const rows = await client
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
  let usage: Map<WindowType, number>
  try {
    usage = await fetchWindowUsageMap(dbRead, sub.id, at)
  } catch {
    // 展示路径:用量读失败按 0 展示,不阻断页面渲染(配额判定不依赖此处)
    usage = new Map(ALL_WINDOW_TYPES.map((w) => [w, 0]))
  }
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
 *
 * 数据源与失败语义(2026-11-13,F-233):
 * - 订阅与用量一律读主库 db:副本延迟会把刚续费用户判到旧订阅,导致免费超用;
 * - 「查询失败」不等于「无订阅」:失败时 fail-closed 拒绝,并返回 retryable=true
 *   供调用方退避重试,绝不把 DB 抖动当成放行。
 */
export async function checkSubscriptionWindowQuota(
  userId: string,
  estimatedTokens: number,
  at: Date = new Date(),
): Promise<WindowQuotaCheck> {
  let sub: ApiSubscription | null
  try {
    sub = await fetchActiveSubscription(db, userId, at)
  } catch (err) {
    console.error('[subscription-window] 活跃订阅查询失败,窗口配额判定 fail-closed', err)
    return { allowed: false, reason: 'subscription_check_failed', retryable: true }
  }
  // 确无订阅:查询成功且返回空 → 按既有规则放行(存量 token_balance 用户)
  if (!sub) return { allowed: true }

  const configured = ALL_WINDOW_TYPES.filter((w) => limitOf(sub, w) > 0)
  if (configured.length === 0) return { allowed: true }

  let usage: Map<WindowType, number>
  try {
    usage = await fetchWindowUsageMap(db, sub.id, at)
  } catch (err) {
    console.error('[subscription-window] 窗口用量查询失败,窗口配额判定 fail-closed', err)
    return { allowed: false, reason: 'subscription_check_failed', retryable: true }
  }
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
 * 订阅必须从主库解析:副本延迟会把刚续费用户的用量记到旧订阅行(双重超额)。
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
    const sub = await fetchActiveSubscription(db, userId, at)
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
  } catch (err) {
    console.error('[subscription-window] 窗口用量累加失败,本次未记账', err)
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
  /** 有效期(天):0 = 不过期(永久);undefined/null = 未填,按既有默认 30 天 */
  validityDays?: number | null
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

    // SDB-03:文档语义「0 = 不过期」不能与「未填」混同。有效期的唯一判据就在本层:
    // undefined/null(以及运行期的 NaN)⇒ 既有默认 30 天;显式 0 ⇒ 永久;
    // 负数/非有限值 ⇒ 拒绝创建(管理端 zod 已拦,这里防绕过),绝不静默改成 30 天。
    const rawValidity = input.validityDays
    const validityDays =
      rawValidity === undefined || rawValidity === null
        ? 30
        : Number.isFinite(rawValidity) && rawValidity >= 0
          ? Math.floor(rawValidity)
          : null
    if (validityDays === null) return null

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
    // 0 = 不过期 → 直接落到哨兵值;续费基准若已是哨兵(前一份是永久订阅),
    // 叠加后不再算出 10000 年,统一收敛到哨兵(永久订阅吸收后续续费)。
    const computedEndAt = new Date(startAt.getTime() + validityDays * DAY_MS)
    const endAt =
      validityDays === 0 || computedEndAt.getTime() > PERMANENT_END_AT.getTime()
        ? PERMANENT_END_AT
        : computedEndAt

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
