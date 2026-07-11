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

import { eq, sql, and, notExists } from 'drizzle-orm'
import { db } from '../db/index.js'
import { orders, commissionFlows } from '@ihui/database'
import { createCommissionFlows, type OrderLike, type UserLike } from './commission-service.js'

export interface CommissionSettleResult {
  scanned: number
  missedOrders: number
  createdFlows: number
  errors: string[]
}

export async function calibrateCommissionSettlement(): Promise<CommissionSettleResult> {
  const errors: string[] = []

  // 1. 查询已支付订单中未生成佣金流水的记录
  //    通过 NOT EXISTS 子查询检测 commission_flows 表中是否有对应 order_id
  const paidOrdersWithoutCommission = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      amount: orders.amount,
      orderType: orders.orderType,
      productId: orders.productId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'paid'),
        notExists(
          sql`SELECT 1 FROM ${commissionFlows} WHERE ${commissionFlows.orderId} = ${orders.id}`,
        ),
      ),
    )
    .limit(100) // 每次最多处理100条，避免单次执行时间过长

  const scanned = paidOrdersWithoutCommission.length

  if (scanned === 0) {
    return { scanned: 0, missedOrders: 0, createdFlows: 0, errors: [] }
  }

  // 2. 对遗漏订单补建佣金流水
  let createdFlows = 0
  for (const order of paidOrdersWithoutCommission) {
    try {
      // 构造 UserLike 和 OrderLike 对象
      // tokenQuantity 是可选字段，commission-service 内部会在需要时从其他表获取
      const userLike: UserLike = { id: order.userId }
      const orderLike: OrderLike = {
        id: order.id,
        amount: Number(order.amount),
        orderType: order.orderType,
        productId: order.productId,
      }

      // 调用已有的佣金创建逻辑
      const created = await createCommissionFlows(userLike, orderLike)
      createdFlows += created
    } catch (err) {
      // createCommissionFlows 内部可能因订单无邀请关系而跳过，这是正常行为
      const errMsg = String(err)
      if (!errMsg.includes('no invite') && !errMsg.includes('no parent')) {
        errors.push(`Failed to create commission for order ${order.id}: ${errMsg}`)
      }
    }
  }

  return {
    scanned,
    missedOrders: scanned,
    createdFlows,
    errors,
  }
}
