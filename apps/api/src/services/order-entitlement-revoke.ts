// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-371:退款回收该订单已发放的权益(VIP / 开发者订阅 / API 订阅配额)。
 *
 * 退款原先只冲订单金额(充值单)并把订单置 refunded,VIP 卡、开发者订阅、
 * API 订阅配额一律留在用户账上 —— 付款后可退款且保留权益(白拿)。
 *
 * 本模块只做「按订单撤销已发放权益」的补偿步骤,不另建账务:
 * - VIP(orderType=2 且有 productId):取消该订单发出的 user_vips 卡(status→2),
 *   降级判据复用 F-248 的 `planVipCancelDowngrade`;用户已无其它有效卡时 users.isVip→0,
 *   并把 aiBudgets 复位到免费档(免费档取值复用 `getEntitlementsByLevelValue(0)`)。
 * - 开发者订阅(orderType=5):该订单的 developer_subscriptions.status→0(与取消订阅入口一致)。
 * - API 订阅(orderType=6):按发放流水(related_order_no=orderNo, op_type=6)的 quantity
 *   扣回 developer_api_keys.token_balance,写 `refund:${orderNo}` 冲减流水,
 *   并把该订单的 api_subscriptions 置 cancelled。
 * - 没有发放记录时一律跳过(未发放的权益不得误扣)。
 *
 * 幂等 / 原子性:
 * - 所有状态写入都是条件 UPDATE(status=1 / status='active' / token_balance 判据),0 行 = 已回收;
 * - API 配额冲减先查 `refund:${orderNo}` + op_type=6 冲减流水,已存在即视为回收过;
 * - 本函数由调用方放进「订单置 refunded」的同一事务,任一步失败整体回滚,不留半状态。
 */
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm'
import type { Order } from '@ihui/database'
import {
  aiBudgets,
  apiSubscriptions,
  auditLogs,
  developerApiKeys,
  developerSubscriptions,
  tokenFlows,
  users,
  userVips,
} from '@ihui/database'
import { planVipCancelDowngrade } from '../db/vip-queries.js'
import type { DbTx } from '../db/payment-queries.js'
import { getEntitlementsByLevelValue } from './plan-entitlement-service.js'
import { logger } from '../utils/logger.js'

/** token_flows.op_type=6:API 订阅配额(见 schema/wallet.ts 的单位说明) */
const API_QUOTA_OP_TYPE = 6

export interface RevokeOrderEntitlementsResult {
  /** 本次是否取消了该订单的 VIP 卡 */
  vip: boolean
  /** 本次是否把 users.isVip 降回免费档 */
  vipDowngraded: boolean
  /** 本次是否取消了该订单的开发者订阅 */
  developerSubscription: boolean
  /** 本次是否取消了该订单的 API 订阅实例 */
  apiSubscription: boolean
  /** API 配额扣回量;-1 = 回收无限额度,0 = 未扣 */
  quotaRevoked: number
}

function emptyResult(): RevokeOrderEntitlementsResult {
  return {
    vip: false,
    vipDowngraded: false,
    developerSubscription: false,
    apiSubscription: false,
    quotaRevoked: 0,
  }
}

/**
 * 按订单撤销已发放权益。必须在调用方的事务内执行,且不会抛「未发放」类错误。
 */
export async function revokeOrderEntitlements(
  order: Order,
  tx: DbTx,
): Promise<RevokeOrderEntitlementsResult> {
  const result = emptyResult()
  // 无归属用户的订单没有权益可回收
  if (!order.userId) return result
  const now = new Date()

  if (order.orderType === 2 && order.productId) {
    await revokeVipCard(order, tx, now, result)
  } else if (order.orderType === 5) {
    await revokeDeveloperSubscription(order, tx, now, result)
  } else if (order.orderType === 6) {
    await revokeApiSubscription(order, tx, now, result)
  }

  if (
    result.vip ||
    result.developerSubscription ||
    result.apiSubscription ||
    result.quotaRevoked !== 0
  ) {
    await tx.insert(auditLogs).values({
      userId: order.userId,
      action: 'order.refund.revoke',
      resourceType: 'order',
      resourceId: order.orderNo,
      details: { ...result },
    })
    logger.info('[refund] 已回收订单权益', {
      orderNo: order.orderNo,
      orderType: order.orderType,
      ...result,
    })
  }
  return result
}

/** VIP:取消该订单发出的卡,并在用户已无其它有效卡时降级 + 复位配额。 */
async function revokeVipCard(
  order: Order,
  tx: DbTx,
  now: Date,
  result: RevokeOrderEntitlementsResult,
): Promise<void> {
  const [card] = await tx
    .select({ id: userVips.id, userId: userVips.userId, status: userVips.status })
    .from(userVips)
    .where(eq(userVips.orderId, order.id))
    .limit(1)
  // 未发卡(如未走完激活)→ 不误扣
  if (!card) return

  const [others] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(userVips)
    .where(
      and(
        eq(userVips.userId, card.userId),
        ne(userVips.id, card.id),
        eq(userVips.status, 1),
        gt(userVips.endTime, now),
      ),
    )
  // 降级判据与 F-248 取消 VIP 同源,不另写一份
  const plan = planVipCancelDowngrade(card, Number(others?.count ?? 0))
  if (plan.hits === 0) return

  const cancelled = await tx
    .update(userVips)
    .set({ status: 2, updatedAt: now })
    .where(and(eq(userVips.id, card.id), eq(userVips.status, 1)))
    .returning({ id: userVips.id })
  if (cancelled.length === 0) return
  result.vip = true

  if (!plan.downgrade) return
  await tx
    .update(users)
    .set({ isVip: 0 })
    .where(eq(users.id, card.userId))
    .returning({ id: users.id })
  result.vipDowngraded = true

  // 激活时 applyPlanEntitlements 写入了 VIP 档配额;失去 VIP 后必须复位免费档,
  // 否则退款用户仍按会员档消耗预算(免费档取值只认 plan-entitlement-service 一处)。
  const free = await getEntitlementsByLevelValue(0)
  await tx
    .update(aiBudgets)
    .set({
      dailyTokenLimit: free.aiBudgetDefaults.dailyTokenLimit,
      monthlyTokenLimit: free.aiBudgetDefaults.monthlyTokenLimit,
      dailyCostLimit: free.aiBudgetDefaults.dailyCostLimit,
      monthlyCostLimit: free.aiBudgetDefaults.monthlyCostLimit,
      updatedAt: now,
    })
    .where(and(eq(aiBudgets.scope, 'user'), eq(aiBudgets.scopeKey, card.userId)))
    .returning({ id: aiBudgets.id })
}

/** 开发者套餐订阅:该订单的订阅置为取消(与 developer-routes 取消入口同语义)。 */
async function revokeDeveloperSubscription(
  order: Order,
  tx: DbTx,
  now: Date,
  result: RevokeOrderEntitlementsResult,
): Promise<void> {
  const rows = await tx
    .update(developerSubscriptions)
    .set({ status: 0, updatedAt: now })
    .where(and(eq(developerSubscriptions.orderId, order.id), eq(developerSubscriptions.status, 1)))
    .returning({ id: developerSubscriptions.id })
  result.developerSubscription = rows.length > 0
}

/** API 订阅:按发放流水扣回 Key 配额 + 取消订阅实例 + 写冲减流水。 */
async function revokeApiSubscription(
  order: Order,
  tx: DbTx,
  now: Date,
  result: RevokeOrderEntitlementsResult,
): Promise<void> {
  // 幂等:已有冲减流水即视为回收过(唯一索引 (related_order_no, op_type) 同键)
  const [alreadyRevoked] = await tx
    .select({ id: tokenFlows.id })
    .from(tokenFlows)
    .where(
      and(
        eq(tokenFlows.relatedOrderNo, `refund:${order.orderNo}`),
        eq(tokenFlows.opType, API_QUOTA_OP_TYPE),
      ),
    )
    .limit(1)
  if (alreadyRevoked) return

  // 发放流水 = 该订单实际发放量;没有流水说明从未发放(未走完激活)→ 不误扣
  const [grant] = await tx
    .select({ quantity: tokenFlows.quantity })
    .from(tokenFlows)
    .where(
      and(eq(tokenFlows.relatedOrderNo, order.orderNo), eq(tokenFlows.opType, API_QUOTA_OP_TYPE)),
    )
    .limit(1)
  if (!grant) return

  const issued = Number(grant.quantity)
  if (!Number.isFinite(issued)) return

  // 取消该订单的订阅实例(窗口型限额随之失效)
  const cancelledSubs = await tx
    .update(apiSubscriptions)
    .set({ status: 'cancelled', updatedAt: now })
    .where(and(eq(apiSubscriptions.orderNo, order.orderNo), eq(apiSubscriptions.status, 'active')))
    .returning({ id: apiSubscriptions.id })
  result.apiSubscription = cancelledSubs.length > 0

  // Key 选取与激活侧同一判据(status=active,lastUsedAt desc,createdAt desc),
  // FOR UPDATE 串行化同一 Key 的并发退款扣回。
  const [key] = await tx
    .select({ id: developerApiKeys.id, tokenBalance: developerApiKeys.tokenBalance })
    .from(developerApiKeys)
    .where(and(eq(developerApiKeys.userId, order.userId!), eq(developerApiKeys.status, 'active')))
    .orderBy(desc(developerApiKeys.lastUsedAt), desc(developerApiKeys.createdAt))
    .limit(1)
    .for('update')
  if (!key) return

  const current = Number(key.tokenBalance)
  let balanceAfter = current
  let quotaRevoked = 0

  if (issued === -1) {
    // 无限额度无法按数量扣回:仅当用户已无其它生效订阅时把无限余额收回到 0
    const [otherSub] = await tx
      .select({ id: apiSubscriptions.id })
      .from(apiSubscriptions)
      .where(
        and(
          eq(apiSubscriptions.userId, order.userId!),
          eq(apiSubscriptions.status, 'active'),
          ne(apiSubscriptions.orderNo, order.orderNo),
        ),
      )
      .limit(1)
    if (!otherSub && current === -1) {
      const [updated] = await tx
        .update(developerApiKeys)
        .set({ tokenBalance: 0, updatedAt: now })
        .where(and(eq(developerApiKeys.id, key.id), eq(developerApiKeys.tokenBalance, -1)))
        .returning({ tokenBalance: developerApiKeys.tokenBalance })
      if (updated) {
        quotaRevoked = -1
        balanceAfter = 0
      }
    }
  } else if (issued > 0) {
    // 已无限(-1)的 Key 保持无限:该无限额度来自其它订阅,不能按本次有限发放扣回
    quotaRevoked = current === -1 ? 0 : Math.min(Math.max(current, 0), issued)
    if (quotaRevoked > 0) {
      const [updated] = await tx
        .update(developerApiKeys)
        .set({
          tokenBalance: sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 ELSE GREATEST(${developerApiKeys.tokenBalance} - ${issued}, 0) END`,
          updatedAt: now,
        })
        .where(eq(developerApiKeys.id, key.id))
        .returning({ tokenBalance: developerApiKeys.tokenBalance })
      balanceAfter = updated ? Number(updated.tokenBalance) : current - quotaRevoked
    }
  }

  // 留痕:冲减流水(quantity 为负数或 0,balanceAfter 写落库后的真实配额)
  result.quotaRevoked = quotaRevoked
  await tx
    .insert(tokenFlows)
    .values({
      userId: order.userId!,
      opType: API_QUOTA_OP_TYPE,
      quantity: quotaRevoked === -1 ? -1 : -quotaRevoked,
      balanceAfter,
      remark: `退款回收 API 订阅配额:${order.orderNo}`,
      relatedOrderNo: `refund:${order.orderNo}`,
    })
    .onConflictDoNothing({ target: [tokenFlows.relatedOrderNo, tokenFlows.opType] })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
