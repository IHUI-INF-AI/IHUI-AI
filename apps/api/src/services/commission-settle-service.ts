// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 佣金结算校准服务（backing service for commission-settle-daily 定时任务）。
 * 迁移自旧架构 ai-smart-society-java/ruoyi-modules/ruoyi-job/CommissionFlowTask.java (M-86)。
 *
 * 旧架构使用 Java Quartz 定时批量计算佣金并生成流水。
 * 新架构已改为事件驱动模式（支付成功时实时触发 feedbackInvite()），实时性更优。
 * 但事件驱动可能因异常遗漏某些订单，本任务作为"兜底"校准机制：
 * 1. 查询已支付但未生成佣金的订单
 * 2. 对遗漏订单调用佣金创建逻辑补建流水
 *
 * 设计参考 expiration-monitor-service.ts 的模式。
 */

import { eq, sql, and, notExists, gte, asc, isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { orders, commissionFlows, users } from '@ihui/database'
import { createCommissionFlows, type OrderLike, type UserLike } from './commission-service.js'
import { getBalance } from '../db/commission-queries.js'

export interface CommissionSettleResult {
  scanned: number
  missedOrders: number
  createdFlows: number
  errors: string[]
}

/**
 * F-234:兜底校准的回看窗口(天)与单批上限。
 *
 * 原查询 `WHERE status='paid' AND NOT EXISTS(...) LIMIT 100` 既无排序也无时间下界。
 * 无推荐人(parent_id IS NULL)的订单永远不会产生佣金流水 ⇒ `NOT EXISTS` 恒真,
 * 这些「永不返佣」的行按任意物理顺序反复命中,LIMIT 100 窗口被永久占满,
 * 真实漏单反而进不来(兜底机制静默失效)。
 *
 * 现改为只校准「窗口内 + 确有上级」的订单,并按 (created_at, id) 升序确定性取前 N:
 * 窗口内的行处理完要么生成流水(退出 NOT EXISTS)、要么因无比例/无 token 等原因留在窗口,
 * 但有时间下界保证它们最多占用窗口 BACKFILL_LOOKBACK_DAYS 天,不会永久占位。
 */
const BACKFILL_LOOKBACK_DAYS = 90
const BACKFILL_BATCH_SIZE = 100

export async function calibrateCommissionSettlement(): Promise<CommissionSettleResult> {
  const errors: string[] = []
  const windowStart = new Date(Date.now() - BACKFILL_LOOKBACK_DAYS * 86400_000)

  // 1. 查询已支付订单中未生成佣金流水的记录
  //    通过 NOT EXISTS 子查询检测 commission_flows 表中是否有对应 order_id;
  //    INNER JOIN users 过滤 parent_id IS NULL —— 无上级的订单不可能返佣,不得占用窗口。
  const paidOrdersWithoutCommission = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      amount: orders.amount,
      orderType: orders.orderType,
      productId: orders.productId,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, windowStart),
        isNotNull(users.parentId),
        notExists(
          sql`SELECT 1 FROM ${commissionFlows} WHERE ${commissionFlows.orderId} = ${orders.id}`,
        ),
      ),
    )
    .orderBy(asc(orders.createdAt), asc(orders.id))
    .limit(BACKFILL_BATCH_SIZE) // 每次最多处理100条，避免单次执行时间过长

  const scanned = paidOrdersWithoutCommission.length

  if (scanned === 0) {
    return { scanned: 0, missedOrders: 0, createdFlows: 0, errors: [] }
  }

  // 2. 对遗漏订单补建佣金流水
  let createdFlows = 0
  let missedOrders = 0
  for (const order of paidOrdersWithoutCommission) {
    try {
      // 构造 UserLike 和 OrderLike 对象
      // G5: orders.userId 改为 nullable(SET NULL),无 userId 的订单跳过佣金结算
      if (!order.userId) continue
      // F-409: 与支付回调实时链路同口径,tokenQuantity 必须显式回填,
      // 否则 calcReturnToken(user.tokenQuantity ?? 0) 恒为 0,普通上级 token 佣金永不补建
      const userLike: UserLike = {
        id: order.userId,
        tokenQuantity: await getBalance(order.userId),
      }
      const orderLike: OrderLike = {
        id: order.id,
        amount: Number(order.amount),
        orderType: order.orderType,
        productId: order.productId,
      }

      // 调用已有的佣金创建逻辑
      const created = await createCommissionFlows(userLike, orderLike)
      if (created > 0) missedOrders++
      createdFlows += created
    } catch (err) {
      // createCommissionFlows 内部可能因订单无邀请关系而跳过，这是正常行为
      const errMsg = String(err)
      if (!errMsg.includes('no invite') && !errMsg.includes('no parent')) {
        errors.push(`Failed to create commission for order ${order.id}: ${errMsg}`)
      }
    }
  }

  // F-409: missedOrders 记真实补建到的订单数,不再用扫描数冒充补建数
  return {
    scanned,
    missedOrders,
    createdFlows,
    errors,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
