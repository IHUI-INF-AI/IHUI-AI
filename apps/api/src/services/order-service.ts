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
import { logger } from '../utils/logger.js'
import { writeToOutbox } from '../utils/outbox.js'
import { rechargeToken, deductToken, refundTokenDeduct } from '../db/commission-queries.js'

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

/** 下单：创建一笔 pending 订单。系统调用 operatorId 传 null(由上层 route 显式调用 createOrder 时传 userId 即可)。 */
export async function placeOrder(
  input: PlaceOrderInput,
  operatorId: string | null = null,
): Promise<Order> {
  return createOrderRow(input, operatorId)
}

/** 查询订单详情。 */
export async function getOrder(orderNo: string): Promise<Order | undefined> {
  return findOrderByNo(orderNo)
}

/**
 * 状态机：完成订单（支付成功回调调用）。
 * 仅 pending 订单可转为 paid；记录支付时间。
 *
 * 2026-08-02 P0 修复(B1+B3):
 * - B3: 条件 UPDATE pending→paid,并发回调只有一个成功;已支付订单返回幂等成功。
 * - B1: token 充值订单(orderType=2)/活动订单(orderType=3)支付成功后调用 rechargeToken 加 token。
 */
export async function completeOrder(
  orderNo: string,
  _tradeNo?: string,
): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status === 'pending') {
    // B3: 条件 UPDATE,返回 undefined 表示状态不匹配(并发竞态)
    const updated = await updateOrderStatus(orderNo, 'paid', 'pending')
    if (!updated) {
      // 竞态:另一并发回调刚把订单标记为 paid,重新查询走幂等路径
      const refetched = await findOrderByNo(orderNo)
      if (refetched && refetched.status === 'paid') {
        await rechargeIfTokenOrder(refetched)
        return { success: true, order: refetched }
      }
      return { success: false, reason: '订单状态不可完成' }
    }
    // B1: token 充值(幂等:rechargeToken 内部 unique 索引拦截重复回调)
    await rechargeIfTokenOrder(updated)
    return { success: true, order: updated }
  }
  if (order.status === 'paid') {
    // 幂等重试:订单已支付,重新尝试 token 充值(unique 索引保证幂等)
    await rechargeIfTokenOrder(order)
    return { success: true, order }
  }
  return { success: false, reason: `订单状态(${order.status})不可完成` }
}

/**
 * B1: token 充值订单(orderType=2) / 活动订单(orderType=3)支付成功后给用户加 token。
 * rechargeToken 内部 (related_order_no, op_type) unique 索引拦截重复回调(23505→返回当前余额)。
 * 失败时抛出,由调用方(支付回调)触发 paymentIdempotency.fail 释放锁让平台重试。
 */
async function rechargeIfTokenOrder(order: Order): Promise<void> {
  if ((order.orderType === 2 || order.orderType === 3) && order.userId) {
    await rechargeToken(order.userId, order.amount, order.orderNo, '充值')
  }
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
 * 2. B1 token 充值：token 充值订单/活动订单加 token（compensate: 扣回已充 token）
 * 3. 积分发放：按订单金额发放积分（compensate: 扣回已发积分）
 * 4. Outbox 事件：写入 order.paid 事件供下游消费（compensate: 写入 order.compensated 事件）
 *
 * 任一步骤失败时，executeSaga 会逆序执行已完成步骤的 compensate，
 * 保证最终一致性。积分按 1 元 = 1 积分计算（amount 单位为分，需除以 100）。
 *
 * 2026-08-02 P0 修复(B1+B3):
 * - B3: mark-order-paid 改条件 UPDATE pending→paid,并发回调只有一个进入 saga;
 *       已支付订单(并发/重试)返回幂等成功,让副作用可被重试。
 * - B1: 新增 recharge-tokens saga 步骤,token 充值订单/活动订单支付成功后加 token。
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
  // B3: 订单已支付(并发回调/重试),返回幂等成功,让副作用(订阅激活/返佣)可被重试
  if (order.status === 'paid') {
    return {
      success: true,
      order,
      saga: { success: true, completedSteps: [], compensatedSteps: [] },
    }
  }
  if (order.status !== 'pending') {
    return { success: false, reason: `订单状态(${order.status})不可完成` }
  }

  // 积分计算：1 元 = 1 积分（amount 单位为分）
  const pointsToAward = Math.max(0, Math.floor(order.amount / 100))

  const saga = await executeSaga([
    {
      name: 'mark-order-paid',
      execute: async () => {
        // B3: 条件 UPDATE pending→paid,返回 undefined 表示状态不匹配(并发竞态)
        const updated = await updateOrderStatus(orderNo, 'paid', 'pending')
        if (!updated) {
          // 另一并发回调已将订单标记为 paid,抛出以中止 saga(第一步,无需补偿)
          throw new Error('ORDER_ALREADY_PAID')
        }
        return { orderNo, previousStatus: order.status }
      },
      compensate: async () => {
        // 仅当当前状态为 paid 时才回滚(条件 UPDATE,防止误改已补偿的状态)
        await updateOrderStatus(orderNo, 'pending', 'paid')
      },
    },
    {
      name: 'recharge-tokens',
      execute: async () => {
        // B1: token 充值订单(orderType=2)/活动订单(orderType=3)支付成功后加 token
        // rechargeToken 内部 (related_order_no, op_type) unique 索引保证幂等
        if (order.orderType === 2 || order.orderType === 3) {
          if (!order.userId) return { amount: 0, orderNo }
          await rechargeToken(order.userId, order.amount, orderNo, '充值')
          return { amount: order.amount, orderNo }
        }
        return { amount: 0, orderNo }
      },
      compensate: async (result) => {
        const r = result as { amount: number; orderNo: string }
        if (r.amount <= 0 || !order.userId) return
        // 补偿:扣回已充值的 token(余额不足时 best-effort,不阻塞回滚流程)
        try {
          await deductToken(order.userId, r.amount, `订单 ${orderNo} saga 补偿扣回 token`)
        } catch (e) {
          logger.error(`[saga] recharge-tokens compensate failed`, { err: e, orderNo })
        }
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
      if (order.userId)
        server.pushNotification(order.userId, {
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
    // P0-2b: 订阅激活后自动应用 VIP 等级配额(upsert aiBudgets)
    try {
      const { applyPlanEntitlements } = await import('./plan-entitlement-service.js')
      await applyPlanEntitlements(order.userId, order.productId)
    } catch (e) {
      // 配额应用失败不阻塞订阅激活(降级:用户保留旧配额或免费档默认值)
      logger.warn('plan entitlement apply failed', { err: e, orderNo: order.orderNo })
    }
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
 *
 * 2026-08-02 P0 修复(B2):退款时退还 token 余额(token 充值订单/活动订单)。
 * 2026-08-05 P0-2 修复:原实现用 rechargeToken 退款=再发一次 token(钱退+token 再入账)。
 * 改为 refundTokenDeduct 尽力扣回 —— 事务内行锁 + (refund:orderNo, opType=3) 幂等键,
 * 余额不足扣到 0,重复退款被 unique 索引拦截。
 */
export async function refundOrder(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'paid')
    return { success: false, reason: `订单状态(${order.status})不可退款` }
  await updateOrderStatus(orderNo, 'refunded')
  // B2: 退款时扣回 token 余额(token 充值订单/活动订单)
  if ((order.orderType === 2 || order.orderType === 3) && order.userId) {
    try {
      await refundTokenDeduct(order.userId, order.amount, orderNo, '退款')
    } catch (e) {
      // 退还 token 失败不阻塞订单状态变更,需运营监控告警人工处理
      logger.error(`[refundOrder] refund token deduct failed`, { err: e, orderNo })
    }
  }
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
