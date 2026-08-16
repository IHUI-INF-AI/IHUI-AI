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
import { db } from '../db/index.js'
import { eq, and, sql } from 'drizzle-orm'
import { outboxEvents, pointTransactions } from '@ihui/database'
import { calculateTopupBonus } from './topup-discount-service.js'

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
    // Phase 4: updateOrderStatus 内部已事务同步 eduOrders，无需额外同步
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
    // P2-20(2026-08-06):充值赠送接线 —— 主充值到账后再发放赠送 token
    await creditTopupBonus(order)
  }
}

/**
 * P2-20 修复(2026-08-06):充值赠送接线 —— token 充值订单(orderType=2)支付成功后,
 * 按 calculateTopupBonus 的阶梯赠送规则额外发放赠送 token。
 * - 赠送额度 = actualCredit - 实付金额(元),折算为分(token 单位)入账;
 * - 赠送流水以 related_order_no = `bonus:${orderNo}` 作为幂等键 —— rechargeToken 的
 *   (related_order_no, op_type) unique 索引拦截重复回调/重放,与主充值键(orderNo)区分;
 * - remark 标注"充值赠送",方便对账与用户侧展示。
 * 未命中赠送档位(actualCredit===实付)时返回 0 不产生流水。
 * @returns 实际赠送的 token 数量(分);无赠送或非 token 充值订单返回 0。
 */
async function creditTopupBonus(order: Order): Promise<number> {
  if (order.orderType !== 2 || !order.userId) return 0
  const amountYuan = order.amount / 100
  const { actualCredit } = await calculateTopupBonus(amountYuan, order.paymentMethod ?? '')
  const bonusCents = Math.round((actualCredit - amountYuan) * 100)
  if (bonusCents <= 0) return 0
  await rechargeToken(order.userId, bonusCents, `bonus:${order.orderNo}`, '充值赠送')
  return bonusCents
}

/**
 * P1-5(2026-08-06):已支付订单副作用重放 —— 崩溃窗口恢复/重试时补执行。
 * 各步骤幂等,可安全重复调用:
 * 1. token 充值:rechargeToken 内部 (related_order_no, op_type) unique 索引拦截重复;
 * 2. 积分发放:先查 point_transactions 是否已有 referenceId=orderNo 的 earn 流水,有则跳过;
 * 3. Outbox:先查 order.paid 事件是否已存在(按 payload->>'orderNo' 匹配),有则跳过。
 * 任一步失败抛出,由 paymentIdempotency 失败分支释放锁,让回调平台重试。
 */
async function replayPaidSideEffects(order: Order, tradeNo?: string): Promise<void> {
  // ① token 充值(幂等:unique 索引)
  await rechargeIfTokenOrder(order)

  // ② 积分发放(幂等:referenceId 查重)
  const pointsToAward = Math.max(0, Math.floor(order.amount / 100))
  if (pointsToAward > 0 && order.userId) {
    const earned = await db
      .select({ id: pointTransactions.id })
      .from(pointTransactions)
      .where(
        and(eq(pointTransactions.referenceId, order.orderNo), eq(pointTransactions.type, 'earn')),
      )
      .limit(1)
    if (!earned[0]) {
      await earnPoints(
        order.userId,
        pointsToAward,
        'order_purchase',
        `订单 ${order.orderNo} 消费奖励`,
        order.orderNo,
      )
    }
  }

  // ③ Outbox 事件(幂等:同 orderNo 的 order.paid 已存在则跳过)
  // 注意:outbox payload 是 jsonb,drizzle 0.38 不支持点访问嵌套字段,用 SQL 表达式匹配
  const existing = await db
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.type, 'order.paid'),
        sql`${outboxEvents.payload}->>'orderNo' = ${order.orderNo}`,
      ),
    )
    .limit(1)
  if (!existing[0]) {
    await writeToOutbox({
      type: 'order.paid',
      payload: {
        orderNo: order.orderNo,
        userId: order.userId,
        amount: order.amount,
        orderType: order.orderType,
        tradeNo,
        paidAt: new Date().toISOString(),
      },
    })
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
  // P1-5 修复(2026-08-06):原 paid 分支只返回 success,不重放副作用 ——
  // mark-order-paid 已提交但 recharge-tokens/award-points/outbox 未执行时,
  // 崩溃/重试窗口内用户付款成功但资产不到账,且无自动恢复路径(与 completeOrder 行为不一致)。
  // 现在:重放全部副作用(各步幂等:token unique 索引 / 积分 referenceId 查重 / outbox 查重)。
  if (order.status === 'paid') {
    await replayPaidSideEffects(order, tradeNo)
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
        // Phase 4: updateOrderStatus 内部已事务同步 eduOrders，无需额外同步
        return { orderNo, previousStatus: order.status }
      },
      compensate: async () => {
        // 仅当当前状态为 paid 时才回滚(条件 UPDATE,防止误改已补偿的状态)
        // Phase 4: updateOrderStatus 内部已同步回滚 eduOrders(paid→pending)
        await updateOrderStatus(orderNo, 'pending', 'paid')
      },
    },
    {
      name: 'recharge-tokens',
      execute: async () => {
        // B1: token 充值订单(orderType=2)/活动订单(orderType=3)支付成功后加 token
        // rechargeToken 内部 (related_order_no, op_type) unique 索引保证幂等
        if (order.orderType === 2 || order.orderType === 3) {
          if (!order.userId) return { amount: 0, bonusAmount: 0, orderNo }
          await rechargeToken(order.userId, order.amount, orderNo, '充值')
          // P2-20(2026-08-06):充值赠送接线 —— 赠送 token 以 bonus:${orderNo} 为幂等键
          const bonusAmount = await creditTopupBonus(order)
          return { amount: order.amount, bonusAmount, orderNo }
        }
        return { amount: 0, bonusAmount: 0, orderNo }
      },
      compensate: async (result) => {
        const r = result as { amount: number; bonusAmount: number; orderNo: string }
        if (!order.userId) return
        // 补偿:扣回已充值的 token(余额不足时 best-effort,不阻塞回滚流程)
        if (r.amount > 0) {
          try {
            await deductToken(order.userId, r.amount, `订单 ${orderNo} saga 补偿扣回 token`)
          } catch (e) {
            logger.error(`[saga] recharge-tokens compensate failed`, { err: e, orderNo })
          }
        }
        // P2-20(2026-08-06):补偿同时扣回已发放的赠送 token,保证 Saga 回滚一致
        if (r.bonusAmount > 0) {
          try {
            await deductToken(
              order.userId,
              r.bonusAmount,
              `订单 ${orderNo} saga 补偿扣回赠送 token`,
            )
          } catch (e) {
            logger.error(`[saga] recharge-tokens bonus compensate failed`, { err: e, orderNo })
          }
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
 * - orderType=6: API 订阅（token 配额写入活跃 Key）
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
  } else if (order.orderType === 6) {
    // P1 修复(2026-08-06):orderType=6(API 订阅)支付成功后此前未激活订阅——
    // activateApiSubscription 从未被调用,用户支付成功但 token 配额不发放。
    // 现在补上:以订单 orderNo 作为幂等键,续费(新订单)不受影响,回调重试(同订单)被拦截。
    const { activateApiSubscription } = await import('./api-subscription-service.js')
    const result = await activateApiSubscription(order.userId, order.productId, order.orderNo)
    if (!result.success && result.reason !== 'already_activated') {
      throw new Error(`API 订阅激活失败: ${result.reason ?? 'unknown'}`)
    }
  }
}

/**
 * 状态机：取消订单。
 * 仅 pending 订单可取消；已支付订单需走退款流程。
 *
 * P1 修复(2026-08-06):原实现先 SELECT 再 UPDATE,取消与支付回调并发时存在 TOCTOU 竞态——
 * 两个请求都读到 status='pending',取消先执行后支付回调也可能把订单标记为 paid(资金已收但订单已取消)。
 * 改为条件 UPDATE(WHERE status='pending')原子锁定,0 行影响说明订单状态已被并发变更(已支付/已取消),
 * 返回对应错误,避免"支付成功但订单已取消"的资金不一致。
 */
export async function cancelOrder(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'pending')
    return { success: false, reason: `订单状态(${order.status})不可取消` }
  // 条件 UPDATE:仅当当前仍为 pending 时取消,原子锁定防并发支付回调改写状态
  const updated = await updateOrderStatus(orderNo, 'cancelled', 'pending')
  if (!updated) {
    // 0 行影响:并发回调已把订单改为 paid/refunded,重新查询区分场景返回精确错误
    const refetched = await findOrderByNo(orderNo)
    if (refetched && refetched.status === 'paid') {
      return { success: false, reason: '订单已支付,不可取消,请走退款流程' }
    }
    return { success: false, reason: '订单状态已变更,不可取消' }
  }
  return { success: true, order: updated }
}

/**
 * 状态机：退款完成（由退款流程调用）。
 *
 * 2026-08-02 P0 修复(B2):退款时退还 token 余额(token 充值订单/活动订单)。
 * 2026-08-05 P0-2 修复:原实现用 rechargeToken 退款=再发一次 token(钱退+token 再入账)。
 * 改为 refundTokenDeduct 尽力扣回 —— 事务内行锁 + (refund:orderNo, opType=3) 幂等键,
 * 余额不足扣到 0,重复退款被 unique 索引拦截。
 *
 * P2 遗留(2026-08-06):退款无审核/二次确认流程——调用方(payment-gateway 退款端点)
 * 鉴权后直接置为 refunded,角色权限够即可一键退款,无审批/复核/风控(如大额/频次阈值)。
 * 资金敏感操作建议补人工审核或风控规则后再落库 refunded。
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
