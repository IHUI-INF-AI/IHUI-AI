/**
 * 订单业务服务。
 * 在 payment-queries（billing.orders）之上提供：下单、状态机转换（完成/取消）、查询。
 * 订单状态：pending(待支付) → paid(已支付) → cancelled(已取消) / refunded(已退款)。
 *
 * M-9：集成 Saga 分布式事务，编排"支付确认 + 积分发放 + Outbox 事件"多步骤流程。
 */

import {
  createOrder as createOrderRow,
  findOrderByNo,
  updateOrderStatus,
  queryPendingOrders,
  listPaidOrdersByDate,
  type CreateOrderInput,
} from '../db/payment-queries.js'
import type { Order } from '@ihui/database'
import type { FastifyInstance } from 'fastify'
import { executeSaga, type SagaResult } from './distributed-transaction.js'
import { earnPoints, spendPoints } from './points-service.js'
import { writeToOutbox } from '../utils/outbox.js'

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

/**
 * 支付 WS 实时通知事件类型（推送给前端，与 outbox 事件 'order.*' 分离）。
 * - payment.paid: 支付成功
 * - payment.failed: 支付失败
 * - payment.refunded: 退款完成
 */
export type PaymentEventType = 'payment.paid' | 'payment.failed' | 'payment.refunded'

export type PlaceOrderInput = CreateOrderInput

export interface OrderOperationResult {
  success: boolean
  order?: Order
  reason?: string
}

/** 下单：创建一笔 pending 订单。 */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  return createOrderRow(input)
}

/** 查询订单详情。 */
export async function getOrder(orderNo: string): Promise<Order | undefined> {
  return findOrderByNo(orderNo)
}

/**
 * 状态机：完成订单（支付成功回调调用）。
 * 仅 pending 订单可转为 paid；记录支付时间。
 */
export async function completeOrder(
  orderNo: string,
  _tradeNo?: string,
): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'pending')
    return { success: false, reason: `订单状态(${order.status})不可完成` }
  await updateOrderStatus(orderNo, 'paid')
  const updated = await findOrderByNo(orderNo)
  return { success: true, order: updated }
}

/** Saga 编排结果。 */
export interface SagaOrderResult extends OrderOperationResult {
  /** Saga 执行详情（含完成/补偿步骤） */
  saga?: SagaResult
}

/**
 * M-9：使用 Saga 分布式事务编排订单完成流程。
 *
 * 步骤编排：
 * 1. 支付确认：将订单标记为 paid（compensate: 回滚为 pending）
 * 2. 积分发放：按订单金额发放积分（compensate: 扣回已发积分）
 * 3. Outbox 事件：写入 order.paid 事件供下游消费（compensate: 写入 order.compensated 事件）
 *
 * 任一步骤失败时，executeSaga 会逆序执行已完成步骤的 compensate，
 * 保证最终一致性。积分按 1 元 = 1 积分计算（amount 单位为分，需除以 100）。
 *
 * @param orderNo 订单号
 * @param tradeNo 第三方交易号（可选，写入 outbox payload）
 * @param server Fastify 实例（可选，传入后支付成功时推送 WS payment.paid 通知）
 */
export async function completeOrderWithSaga(
  orderNo: string,
  tradeNo?: string,
  server?: FastifyInstance,
): Promise<SagaOrderResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'pending') {
    return { success: false, reason: `订单状态(${order.status})不可完成` }
  }

  // 积分计算：1 元 = 1 积分（amount 单位为分）
  const pointsToAward = Math.max(0, Math.floor(order.amount / 100))

  const saga = await executeSaga([
    {
      name: 'mark-order-paid',
      execute: async () => {
        await updateOrderStatus(orderNo, 'paid')
        return { orderNo, previousStatus: order.status }
      },
      compensate: async () => {
        // 回滚订单状态为 pending
        await updateOrderStatus(orderNo, 'pending')
      },
    },
    {
      name: 'award-points',
      execute: async () => {
        if (pointsToAward <= 0 || !order.userId) return { amount: 0 }
        const result = await earnPoints(
          order.userId,
          pointsToAward,
          'order_purchase',
          `订单 ${orderNo} 消费奖励`,
          orderNo,
        )
        return { amount: pointsToAward, transactionId: result.transaction.id }
      },
      compensate: async (result) => {
        const r = result as { amount: number; transactionId?: string }
        if (r.amount <= 0) return
        if (!order.userId) return
        // 扣回已发积分
        await spendPoints(
          order.userId,
          r.amount,
          'order_compensate',
          `订单 ${orderNo} 补偿扣回积分`,
          orderNo,
        )
      },
    },
    {
      name: 'write-outbox-event',
      execute: async () => {
        await writeToOutbox({
          type: 'order.paid',
          payload: {
            orderNo,
            userId: order.userId,
            amount: order.amount,
            orderType: order.orderType,
            tradeNo,
            paidAt: new Date().toISOString(),
          },
        })
        return { written: true }
      },
      compensate: async () => {
        // 补偿：写入补偿事件，通知下游撤销
        await writeToOutbox({
          type: 'order.compensated',
          payload: { orderNo, userId: order.userId, reason: 'saga_rollback' },
        })
      },
    },
  ])

  if (!saga.success) {
    return {
      success: false,
      reason: `订单完成流程失败: ${saga.error ?? 'unknown'}`,
      saga,
    }
  }

  // WS 实时通知：outbox 'order.paid' 已写入，推送 WS 'payment.paid' 给用户所有在线端
  if (server) {
    try {
      if (order.userId) server.pushNotification(order.userId, {
        type: 'payment.paid' satisfies PaymentEventType,
        orderNo,
        amount: order.amount,
        orderType: order.orderType,
        tradeNo,
        paidAt: new Date().toISOString(),
      })
    } catch {
      /* 推送失败不阻塞订单完成 */
    }
  }

  const updated = await findOrderByNo(orderNo)
  return { success: true, order: updated, saga }
}

/**
 * 根据订单类型激活对应的订阅（支付成功回调调用，失败不阻塞）。
 * - orderType=2: VIP 会员激活
 * - orderType=5: 开发者套餐订阅激活
 */
export async function activateOrderSubscription(order: Order): Promise<void> {
  if (!order.productId) return
  if (!order.userId) return
  if (order.orderType === 2) {
    const { purchaseVip } = await import('../db/vip-queries.js')
    await purchaseVip({ userId: order.userId, vipLevelId: order.productId, orderId: order.id })
  } else if (order.orderType === 5) {
    const { findDeveloperPricingById, activateDeveloperSubscription } =
      await import('../db/developer-queries.js')
    const pricing = await findDeveloperPricingById(order.productId)
    if (!pricing) return
    await activateDeveloperSubscription({
      userId: order.userId,
      pricingId: pricing.id,
      period: pricing.period ?? 'monthly',
      orderId: order.id,
    })
  }
}

/**
 * 状态机：取消订单。
 * 仅 pending 订单可取消；已支付订单需走退款流程。
 */
export async function cancelOrder(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'pending')
    return { success: false, reason: `订单状态(${order.status})不可取消` }
  await updateOrderStatus(orderNo, 'cancelled')
  const updated = await findOrderByNo(orderNo)
  return { success: true, order: updated }
}

/**
 * 状态机：退款完成（由退款流程调用）。
 */
export async function refundOrder(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'paid')
    return { success: false, reason: `订单状态(${order.status})不可退款` }
  await updateOrderStatus(orderNo, 'refunded')
  const updated = await findOrderByNo(orderNo)
  return { success: true, order: updated }
}

/** 查询超时未支付订单（默认 30 分钟）。供对账/定时关单使用。 */
export async function findExpiredOrders(): Promise<Order[]> {
  return queryPendingOrders()
}

/** 查询某日已支付订单（对账用）。 */
export async function findPaidOrdersByDate(billDate: string): Promise<Order[]> {
  return listPaidOrdersByDate(billDate)
}
