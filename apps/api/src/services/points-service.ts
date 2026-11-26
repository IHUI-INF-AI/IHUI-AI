// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, lt, sql } from 'drizzle-orm'
import {
  pointTransactions,
  pointHolds,
  userPoints,
  type UserPoints,
  type PointTransaction,
} from '@ihui/database'
import { db } from '../db/index.js'
import { ensureDailyCreditRow, adjustPoints, type DbTx } from '../db/gamification-queries.js'
import { availableOf } from './daily-credits.js'
import { bizDayKey } from '../utils/biz-day.js'

/** 单次 AI/媒体调用预扣积分的默认冻结时长；到期未结算自动释放。 */
export const POINTS_HOLD_TTL_MS = 15 * 60 * 1000

export interface PointsResult {
  points: UserPoints
  transaction: PointTransaction
}

/**
 * 获得积分：增加余额、累计、经验，记录流水，并按经验更新等级。
 * 等级更新已在 adjustPoints 事务内同步完成,无需外部调用 updateLevel。
 */
export async function earnPoints(
  userId: string,
  amount: number,
  source: string,
  description?: string,
  referenceId?: string,
  tx?: DbTx,
): Promise<PointsResult> {
  if (amount <= 0) throw new Error('获得积分必须为正数')
  return adjustPoints(
    {
      userId,
      type: 'earn',
      amount,
      source,
      description,
      referenceId,
    },
    tx,
  )
}

/**
 * 消费积分：检查余额，扣减余额与累计消费，记录流水（不影响经验）。
 */
export async function spendPoints(
  userId: string,
  amount: number,
  source: string,
  description?: string,
  referenceId?: string,
  tx?: DbTx,
): Promise<PointsResult> {
  if (amount <= 0) throw new Error('消费积分必须为正数')
  // tx 透传给 adjustPoints:兑换这类"扣积分 + 占库存 + 落单"的多写链路必须全有或全无,
  // 各自开事务会出现"积分已扣、订单没落"或反过来的半截态(留钱不留货的资金黑洞)。
  return adjustPoints(
    {
      userId,
      type: 'spend',
      amount,
      source,
      description,
      referenceId,
    },
    tx,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export interface ReservePointsUsageInput {
  userId: string
  /** 本次最多可能扣掉的积分(整数,>0) */
  amount: number
  /** 流水来源,必须与最终 settlePointsUsage 的 source 一致 */
  source: string
  /** 稳定唯一引用;重试同一引用只冻结一次 */
  referenceId: string
  modelId?: string
  /** 预扣时的费率/单位价快照,结算按其计算 */
  pricingSnapshot?: Record<string, unknown>
  /** 冻结时长,默认 15 分钟 */
  ttlMs?: number
}

export interface ReservePointsUsageResult {
  /** 新建/命中的 hold id;余额不足时为 null */
  holdId: string | null
  /** 本次实际冻结的积分(命中已有 hold 时为原冻结额) */
  reserved: number
  /** 冻结后的可用余额 */
  remaining: number
  /** 同一引用已有生效 hold,本次未重复冻结 */
  alreadyHeld: boolean
  /** 同一引用已经结算过,本次不再冻结 */
  alreadySettled: boolean
  /** 余额不足未冻结的部分 */
  shortfall: number
}

/**
 * 开工前预扣积分。按“最多可能用量”冻结,结算时按真实用量扣费并释放差额。
 *
 * 这是并发防线的关键:预检只读余额会出现两个请求同时通过、最后只能扣到 0 的
 * 情况;冻结把“未来可能花的钱”从事前余额里拿掉,第二个请求必须等第一个结算/释放。
 */
export async function reservePointsUsage(
  input: ReservePointsUsageInput,
): Promise<ReservePointsUsageResult> {
  const amount = Math.max(0, Math.floor(input.amount))
  if (amount <= 0 || !input.referenceId) {
    return {
      holdId: null,
      reserved: 0,
      remaining: 0,
      alreadyHeld: false,
      alreadySettled: false,
      shortfall: amount,
    }
  }

  await ensureDailyCreditRow(input.userId)
  await releaseExpiredPointHolds(input.userId)

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, input.userId))
      .limit(1)
      .for('update')
    if (!account) throw new Error('积分账户不存在')

    const [existingHold] = await tx
      .select({ id: pointHolds.id, amount: pointHolds.amount })
      .from(pointHolds)
      .where(
        and(
          eq(pointHolds.userId, input.userId),
          eq(pointHolds.source, input.source),
          eq(pointHolds.referenceId, input.referenceId),
          eq(pointHolds.status, 'held'),
        ),
      )
      .limit(1)
    if (existingHold) {
      return {
        holdId: existingHold.id,
        reserved: existingHold.amount,
        remaining: availableOf(account),
        alreadyHeld: true,
        alreadySettled: false,
        shortfall: 0,
      }
    }

    const [existingSpend] = await tx
      .select({ amount: pointTransactions.amount })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, input.userId),
          eq(pointTransactions.type, 'spend'),
          eq(pointTransactions.source, input.source),
          eq(pointTransactions.referenceId, input.referenceId),
        ),
      )
      .limit(1)
    if (existingSpend) {
      return {
        holdId: null,
        reserved: 0,
        remaining: availableOf(account),
        alreadyHeld: false,
        alreadySettled: true,
        shortfall: 0,
      }
    }

    const available = availableOf(account)
    if (available < amount) {
      return {
        holdId: null,
        reserved: 0,
        remaining: available,
        alreadyHeld: false,
        alreadySettled: false,
        shortfall: amount - available,
      }
    }

    const [updated] = await tx
      .update(userPoints)
      .set({
        reservedPoints: sql`${userPoints.reservedPoints} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, input.userId))
      .returning()
    if (!updated) throw new Error('积分冻结失败')

    const expiresAt = new Date(Date.now() + (input.ttlMs ?? POINTS_HOLD_TTL_MS))
    const [hold] = await tx
      .insert(pointHolds)
      .values({
        userId: input.userId,
        source: input.source,
        referenceId: input.referenceId,
        modelId: input.modelId ?? null,
        amount,
        pricingSnapshot: input.pricingSnapshot ?? null,
        status: 'held',
        expiresAt,
      })
      .returning({ id: pointHolds.id })
    if (!hold) throw new Error('积分冻结流水创建失败')

    return {
      holdId: hold.id,
      reserved: amount,
      remaining: availableOf(updated),
      alreadyHeld: false,
      alreadySettled: false,
      shortfall: 0,
    }
  })
}

/** 查询一笔仍生效的冻结(含预扣快照);用于结算按原报价而非当前价。 */
export async function getActivePointsHold(input: {
  userId: string
  source: string
  referenceId: string
}): Promise<{ amount: number; pricingSnapshot: Record<string, unknown> | null } | null> {
  const [hold] = await db
    .select({
      amount: pointHolds.amount,
      pricingSnapshot: pointHolds.pricingSnapshot,
    })
    .from(pointHolds)
    .where(
      and(
        eq(pointHolds.userId, input.userId),
        eq(pointHolds.source, input.source),
        eq(pointHolds.referenceId, input.referenceId),
        eq(pointHolds.status, 'held'),
      ),
    )
    .limit(1)
  if (!hold) return null
  return {
    amount: hold.amount,
    pricingSnapshot:
      typeof hold.pricingSnapshot === 'object' && hold.pricingSnapshot !== null
        ? (hold.pricingSnapshot as Record<string, unknown>)
        : null,
  }
}

/** 查询最近一笔预扣的定价快照(含已过期/已释放),结算按当时报价,不受调价影响。 */
export async function getPointsHoldPricingSnapshot(input: {
  userId: string
  source: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  const [hold] = await db
    .select({ pricingSnapshot: pointHolds.pricingSnapshot })
    .from(pointHolds)
    .where(
      and(
        eq(pointHolds.userId, input.userId),
        eq(pointHolds.source, input.source),
        eq(pointHolds.referenceId, input.referenceId),
      ),
    )
    .orderBy(sql`${pointHolds.createdAt} desc`)
    .limit(1)
  if (!hold || typeof hold.pricingSnapshot !== 'object' || hold.pricingSnapshot === null) {
    return null
  }
  return hold.pricingSnapshot as Record<string, unknown>
}

/** 查询一笔仍生效的冻结额;用于产物已交付但定价行临时失效时按预扣额结算。 */
export async function getActivePointsHoldAmount(input: {
  userId: string
  source: string
  referenceId: string
}): Promise<number | null> {
  const [hold] = await db
    .select({ amount: pointHolds.amount })
    .from(pointHolds)
    .where(
      and(
        eq(pointHolds.userId, input.userId),
        eq(pointHolds.source, input.source),
        eq(pointHolds.referenceId, input.referenceId),
        eq(pointHolds.status, 'held'),
      ),
    )
    .limit(1)
  return hold?.amount ?? null
}

/** 主动释放一笔未结算的 hold(上游失败/用户取消)。返回是否命中。 */
export async function releasePointsHold(input: {
  userId: string
  source: string
  referenceId: string
  status?: 'released' | 'expired'
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, input.userId))
      .limit(1)
      .for('update')
    if (!account) return false

    const [hold] = await tx
      .select({ id: pointHolds.id, amount: pointHolds.amount })
      .from(pointHolds)
      .where(
        and(
          eq(pointHolds.userId, input.userId),
          eq(pointHolds.source, input.source),
          eq(pointHolds.referenceId, input.referenceId),
          eq(pointHolds.status, 'held'),
        ),
      )
      .limit(1)
    if (!hold) return false

    await tx
      .update(pointHolds)
      .set({ status: input.status ?? 'released', settledAt: new Date() })
      .where(eq(pointHolds.id, hold.id))
    await tx
      .update(userPoints)
      .set({
        reservedPoints: sql`GREATEST(${userPoints.reservedPoints} - ${hold.amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, input.userId))
    return true
  })
}

/** 释放该用户所有已到期的 hold;在每次预扣/余额读取前懒执行,避免定时任务依赖。 */
export async function releaseExpiredPointHolds(userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    // 与 reserve/release/settle 统一先锁 user_points 行,避免过期释放和新增冻结并发时
    // 把「刚冻结进来」的额度误当成过期额度扣掉。
    const [account] = await tx
      .select({ id: userPoints.id })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1)
      .for('update')
    if (!account) return 0

    const expired = await tx
      .update(pointHolds)
      .set({ status: 'expired', settledAt: new Date() })
      .where(
        and(
          eq(pointHolds.userId, userId),
          eq(pointHolds.status, 'held'),
          lt(pointHolds.expiresAt, new Date()),
        ),
      )
      .returning({ amount: pointHolds.amount })
    if (expired.length === 0) return 0

    const total = expired.reduce((sum, row) => sum + row.amount, 0)
    if (total > 0) {
      await tx
        .update(userPoints)
        .set({
          reservedPoints: sql`GREATEST(${userPoints.reservedPoints} - ${total}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(userPoints.userId, userId))
    }
    return total
  })
}

export interface SettlePointsUsageInput {
  userId: string
  /** 本次应扣积分(整数,>=0) */
  amount: number
  /** 流水来源,例如 llm_chat / crew_llm / stock_analysis */
  source: string
  description?: string
  /** 幂等键:同一用户、同一来源、同一引用只结算一次 */
  referenceId?: string
  /**
   * 预扣 hold 的引用键。默认与 referenceId 相同;媒体结算的幂等键是 taskId,
   * 而预扣发生在 taskId 生成前,需要单独传 request.id。
   */
  holdReferenceId?: string
  /** 预扣 hold 的 source,默认与 source 相同 */
  holdSource?: string
}

export interface SettlePointsUsageResult {
  /** 实际扣掉的积分(可能小于 amount) */
  deducted: number
  /** 结算后的可用余额(永久 + 当日剩余) */
  remaining: number
  /** 未扣到的差额;上游已产生成本时用于审计,不能静默吞掉 */
  shortfall: number
  /** 命中幂等键,本次未重复扣 */
  alreadySettled: boolean
}

/**
 * 结算一笔已经发生的 AI 用量:余额够就全扣,不够就扣到 0,差额返回给调用方。
 *
 * 与 spendPoints 的区别:
 * - spendPoints 是"先确认够付再扣",余额不足会抛错;
 * - 本函数用于流式/异步/上游已产生成本的场景,不能因为余额在中途被别的请求花掉
 *   就整笔不扣,否则平台白送。
 *
 * 并发安全:事务内 FOR UPDATE 锁 user_points 行,和 adjustPoints 共用同一行锁;
 * 扣减顺序与普通消费一致(先当日赠送,再永久积分)。
 */
export async function settlePointsUsage(
  input: SettlePointsUsageInput,
): Promise<SettlePointsUsageResult> {
  const amount = Math.max(0, Math.floor(input.amount))
  await ensureDailyCreditRow(input.userId)
  await releaseExpiredPointHolds(input.userId)

  const holdSource = input.holdSource ?? input.source
  const holdReferenceId = input.holdReferenceId ?? input.referenceId

  return db.transaction(async (tx) => {
    let [account] = await tx
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, input.userId))
      .limit(1)
      .for('update')
    if (!account) throw new Error('积分账户不存在')

    let hold: { id: string; amount: number } | null = null
    if (holdReferenceId) {
      const [activeHold] = await tx
        .select({ id: pointHolds.id, amount: pointHolds.amount })
        .from(pointHolds)
        .where(
          and(
            eq(pointHolds.userId, input.userId),
            eq(pointHolds.source, holdSource),
            eq(pointHolds.referenceId, holdReferenceId),
            eq(pointHolds.status, 'held'),
          ),
        )
        .limit(1)
      hold = activeHold ?? null
    }

    if (input.referenceId) {
      const [existing] = await tx
        .select({ amount: pointTransactions.amount })
        .from(pointTransactions)
        .where(
          and(
            eq(pointTransactions.userId, input.userId),
            eq(pointTransactions.type, 'spend'),
            eq(pointTransactions.source, input.source),
            eq(pointTransactions.referenceId, input.referenceId),
          ),
        )
        .limit(1)
      if (existing) {
        if (hold) {
          await tx
            .update(pointHolds)
            .set({ status: 'released', settledAt: new Date() })
            .where(eq(pointHolds.id, hold.id))
          const [released] = await tx
            .update(userPoints)
            .set({
              reservedPoints: sql`GREATEST(${userPoints.reservedPoints} - ${hold.amount}, 0)`,
              updatedAt: new Date(),
            })
            .where(eq(userPoints.userId, input.userId))
            .returning()
          if (released) account = released
        }
        return {
          deducted: Math.abs(existing.amount),
          remaining: availableOf(account),
          shortfall: 0,
          alreadySettled: true,
        }
      }
    }

    if (hold) {
      await tx
        .update(pointHolds)
        .set({ status: 'settled', settledAt: new Date() })
        .where(eq(pointHolds.id, hold.id))
      const [released] = await tx
        .update(userPoints)
        .set({
          reservedPoints: sql`GREATEST(${userPoints.reservedPoints} - ${hold.amount}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(userPoints.userId, input.userId))
        .returning()
      if (released) account = released
    }

    const availableBefore = availableOf(account)
    if (amount <= 0 || availableBefore <= 0) {
      return { deducted: 0, remaining: availableBefore, shortfall: amount, alreadySettled: false }
    }

    const deducted = Math.min(availableBefore, amount)
    const shortfall = amount - deducted
    // 跨日未刷新的昨日赠送不属于今日可用余额;只允许扣「今天」的赠送额,
    // 否则会把昨天残留的 daily_points 扣掉、永久余额不动,等于白送一次调用。
    const todayDaily =
      account.dailyPointsDate === bizDayKey() ? Math.max(0, account.dailyPoints) : 0
    const dailyDeduct = Math.min(todayDaily, deducted)
    const permanentDeduct = deducted - dailyDeduct

    const [updated] = await tx
      .update(userPoints)
      .set({
        dailyPoints: sql`${userPoints.dailyPoints} - ${dailyDeduct}`,
        points: sql`${userPoints.points} - ${permanentDeduct}`,
        totalSpent: sql`${userPoints.totalSpent} + ${permanentDeduct}`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, input.userId))
      .returning()
    if (!updated) throw new Error('积分扣减失败')

    await tx.insert(pointTransactions).values({
      userId: input.userId,
      type: 'spend',
      amount: -deducted,
      balanceAfter: availableOf(updated),
      source: input.source,
      description: input.description ?? null,
      referenceId: input.referenceId ?? null,
      createdAt: new Date(),
    })

    return { deducted, remaining: availableOf(updated), shortfall, alreadySettled: false }
  })
}

/**
 * 批量回收过期冻结 + 清理历史行(2026-11-26 立)。
 *
 * 原来只有用户下次请求时懒释放,长期不活跃用户的 `held` 会一直占着
 * `reserved_points`,历史 settled/released 行也会无限增长。本函数供每日任务调用:
 * - 过期 held → expired,并按用户汇总回退 reserved(一条语句,避免 N 次往返);
 * - 非 held 且超过保留期的行直接删除(默认 90 天,审计期内保留)。
 */
export async function cleanupPointHolds(options?: {
  retentionDays?: number
}): Promise<{ expired: number; releasedPoints: number; deleted: number }> {
  const retentionDays = Math.min(Math.max(Math.trunc(options?.retentionDays ?? 90), 7), 365)
  const expiredRes = await db.execute(sql`
    with expired as (
      update point_holds
      set status = 'expired', settled_at = now()
      where status = 'held' and expires_at < now()
      returning user_id, amount
    ),
    agg as (
      select user_id, count(*)::int as holds, sum(amount)::int as total
      from expired
      group by user_id
    )
    update user_points p
    set reserved_points = greatest(p.reserved_points - agg.total, 0),
        updated_at = now()
    from agg
    where p.user_id = agg.user_id
    returning agg.total, agg.holds
  `)
  const expiredRows =
    (expiredRes as unknown as { rows?: Array<{ total: number; holds: number }> }).rows ??
    (Array.isArray(expiredRes)
      ? (expiredRes as unknown as Array<{ total: number; holds: number }>)
      : [])
  const releasedPoints = expiredRows.reduce((sum, r) => sum + Number(r.total ?? 0), 0)
  const expired = expiredRows.reduce((sum, r) => sum + Number(r.holds ?? 0), 0)

  const deleteRes = await db.execute(sql`
    delete from point_holds
    where status <> 'held'
      and settled_at is not null
      and settled_at < now() - (${retentionDays}::int * interval '1 day')
  `)
  const deleted = Number(
    (deleteRes as unknown as { rowCount?: number }).rowCount ??
      (deleteRes as unknown as { rows?: unknown[] }).rows?.length ??
      0,
  )
  return { expired, releasedPoints, deleted }
}
