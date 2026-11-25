// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, sql } from 'drizzle-orm'
import { pointTransactions, userPoints, type UserPoints, type PointTransaction } from '@ihui/database'
import { db } from '../db/index.js'
import { ensureDailyCreditRow, adjustPoints, type DbTx } from '../db/gamification-queries.js'
import { availableOf } from './daily-credits.js'

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

export interface SettlePointsUsageInput {
  userId: string
  /** 本次应扣积分(整数,>=0) */
  amount: number
  /** 流水来源,例如 llm_chat / crew_llm / stock_analysis */
  source: string
  description?: string
  /** 幂等键:同一用户、同一来源、同一引用只结算一次 */
  referenceId?: string
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
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, input.userId))
      .limit(1)
      .for('update')
    if (!account) throw new Error('积分账户不存在')

    const availableBefore = availableOf(account)
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
        return {
          deducted: Math.abs(existing.amount),
          remaining: availableBefore,
          shortfall: 0,
          alreadySettled: true,
        }
      }
    }

    if (amount <= 0 || availableBefore <= 0) {
      return { deducted: 0, remaining: availableBefore, shortfall: amount, alreadySettled: false }
    }

    const deducted = Math.min(availableBefore, amount)
    const shortfall = amount - deducted
    const dailyDeduct = Math.min(Math.max(0, account.dailyPoints), deducted)
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
