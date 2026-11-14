// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 积分 ↔ AI 额度 兑换服务(2026-11-14 立)。
 *
 * 背景:积分体系(user_points / point_transactions)与 AI 计费(developer_api_keys 余额)
 * 长期是两套互不相通的账 —— 用户签到攒了积分只能换实物/课程,调用 AI 仍要另行充值。
 * 本服务定义唯一换算规则,把两条账打通:
 *
 * - 1 积分 = 1 分人民币 AI 额度(与项目既有「1 token = 1 cent」口径一致,不引入第二套汇率);
 * - 积分兑换后进 **钱包**(user_margins.token_quantity),再由既有
 *   rechargeApiKeyFromWallet 划转到 API Key,不直连 Key 余额(保留一层审计);
 * - 只做积分 → 额度单向兑换。AI 消耗**不返可消费积分**,只产出只读成长值:
 *   否则「充值 → 消费 → 返积分 → 再消费」形成闭环套利,积分会变成变相返现。
 *
 * 资金安全:
 * - 扣积分、加钱包、写 token_flows 三写在**同一事务**内,任一步失败整体回滚;
 * - requestId 幂等:point_transactions(reference_id) 先查重,token_flows
 *   (related_order_no, op_type) 唯一索引兜底;
 * - 兑换不可撤销(与充值一致),规则文案在接口里显式返回给前端展示。
 */

import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { pointTransactions, tokenFlows, userMargins } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { spendPoints } from './points-service.js'

/** 兑换规则(唯一常量出口,前端/文档都从这里取) */
export const POINTS_AI_CREDIT_RULE = {
  /** 多少积分换 1 分额度 */
  pointsPerCent: 1,
  /** 单次最少兑换积分 */
  minPoints: 100,
  /** 单次最多兑换积分 */
  maxPoints: 100_000,
  /** AI 消费成长值:每消费 1 元(100 分)获得多少成长值 */
  xpPerYuan: 1,
  /** 兑换流水的 source 标识 */
  source: 'redeem_ai_credit',
} as const

export interface PointsAiCreditRule {
  pointsPerCent: number
  minPoints: number
  maxPoints: number
  xpPerYuan: number
  unit: string
  description: string
}

export function getPointsAiCreditRule(): PointsAiCreditRule {
  return {
    pointsPerCent: POINTS_AI_CREDIT_RULE.pointsPerCent,
    minPoints: POINTS_AI_CREDIT_RULE.minPoints,
    maxPoints: POINTS_AI_CREDIT_RULE.maxPoints,
    xpPerYuan: POINTS_AI_CREDIT_RULE.xpPerYuan,
    unit: '积分 → 分(人民币 AI 额度)',
    description:
      `1 积分 = 0.01 元 AI 额度;单次 ${POINTS_AI_CREDIT_RULE.minPoints} 积分起兑、` +
      `上限 ${POINTS_AI_CREDIT_RULE.maxPoints} 积分。额度进入钱包,可在 API Key 管理里划转。兑换不可撤销。`,
  }
}

export interface RedeemAiCreditResult {
  /** true = 同一 requestId 重复提交,返回首次结果,未重复扣积分 */
  replayed: boolean
  /** 兑换后的积分余额 */
  points: number
  /** 本次入账额度(分) */
  creditCents: number
  /** 兑换后的钱包余额(分) */
  walletBalance: number
  requestId: string
}

function rowsOf<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[]
  const maybe = (r as { rows?: unknown[] }).rows
  return Array.isArray(maybe) ? (maybe as T[]) : []
}

function toFiniteNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 积分兑换 AI 额度。返回兑换后的积分余额与钱包余额。
 *
 * @throws statusCode=400 积分不足 / 参数越界
 */
export async function redeemPointsForAiCredit(args: {
  userId: string
  points: number
  requestId?: string
}): Promise<RedeemAiCreditResult> {
  const points = Math.trunc(Number(args.points))
  if (!Number.isFinite(points) || points <= 0) {
    throw Object.assign(new Error('兑换积分必须为正整数'), { statusCode: 400 })
  }
  if (points < POINTS_AI_CREDIT_RULE.minPoints) {
    throw Object.assign(
      new Error(`单次至少兑换 ${POINTS_AI_CREDIT_RULE.minPoints} 积分`),
      { statusCode: 400 },
    )
  }
  if (points > POINTS_AI_CREDIT_RULE.maxPoints) {
    throw Object.assign(
      new Error(`单次最多兑换 ${POINTS_AI_CREDIT_RULE.maxPoints} 积分`),
      { statusCode: 400 },
    )
  }
  const creditCents = points * POINTS_AI_CREDIT_RULE.pointsPerCent
  const rawRequestId = (args.requestId ?? '').trim() || randomUUID()
  const requestId = rawRequestId.slice(0, 64)

  return db.transaction(async (tx) => {
    // ① 幂等:同一 requestId 只兑换一次
    const dupRows = await tx
      .select({
        id: pointTransactions.id,
        balanceAfter: pointTransactions.balanceAfter,
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, args.userId),
          eq(pointTransactions.source, POINTS_AI_CREDIT_RULE.source),
          eq(pointTransactions.referenceId, requestId),
        ),
      )
      .limit(1)
    if (dupRows[0]) {
      const marginRows = await tx
        .select({ tokenQuantity: userMargins.tokenQuantity })
        .from(userMargins)
        .where(eq(userMargins.userId, args.userId))
        .limit(1)
      return {
        replayed: true,
        points: dupRows[0].balanceAfter,
        creditCents,
        walletBalance: marginRows[0]?.tokenQuantity ?? 0,
        requestId,
      }
    }

    // ② 钱包入账(不存在则建行,原子累加)
    await tx
      .insert(userMargins)
      .values({ userId: args.userId, tokenQuantity: 0, frozenQuantity: 0 })
      .onConflictDoNothing()
    const updatedRows = await tx
      .update(userMargins)
      .set({
        tokenQuantity: sql`${userMargins.tokenQuantity} + ${creditCents}`,
        updatedAt: new Date(),
      })
      .where(eq(userMargins.userId, args.userId))
      .returning({ tokenQuantity: userMargins.tokenQuantity })
    const updated = updatedRows[0]
    if (!updated) throw new Error('钱包入账失败')

    // ③ 扣积分(BALANCE 不足时抛错,事务整体回滚,不会出现"钱到了积分没扣")
    const spent = await spendPoints(
      args.userId,
      points,
      POINTS_AI_CREDIT_RULE.source,
      `积分兑换 AI 额度:${points} 积分 → ${creditCents} 分`,
      requestId,
      tx,
    )

    // ④ 钱包流水(opType=0 充值/入账,related_order_no 走既有唯一索引做第二道幂等)
    await tx.insert(tokenFlows).values({
      userId: args.userId,
      opType: 0,
      quantity: creditCents,
      balanceAfter: updated.tokenQuantity,
      remark: `积分兑换 AI 额度:${points} 积分 → ${creditCents} 分`,
      relatedOrderNo: `points-redeem:${requestId}`,
    })

    logger.info(
      `[points-ai-credit] 兑换成功 userId=${args.userId} points=${points} cents=${creditCents} wallet=${updated.tokenQuantity}`,
    )
    return {
      replayed: false,
      points: spent.points.points,
      creditCents,
      walletBalance: updated.tokenQuantity,
      requestId,
    }
  })
}

export interface AiSpendSummary {
  /** 成功/部分成功调用次数 */
  calls: number
  /** 累计实收金额(分) */
  spentCents: number
  /** 按规则折算的成长值(只读,不写入 user_points) */
  xpEarned: number
  rule: PointsAiCreditRule
}

/**
 * 用户 AI 消费摘要(只读)。
 *
 * 只读刻意:AI 消费若直接写 user_points.experience,会与签到/活动发的经验混在一个字段,
 * 既无法区分来源,也会被「充值-消费」刷成长值。成长值先只读展示,持久化方案(独立列
 * 或独立表)需要迁移与产品定价,单独立项再做。
 */
export async function getAiSpendSummary(userId: string): Promise<AiSpendSummary> {
  const res = await db.execute(sql`
    select
      count(*)::int as calls,
      coalesce(sum(cost_cents), 0)::numeric as spent_cents
    from llm_call_logs
    where user_id = ${userId}::uuid
      and status in ('success', 'partial')
  `)
  const row = rowsOf<Record<string, unknown>>(res)[0] ?? {}
  const spentCents = toFiniteNumber(row['spent_cents'])
  return {
    calls: toFiniteNumber(row['calls']),
    spentCents,
    xpEarned: Math.floor((spentCents / 100) * POINTS_AI_CREDIT_RULE.xpPerYuan),
    rule: getPointsAiCreditRule(),
  }
}
