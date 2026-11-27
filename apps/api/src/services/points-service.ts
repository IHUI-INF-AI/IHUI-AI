// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, inArray, lt, sql } from 'drizzle-orm'
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

/**
 * 单次 AI/媒体调用预扣积分的默认冻结时长。
 *
 * 15 分钟会把长上下文/Agent 流式调用卡在边界上(2026-11-27 生产实测一条请求
 * 11:27 冻结、11:42 到期,结算时已找不到 held 行)。改为 60 分钟,并配合
 * settle_pending 重试兜底;超过 60 分钟仍未结算的差额落负余额欠费,不再白送。
 */
export const POINTS_HOLD_TTL_MS = 60 * 60 * 1000
/** 结算失败后待结算 hold 的续期时长;给周期重试留足窗口,不直接释放。 */
export const POINTS_SETTLE_PENDING_TTL_MS = 6 * 60 * 60 * 1000

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
  /** 冻结时长,默认 60 分钟 */
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
          inArray(pointHolds.status, ['held', 'settle_pending']),
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
        inArray(pointHolds.status, ['held', 'settle_pending']),
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
        inArray(pointHolds.status, ['held', 'settle_pending']),
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
          inArray(pointHolds.status, ['held', 'settle_pending']),
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
  /** 实际从可用余额扣掉的积分(可能小于 amount) */
  deducted: number
  /** 结算后的可用余额(永久 + 当日剩余 - 冻结;负数欠费夹到 0) */
  remaining: number
  /** 未从可用余额扣到、已计入负余额的差额;上游已产生成本时用于审计 */
  shortfall: number
  /** 命中幂等键,本次未重复扣 */
  alreadySettled: boolean
}

/**
 * 结算一笔已经发生的 AI 用量:余额够就全扣,不够就把差额记成负余额欠费。
 *
 * 与 spendPoints 的区别:
 * - spendPoints 是"先确认够付再扣",余额不足会抛错;
 * - 本函数用于流式/异步/上游已产生成本的场景,不能因为余额在中途被别的请求花掉
 *   就整笔不扣,否则平台白送。差额落 `user_points.points` 负值,后续充值/赠送
 *   自动抵消;`availableOf` 对负余额夹到 0,欠费期间无法继续发起新调用。
 *
 * 并发安全:事务内 FOR UPDATE 锁 user_points 行,和 adjustPoints 共用同一行锁;
 * 扣减顺序与普通消费一致(先当日赠送,再永久积分)。结算失败会做有界重试,
 * 仍失败则由调用方标记 settle_pending,不直接释放冻结。
 */
export async function settlePointsUsage(
  input: SettlePointsUsageInput,
): Promise<SettlePointsUsageResult> {
  const amount = Math.max(0, Math.floor(input.amount))
  await ensureDailyCreditRow(input.userId)

  const holdSource = input.holdSource ?? input.source
  const holdReferenceId = input.holdReferenceId ?? input.referenceId
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
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
                // 不先跑过期回收:在途请求即使越过 expires_at,也必须先把这笔 hold
                // 结算掉;否则会先被置 expired、再按“找不到 hold”结算,形成短收。
                inArray(pointHolds.status, ['held', 'settle_pending']),
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
        if (amount <= 0) {
          return { deducted: 0, remaining: availableBefore, shortfall: 0, alreadySettled: false }
        }

        // 能扣多少扣多少;剩余差额直接写进负余额,成为可审计、可被后续充值抵消的欠费。
        const deducted = Math.min(Math.max(0, availableBefore), amount)
        const shortfall = amount - deducted
        // 跨日未刷新的昨日赠送不属于今日可用余额;只允许扣「今天」的赠送额,
        // 否则会把昨天残留的 daily_points 扣掉、永久余额不动,等于白送一次调用。
        const todayDaily =
          account.dailyPointsDate === bizDayKey() ? Math.max(0, account.dailyPoints) : 0
        // 欠费先用今日赠送补平:points 为负时,今天这份赠送先对冲欠费本金,
        // 剩余才是可用于本次消费的额度。否则赠送跨日作废后欠费永远留在 points 上,
        // available 虽然算得对,但欠费本金会被高估。
        const debtOffset = Math.min(todayDaily, Math.max(0, -account.points))
        const dailyDeduct = Math.min(todayDaily - debtOffset, deducted)
        const permanentDeduct = deducted - dailyDeduct

        const [updated] = await tx
          .update(userPoints)
          .set({
            dailyPoints: sql`${userPoints.dailyPoints} - ${debtOffset + dailyDeduct}`,
            // 欠费部分记为负 points,而不是只扣到 0 后把短收丢掉。
            points: sql`${userPoints.points} + ${debtOffset} - ${permanentDeduct} - ${shortfall}`,
            totalSpent: sql`${userPoints.totalSpent} + ${permanentDeduct} + ${shortfall}`,
            updatedAt: new Date(),
          })
          .where(eq(userPoints.userId, input.userId))
          .returning()
        if (!updated) throw new Error('积分扣减失败')

        await tx.insert(pointTransactions).values({
          userId: input.userId,
          type: 'spend',
          // 流水按“本次应扣”全额记,余额可能为负;短收因此不会从账上消失。
          amount: -amount,
          balanceAfter: availableOf(updated),
          source: input.source,
          description: input.description ?? null,
          referenceId: input.referenceId ?? null,
          createdAt: new Date(),
        })

        return {
          deducted,
          remaining: availableOf(updated),
          shortfall,
          alreadySettled: false,
        }
      })
    } catch (err) {
      lastError = err
      if (attempt < 3 && isRetryablePointsDbError(err)) {
        await sleepMs(50 * attempt)
        continue
      }
      throw err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('积分结算失败')
}

/** 只对连接/死锁类瞬时错误重试;业务错误重试也不会成功,反而放大延迟。 */
function isRetryablePointsDbError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code ?? ''
  const message = err instanceof Error ? err.message : String(err)
  return (
    /^(08|40P01|40001|57P01|57P02|57P03|53300)/.test(code) ||
    /deadlock|connection|timeout|too many clients|server closed/i.test(message)
  )
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 把一笔已交付/已发生、但积分结算暂时失败的 hold 标记为待结算:
 * 保留 reserved,续期 6 小时,由周期任务按快照金额重试。
 *
 * 不在这里释放,是因为“结算失败”不等于“免费”;释放会让已交付的调用彻底漏收。
 */
export async function markPointHoldPendingSettlement(input: {
  userId: string
  source: string
  referenceId: string
  /** 本次应扣积分(实际金额,不是预扣上限) */
  amount: number
  /** 结算幂等键;默认与 hold referenceId 相同 */
  settlementReferenceId?: string
  modelId?: string
  description?: string
}): Promise<boolean> {
  const amount = Math.max(0, Math.floor(input.amount))
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: userPoints.id })
      .from(userPoints)
      .where(eq(userPoints.userId, input.userId))
      .limit(1)
      .for('update')
    if (!account) return false

    const [hold] = await tx
      .select({ id: pointHolds.id })
      .from(pointHolds)
      .where(
        and(
          eq(pointHolds.userId, input.userId),
          eq(pointHolds.source, input.source),
          eq(pointHolds.referenceId, input.referenceId),
          inArray(pointHolds.status, ['held', 'settle_pending']),
        ),
      )
      .limit(1)

    const patch = JSON.stringify({
      settlementPending: {
        amount,
        settlementReferenceId: input.settlementReferenceId ?? input.referenceId,
        description: input.description ?? null,
        markedAt: new Date().toISOString(),
      },
    })

    if (!hold) {
      // 异步回调等“调用后才结算”的链路没有预扣 hold;仍要落一条 0 冻结的
      // settle_pending 行作为重试队列,否则结算失败后没有任何账可追。
      if (amount <= 0) return false
      await tx.insert(pointHolds).values({
        userId: input.userId,
        source: input.source,
        referenceId: input.referenceId,
        modelId: input.modelId ?? null,
        amount: 0,
        pricingSnapshot: sql`${patch}::jsonb`,
        status: 'settle_pending',
        expiresAt: new Date(Date.now() + POINTS_SETTLE_PENDING_TTL_MS),
      })
      return true
    }

    await tx
      .update(pointHolds)
      .set({
        status: 'settle_pending',
        expiresAt: new Date(Date.now() + POINTS_SETTLE_PENDING_TTL_MS),
        pricingSnapshot: sql`coalesce(${pointHolds.pricingSnapshot}, '{}'::jsonb) || ${patch}::jsonb`,
      })
      .where(eq(pointHolds.id, hold.id))
    return true
  })
}

/**
 * 周期重试 settle_pending hold。最多 100 笔/轮,按创建时间从旧到新;
 * 单笔失败只留日志,不阻塞其他用户,也不把 hold 释放。
 */
export async function retryPendingPointHolds(
  limit = 100,
): Promise<{ scanned: number; settled: number; failed: number }> {
  const rows = await db
    .select({
      id: pointHolds.id,
      userId: pointHolds.userId,
      source: pointHolds.source,
      referenceId: pointHolds.referenceId,
      amount: pointHolds.amount,
      pricingSnapshot: pointHolds.pricingSnapshot,
    })
    .from(pointHolds)
    .where(eq(pointHolds.status, 'settle_pending'))
    .orderBy(pointHolds.createdAt)
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 500))

  let settled = 0
  let failed = 0
  for (const row of rows) {
    const snapshot =
      typeof row.pricingSnapshot === 'object' && row.pricingSnapshot !== null
        ? (row.pricingSnapshot as Record<string, unknown>)
        : {}
    const pending =
      typeof snapshot.settlementPending === 'object' && snapshot.settlementPending !== null
        ? (snapshot.settlementPending as Record<string, unknown>)
        : {}
    const amount = Number(pending.amount ?? row.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      failed += 1
      continue
    }
    try {
      await settlePointsUsage({
        userId: row.userId,
        amount,
        source: row.source,
        referenceId: String(pending.settlementReferenceId ?? row.referenceId),
        holdReferenceId: row.referenceId,
        holdSource: row.source,
        description:
          typeof pending.description === 'string' ? pending.description : 'settle_pending retry',
      })
      settled += 1
    } catch {
      failed += 1
    }
  }
  return { scanned: rows.length, settled, failed }
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

/** 从 drizzle db.execute 的两种返回形态里取 rows(driver 升级前后兼容)。 */
function holdRows<T>(result: unknown): T[] {
  return (result as { rows?: T[] }).rows ?? (Array.isArray(result) ? (result as T[]) : [])
}

export interface PointHoldHealth {
  asOf: string
  /** 当前仍处于 held 的冻结(含已过期但尚未被回收的 stale 行) */
  held: { count: number; points: number; oldestAgeMinutes: number }
  /** 已交付/已发生但积分结算失败、等待周期重试的冻结(保留 reserved) */
  pending: { count: number; points: number }
  /** expires_at 已过但仍 status=held,等待每日任务/懒释放回收 */
  staleHeld: { count: number; points: number }
  /** 近 24 小时终态:过期回收 / 正常结算 / 主动释放 */
  last24h: {
    expired: { count: number; points: number }
    settled: { count: number; points: number }
    released: { count: number; points: number }
  }
  /** 近 24 小时按 source 拆分,定位哪个业务口冻结最多 */
  bySource: Array<{ source: string; status: string; count: number; points: number }>
  /** user_points.reserved_points 与 point_holds held 汇总不一致的账户 */
  reservedMismatch: { users: number; points: number }
}

/**
 * 积分冻结健康大盘(2026-11-26 立)。
 *
 * 只看日志无法回答"现在压了多少积分、有没有过期没释放、账面 reserved 是否漂移",
 * 这里把 point_holds 的实时状态聚合成一屏可观测指标;只读,不修改任何数据。
 */
export async function getPointHoldHealth(): Promise<PointHoldHealth> {
  const heldRes = await db.execute(sql`
    select count(*)::int as count,
           coalesce(sum(amount), 0)::bigint as points,
           min(created_at) as oldest
    from point_holds
    where status = 'held'
  `)
  const heldRow = holdRows<{
    count: number
    points: number | string
    oldest: Date | string | null
  }>(heldRes)[0]
  const heldCount = Number(heldRow?.count ?? 0)
  const heldPoints = Number(heldRow?.points ?? 0)
  const oldestMs = heldRow?.oldest ? new Date(heldRow.oldest).getTime() : NaN
  const oldestAgeMinutes = Number.isFinite(oldestMs)
    ? Math.max(0, Math.trunc((Date.now() - oldestMs) / 60_000))
    : 0

  const staleRes = await db.execute(sql`
    select count(*)::int as count, coalesce(sum(amount), 0)::bigint as points
    from point_holds
    where status = 'held' and expires_at < now()
  `)
  const staleRow = holdRows<{ count: number; points: number | string }>(staleRes)[0]
  const staleHeld = {
    count: Number(staleRow?.count ?? 0),
    points: Number(staleRow?.points ?? 0),
  }

  const pendingRes = await db.execute(sql`
    select count(*)::int as count, coalesce(sum(amount), 0)::bigint as points
    from point_holds
    where status = 'settle_pending'
  `)
  const pendingRow = holdRows<{ count: number; points: number | string }>(pendingRes)[0]
  const pending = {
    count: Number(pendingRow?.count ?? 0),
    points: Number(pendingRow?.points ?? 0),
  }

  const last24Res = await db.execute(sql`
    select status, count(*)::int as count, coalesce(sum(amount), 0)::bigint as points
    from point_holds
    where status in ('expired', 'settled', 'released')
      and settled_at >= now() - interval '24 hours'
    group by status
  `)
  const last24h: PointHoldHealth['last24h'] = {
    expired: { count: 0, points: 0 },
    settled: { count: 0, points: 0 },
    released: { count: 0, points: 0 },
  }
  for (const row of holdRows<{ status: string; count: number; points: number | string }>(
    last24Res,
  )) {
    if (row.status === 'expired' || row.status === 'settled' || row.status === 'released') {
      last24h[row.status] = { count: Number(row.count ?? 0), points: Number(row.points ?? 0) }
    }
  }

  const bySourceRes = await db.execute(sql`
    select source, status, count(*)::int as count, coalesce(sum(amount), 0)::bigint as points
    from point_holds
    where status in ('held', 'settle_pending')
       or (status in ('expired', 'settled', 'released')
           and settled_at >= now() - interval '24 hours')
    group by source, status
    order by count desc, source asc
    limit 40
  `)
  const bySource = holdRows<{
    source: string
    status: string
    count: number
    points: number | string
  }>(bySourceRes).map((row) => ({
    source: row.source,
    status: row.status,
    count: Number(row.count ?? 0),
    points: Number(row.points ?? 0),
  }))

  const mismatchRes = await db.execute(sql`
    with held as (
      select user_id, sum(amount)::bigint as points
      from point_holds
      where status in ('held', 'settle_pending')
      group by user_id
    )
    select count(*)::int as users,
           coalesce(sum(abs(p.reserved_points - coalesce(h.points, 0))), 0)::bigint as points
    from user_points p
    left join held h on h.user_id = p.user_id
    where p.reserved_points <> coalesce(h.points, 0)
  `)
  const mismatchRow = holdRows<{ users: number; points: number | string }>(mismatchRes)[0]
  const reservedMismatch = {
    users: Number(mismatchRow?.users ?? 0),
    points: Number(mismatchRow?.points ?? 0),
  }

  return {
    asOf: new Date().toISOString(),
    held: { count: heldCount, points: heldPoints, oldestAgeMinutes },
    pending,
    staleHeld,
    last24h,
    bySource,
    reservedMismatch,
  }
}
