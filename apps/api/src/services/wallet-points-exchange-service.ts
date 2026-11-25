// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钱包余额 → AI 积分兑换(2026-11-25 立)。
 *
 * 为什么需要这条桥:
 *   钱包(`user_margins.token_quantity`)与 AI 积分(`user_points.points`)长期是两本账;
 *   用户充值进钱包后,AI 对话却只扣积分,导致"充了钱用不了"的产品断层。
 *
 * 口径:
 *   `1 分钱 = 1 积分`。钱包余额本身按分记账,因此兑换是 1:1 转账,不另设汇率。
 *
 * 资金安全:
 *   - 事务内先 `SELECT ... FOR UPDATE` 锁钱包行,再查幂等流水、扣钱包、加积分;
 *   - `point_transactions(source='wallet_exchange', reference_id)` 有部分唯一索引,
 *     并发同 key 只会成功一次;
 *   - 钱包不足时抛 `INSUFFICIENT_WALLET_BALANCE`,不产生半截账。
 */
import { and, eq, gte, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { pointTransactions, tokenFlows, userMargins, userPoints } from '@ihui/database'
import { db } from '../db/index.js'
import { ensureMargin } from '../db/commission-queries.js'
import { ensureUserPoints } from '../db/gamification-queries.js'
import { availableOf } from './daily-credits.js'

export const WALLET_EXCHANGE_SOURCE = 'wallet_exchange'
/** 钱包兑换流水的 opType:7=兑换 AI 积分(从钱包扣出,不计入提现)。 */
export const WALLET_EXCHANGE_OP_TYPE = 7

export class WalletExchangeError extends Error {
  constructor(
    readonly code: 'INSUFFICIENT_WALLET_BALANCE' | 'POINTS_ROW_MISSING',
    message: string,
  ) {
    super(message)
    this.name = 'WalletExchangeError'
  }
}

export interface WalletExchangeResult {
  /** 本次实际兑换的积分数(= 扣掉的钱包分数) */
  points: number
  /** 兑换后的钱包余额(分) */
  walletBalance: number
  /** 兑换后的积分可用余额(永久 + 当日赠送) */
  pointsBalance: number
  /** 同一幂等键已兑换过,本次未重复扣款 */
  alreadyExchanged: boolean
}

/**
 * `token_flows` 的 orderOpUniq 是**全局**唯一索引(related_order_no, op_type),
 * 不能直接用客户端幂等键 —— 两个用户都传 "abc" 会互相顶掉。这里把 userId 混进
 * 哈希,既保留同用户同键幂等,又不会跨用户碰撞。
 */
function walletExchangeOrderNo(userId: string, referenceId: string): string {
  const digest = createHash('sha256').update(`${userId}:${referenceId}`).digest('hex').slice(0, 16)
  return `wallet_exchange:${digest}`
}

/**
 * 把钱包余额兑换成 AI 积分。
 *
 * @param userId 用户 id
 * @param amount 兑换积分/分数(正整数,1 分 = 1 积分)
 * @param idempotencyKey 幂等键(同一 key 只兑换一次),会拼成 `wallet_exchange:<key>`
 */
export async function exchangeWalletToPoints(
  userId: string,
  amount: number,
  idempotencyKey: string,
): Promise<WalletExchangeResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new WalletExchangeError('INSUFFICIENT_WALLET_BALANCE', '兑换积分必须为正整数')
  }
  const referenceId = `wallet_exchange:${idempotencyKey}`.slice(0, 64)

  await ensureMargin(userId)
  await ensureUserPoints(userId)

  return db.transaction(async (tx) => {
    // ① 行锁:同一用户的钱包兑换串行化,避免并发双扣/丢更新
    const [margin] = await tx
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .for('update')
    if (!margin) {
      throw new WalletExchangeError('INSUFFICIENT_WALLET_BALANCE', '钱包账户不存在')
    }

    // ② 幂等:同 key 已兑换过就直接返回,不再扣款
    const [existing] = await tx
      .select()
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.source, WALLET_EXCHANGE_SOURCE),
          eq(pointTransactions.referenceId, referenceId),
        ),
      )
      .limit(1)
    if (existing) {
      const [pointsRow] = await tx
        .select()
        .from(userPoints)
        .where(eq(userPoints.userId, userId))
        .limit(1)
      return {
        points: Math.abs(existing.amount),
        walletBalance: margin.tokenQuantity,
        pointsBalance: pointsRow ? availableOf(pointsRow) : 0,
        alreadyExchanged: true,
      }
    }

    // ③ 扣钱包:WHERE 带余额条件,DB 级防超扣
    if (margin.tokenQuantity < amount) {
      throw new WalletExchangeError(
        'INSUFFICIENT_WALLET_BALANCE',
        `钱包余额不足:当前 ${margin.tokenQuantity} 分,需 ${amount} 分`,
      )
    }
    const [updatedMargin] = await tx
      .update(userMargins)
      .set({
        tokenQuantity: sql`${userMargins.tokenQuantity} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userMargins.userId, userId), gte(userMargins.tokenQuantity, amount)))
      .returning()
    if (!updatedMargin) {
      throw new WalletExchangeError('INSUFFICIENT_WALLET_BALANCE', '钱包余额不足')
    }

    // ④ 加积分:这是账户间转账,不是"赚取",不碰 total_earned / experience
    const [pointsRow] = await tx
      .update(userPoints)
      .set({
        points: sql`${userPoints.points} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, userId))
      .returning()
    if (!pointsRow) {
      throw new WalletExchangeError('POINTS_ROW_MISSING', '积分账户不存在')
    }

    await tx.insert(pointTransactions).values({
      userId,
      type: 'transfer',
      source: WALLET_EXCHANGE_SOURCE,
      amount,
      balanceAfter: availableOf(pointsRow),
      description: '钱包余额兑换 AI 积分(1 分 = 1 积分)',
      referenceId,
    })

    await tx.insert(tokenFlows).values({
      userId,
      opType: WALLET_EXCHANGE_OP_TYPE,
      quantity: -amount,
      balanceAfter: updatedMargin.tokenQuantity,
      remark: '兑换 AI 积分',
      relatedOrderNo: walletExchangeOrderNo(userId, referenceId),
    })

    return {
      points: amount,
      walletBalance: updatedMargin.tokenQuantity,
      pointsBalance: availableOf(pointsRow),
      alreadyExchanged: false,
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
