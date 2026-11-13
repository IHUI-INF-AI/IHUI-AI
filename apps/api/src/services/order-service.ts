// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  type DbTx,
} from '../db/payment-queries.js'
import type { Order } from '@ihui/database'
import type { FastifyInstance } from 'fastify'
import { executeSaga, type SagaResult } from './distributed-transaction.js'
import { earnPoints, spendPoints } from './points-service.js'
import { logger } from '../utils/logger.js'
import { bizDayKey } from '../utils/biz-day.js'
import { writeToOutbox } from '../utils/outbox.js'
import { rechargeToken, deductToken, refundTokenDeduct } from '../db/commission-queries.js'
import { revokeOrderEntitlements } from './order-entitlement-revoke.js'
import { db } from '../db/index.js'
import { recordPayment } from './edu-ledger.js'
import { eq, and, sql } from 'drizzle-orm'
import {
  orders,
  outboxEvents,
  pointTransactions,
  eduEnrollment,
  eduPaymentRecord,
  tokenFlows,
  commissionFlows,
} from '@ihui/database'
import { isNull } from 'drizzle-orm'
import { calculateTopupBonus } from './topup-discount-service.js'
import { config } from '../config/index.js'
// ihui_payment_* 与 business_orders_total / business_payments_total 指标:
// service 层不持有 fastify 实例,走模块级桥接函数打点(与 recordPaymentAttempt 同范式)
import {
  recordPaymentAttempt,
  recordPaymentSuccess,
  recordPaymentRefund,
  recordPaymentAmount,
  recordOrderSample,
  recordPaymentSample,
} from '../plugins/business-metrics.js'

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
  tx?: DbTx,
): Promise<Order> {
  const order = await createOrderRow(input, operatorId, tx)
  // ihui_payment_attempt_total:下单成功后按渠道计数(渠道中立收口)
  const payChannel = order.paymentMethod ?? 'unknown'
  recordPaymentAttempt(payChannel)
  // business_orders_total{type,status} / business_payments_total{channel,status}:
  // 与上面同一处收口(订单落库成功后),type 取 order_type 原值(整数码,不自立清单),
  // status/channel 档口与既有 ihui_payment_attempt_total 同源 ⇒ 不新增第二份词表。
  recordOrderSample(String(order.orderType), 'pending')
  recordPaymentSample(payChannel, 'attempt')
  return order
}

/** 查询订单详情。 */
export async function getOrder(orderNo: string): Promise<Order | undefined> {
  return findOrderByNo(orderNo)
}

/**
 * 支付成功短信通知(fire-and-forget)。只在真实 pending→paid 的分支调用,
 * 幂等重放分支不重复发;bizId 绑订单号,sendTemplatedSms 的幂等闸再兜一层。
 */
async function notifyPaymentSuccessSms(order: Order): Promise<void> {
  try {
    if (!order.userId) return
    const { sendNoticeSmsToUser } = await import('./sms-notify.js')
    await sendNoticeSmsToUser(order.userId, 'payment-success', {
      bizType: 'order',
      bizId: `order:${order.orderNo}`,
    })
  } catch (e) {
    logger.warn('支付成功短信通知失败', { orderNo: order.orderNo, error: (e as Error).message })
  }
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
  tx?: DbTx,
): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo, tx)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status === 'pending') {
    // B3: 条件 UPDATE,返回 undefined 表示状态不匹配(并发竞态)
    const updated = await updateOrderStatus(orderNo, 'paid', 'pending', null, tx)
    if (!updated) {
      // 竞态:另一并发回调刚把订单标记为 paid,重新查询走幂等路径
      const refetched = await findOrderByNo(orderNo, tx)
      if (refetched && refetched.status === 'paid') {
        await rechargeIfTokenOrder(refetched, tx)
        return { success: true, order: refetched }
      }
      return { success: false, reason: '订单状态不可完成' }
    }
    // B1: token 充值(幂等:rechargeToken 内部 unique 索引拦截重复回调)
    await rechargeIfTokenOrder(updated, tx)
    // B4: 学费订单(orderType=9)自动入账(幂等:receiptNo=orderNo 查重)
    await applyEduTuitionOrder(updated, tx)
    // business_orders_total{type,status="paid"} / business_payments_total{channel,status="success"}:
    // 只在**真实发生的那一次** pending→paid 条件 UPDATE 之后计(上方 `!updated` 的并发竞态
    // 与下面 status 已是 paid 的幂等重放分支都不计)——与 completeOrderWithSaga 里
    // recordPaymentSuccess 的"幂等重放不计数"口径一致,否则重复回调会把分母虚增。
    const payChannel = updated.paymentMethod ?? 'unknown'
    recordOrderSample(String(updated.orderType), 'paid')
    recordPaymentSample(payChannel, 'success')
    void notifyPaymentSuccessSms(updated)
    // Phase 4: updateOrderStatus 内部已事务同步 eduOrders，无需额外同步
    return { success: true, order: updated }
  }
  if (order.status === 'paid') {
    // 幂等重试:订单已支付,重新尝试 token 充值(unique 索引保证幂等)
    await rechargeIfTokenOrder(order, tx)
    await applyEduTuitionOrder(order, tx)
    return { success: true, order }
  }
  return { success: false, reason: `订单状态(${order.status})不可完成` }
}

/**
 * B1: token 充值订单(orderType=2) / 活动订单(orderType=3)支付成功后给用户加 token。
 * rechargeToken 内部 (related_order_no, op_type) unique 索引拦截重复回调(23505→返回当前余额)。
 * 失败时抛出,由调用方(支付回调)触发 paymentIdempotency.fail 释放锁让平台重试。
 */
async function rechargeIfTokenOrder(order: Order, tx?: DbTx): Promise<void> {
  // 2026-10-30 修:orderType=2 被两义共用 —— payment-queries 的 CreateOrderInput 注释写
  // 「2=token 充值」,而 vip.ts 下单同样传 orderType=2 且 productId=vipLevelId。
  // 原判据只看 orderType,于是「用微信/支付宝买 VIP」会走 rechargeToken(order.amount)
  // 白送等额余额,再叠加 activateOrderSubscription 发卡 ⇒ 付一次钱得两样东西。
  // 判据补 !productId:充值订单是用户自定义金额(productId 为空),VIP/套餐订单必有商品 id。
  if ((order.orderType === 2 || order.orderType === 3) && order.userId && !order.productId) {
    await rechargeToken(order.userId, order.amount, order.orderNo, '充值', tx)
    // P2-20(2026-08-06):充值赠送接线 —— 主充值到账后再发放赠送 token
    await creditTopupBonus(order, tx)
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
async function creditTopupBonus(order: Order, tx?: DbTx): Promise<number> {
  // 2026-10-30:同样补 !productId —— 赠送只属于「自定义金额充值」,VIP 购买不是充值
  if (order.orderType !== 2 || !order.userId || order.productId) return 0
  const amountYuan = order.amount / 100
  const { actualCredit } = await calculateTopupBonus(amountYuan, order.paymentMethod ?? '')
  const bonusCents = Math.round((actualCredit - amountYuan) * 100)
  if (bonusCents <= 0) return 0
  await rechargeToken(order.userId, bonusCents, `bonus:${order.orderNo}`, '充值赠送', tx)
  return bonusCents
}

/**
 * B4(2026-09-19): 学费在线支付订单(orderType=9)支付成功后自动入账。
 * 订单 productId = eduEnrollment.id。
 * 单位换算:orders.amount 为分(微信支付),eduEnrollment/eduPaymentRecord 为元(与 web 缴费登记一致)。
 * - 幂等:按 receiptNo=orderNo 查重,edu_payment_record 已有该单号则跳过(重复回调/重放安全);
 * - 校验:productId 必须对应有效报名且 payer(order.userId)为该报名学员,防伪造;
 * - 累加:edu_enrollment.paidAmount 条件 UPDATE(deleted_at is null),欠费=max(0,totalFee-paid) 自动收敛。
 * 失败抛出,由调用方(支付回调)触发 paymentIdempotency.fail 释放锁让平台重试。
 */
async function applyEduTuitionOrder(order: Order, tx?: DbTx): Promise<void> {
  if (order.orderType !== 9 || !order.userId || !order.productId) return
  const q = tx ?? db
  const existing = await q
    .select({ id: eduPaymentRecord.id })
    .from(eduPaymentRecord)
    .where(and(eq(eduPaymentRecord.receiptNo, order.orderNo), isNull(eduPaymentRecord.deletedAt)))
    .limit(1)
  if (existing.length > 0) return
  const enrollment = await q
    .select({
      id: eduEnrollment.id,
      studentId: eduEnrollment.studentId,
      classId: eduEnrollment.classId,
    })
    .from(eduEnrollment)
    .where(and(eq(eduEnrollment.id, order.productId), isNull(eduEnrollment.deletedAt)))
    .limit(1)
  const enrollmentRow = enrollment[0]
  if (!enrollmentRow || enrollmentRow.studentId !== order.userId) return
  const amountYuan = Math.round(order.amount / 100)
  // F-21: 业务日键走唯一出口(Asia/Shanghai)。原先取 UTC 日(toISOString 后截前 10 位),
  // 上海 00:00–08:00 的支付会被记到前一天(月初 1 日直接落到上月),
  // 而 edu-ledger 的 todayIso() 用的是 bizDayKey() —— 同一 date 列两种口径。
  const today = bizDayKey()
  // 入账走账目唯一出口:写流水 + 重算派生缓存。
  // 旧写法在此处直接 `paidAmount + amountYuan`,而幂等只靠上面那一次 select ——
  // 查与写不在同一事务、当时也没有唯一约束,两个并发回调能同时通过查重把同一笔款**累加两次**
  // (已缴翻倍、欠费变负,而账面一路绿)。现在判重交给数据库的
  // uq_edu_payment_receipt_no:撞号 = 已入账,直接返回,不再累加。
  try {
    await recordPayment(
      {
        enrollmentId: enrollmentRow.id,
        studentId: enrollmentRow.studentId,
        classId: enrollmentRow.classId,
        amount: amountYuan,
        paymentDate: today,
        paymentMethod: 'wechat',
        status: 'paid',
        receiptNo: order.orderNo,
        remark: `在线支付-学费 ${order.orderNo}`,
      },
      tx,
    )
  } catch (err) {
    // 外层事务内 23505 已使事务中止,不能在本层吞掉(否则后续语句全失败),交由外层整体回滚后重试
    if (!tx && (err as { code?: unknown })?.code === '23505') {
      logger.info('学费订单重复回调已被唯一索引拦下,不再入账', {
        orderNo: order.orderNo,
        enrollmentId: order.productId,
      })
      return
    }
    throw err
  }
  logger.info('学费订单自动入账完成', {
    orderNo: order.orderNo,
    enrollmentId: order.productId,
    amountYuan,
  })
}

/**
 * F-12(2026-11-12):已支付订单副作用的「事务 + 行级锁」幂等骨架。
 *
 * 支付回调(胜利方 saga)与管理员 complete-saga 并发时,重放侧的「先查后插」会与
 * 胜利方未提交的 earnPoints/writeToOutbox 交错 ⇒积分/Outbox 各发两次(工单 F-12)。
 * 工单首选修法是给 point_transactions(reference_id,type) / outbox 加唯一索引 + ON CONFLICT,
 * 但那必须新增数据库迁移(本单禁增迁移)⇒ 按工单第二修法「整段置于分布式锁/事务内」落地:
 * 事务内先对 orders 行 FOR UPDATE 抢同一把行锁,把双方的「查 + 写」串行化成恰好一次 ——
 * 后到者拿到锁时先行者已提交,锁内二次查重必可见(等价于工单的锁/唯一约束语义)。
 */
async function lockOrderRow(tx: DbTx, orderNo: string): Promise<void> {
  await tx.select({ id: orders.id }).from(orders).where(eq(orders.orderNo, orderNo)).for('update')
}

/** 锁内查重:该订单是否已发放过消费奖励(判据与工单唯一索引 (reference_id,type) 等价) */
async function hasEarnedPoints(tx: DbTx, orderNo: string): Promise<boolean> {
  const rows = await tx
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(and(eq(pointTransactions.referenceId, orderNo), eq(pointTransactions.type, 'earn')))
    .limit(1)
  return rows.length > 0
}

/** 锁内查重:该订单是否已写过 order.paid Outbox 事件(payload 是 jsonb,用 SQL 表达式匹配) */
async function hasOrderPaidOutbox(tx: DbTx, orderNo: string): Promise<boolean> {
  const rows = await tx
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.type, 'order.paid'),
        sql`${outboxEvents.payload}->>'orderNo' = ${orderNo}`,
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * P1-5(2026-08-06):已支付订单副作用重放 —— 崩溃窗口恢复/重试时补执行。
 * 各步骤幂等,可安全重复调用:
 * 1. token 充值:rechargeToken 内部 (related_order_no, op_type) unique 索引拦截重复;
 * 2. 积分发放:先查 point_transactions 是否已有 referenceId=orderNo 的 earn 流水,有则跳过;
 * 3. Outbox:先查 order.paid 事件是否已存在(按 payload->>'orderNo' 匹配),有则跳过。
 * F-12(2026-11-12):2/3 收进同一事务并先对 orders 行 FOR UPDATE —— 与胜利方 saga 并发
 * 时靠行锁串行,锁内查重才真正恰好一次(原「事务外先查后插」会与胜利方未提交写入交错)。
 * 任一步失败抛出,由 paymentIdempotency 失败分支释放锁,让回调平台重试。
 */
async function replayPaidSideEffects(order: Order, tradeNo?: string): Promise<void> {
  // ⓪ 学费订单入账(幂等:receipt_no 唯一索引 + 账目出口重算)。
  // 此前这一支**不在重放清单里** —— 而 applyEduTuitionOrder 只在正常回调路径被调,
  // 于是"回调进来了、进程在入账前被杀"的窗口里,这笔学费永久不入账,
  // 而订单本身是 paid 状态、再也不会重放 ⇒ 学员明明付了钱,系统继续算他欠费并催缴。
  await applyEduTuitionOrder(order)

  // ① token 充值(幂等:unique 索引)
  await rechargeIfTokenOrder(order)

  const pointsToAward = Math.max(0, Math.floor(order.amount / 100))
  await db.transaction(async (tx) => {
    // F-12:行锁先行 —— 回调(胜利方 saga)与重放双开的串行化点
    await lockOrderRow(tx, order.orderNo)

    // ② 积分发放(锁内幂等:referenceId 查重,后到者见先行者已提交的流水)
    if (pointsToAward > 0 && order.userId && !(await hasEarnedPoints(tx, order.orderNo))) {
      await earnPoints(
        order.userId,
        pointsToAward,
        'order_purchase',
        `订单 ${order.orderNo} 消费奖励`,
        order.orderNo,
        tx,
      )
    }

    // ③ Outbox 事件(锁内幂等:同 orderNo 的 order.paid 已存在则跳过)
    if (!(await hasOrderPaidOutbox(tx, order.orderNo))) {
      await writeToOutbox(
        {
          type: 'order.paid',
          payload: {
            orderNo: order.orderNo,
            userId: order.userId,
            amount: order.amount,
            orderType: order.orderType,
            tradeNo,
            paidAt: new Date().toISOString(),
          },
        },
        tx,
      )
    }
  })
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
        // 2026-10-30:补 !productId —— orderType=2 同时被 VIP 购买复用(vip.ts 传 productId=vipLevelId),
        // 只看 orderType 会把买 VIP 的订单当充值,白送等额余额(与 rechargeIfTokenOrder 同一处判据)
        if ((order.orderType === 2 || order.orderType === 3) && !order.productId) {
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
        const userId = order.userId
        // F-12:与重放方同一把订单行锁 + 锁内查重 —— 回调 saga 与 complete-saga 重放并发
        // 时恰好一方发放;并发重放已先发时本步让位(amount=0,补偿也只撤 saga 自己发的部分)。
        return db.transaction(async (tx) => {
          await lockOrderRow(tx, order.orderNo)
          if (await hasEarnedPoints(tx, orderNo)) return { amount: 0 }
          const result = await earnPoints(
            userId,
            pointsToAward,
            'order_purchase',
            `订单 ${orderNo} 消费奖励`,
            orderNo,
            tx,
          )
          return { amount: pointsToAward, transactionId: result.transaction.id }
        })
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
        // F-12:同一把订单行锁内先查后写 —— 防重放方并发补写第二条 order.paid
        return db.transaction(async (tx) => {
          await lockOrderRow(tx, orderNo)
          if (await hasOrderPaidOutbox(tx, orderNo)) return { written: false }
          await writeToOutbox(
            {
              type: 'order.paid',
              payload: {
                orderNo,
                userId: order.userId,
                amount: order.amount,
                orderType: order.orderType,
                tradeNo,
                paidAt: new Date().toISOString(),
              },
            },
            tx,
          )
          return { written: true }
        })
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

  // ihui_payment_success_total + amount_total: saga 真实完成(状态迁移)后计数。
  // 幂等重放路径(上方 status==='paid' 分支)不计,防重复回调虚增成功率分母。
  // amount 单位 = 分(最小货币单位,orders.amount)。
  const payChannel = order.paymentMethod ?? 'unknown'
  recordPaymentSuccess(payChannel)
  recordPaymentAmount(payChannel, order.amount)
  // business_orders_total / business_payments_total:同一条"saga 真实完成后才计数"的
  // 收口(重放分支已在上方 return 掉),标签档口与紧邻这两行同源。
  recordOrderSample(String(order.orderType), 'paid')
  recordPaymentSample(payChannel, 'success')

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

  // 支付成功收据邮件(「智汇通报」版式,fire-and-forget,失败不阻塞订单完成)
  try {
    if (order.userId) {
      const [{ findUserById }, { sendEmail }, { renderPaymentReceiptEmail }] = await Promise.all([
        import('../db/queries.js'),
        import('./email-service.js'),
        import('./email-templates.js'),
      ])
      const user = await findUserById(order.userId)
      if (user?.email) {
        const receipt = renderPaymentReceiptEmail({
          userName: user.nickname ?? undefined,
          orderNo,
          productTitle: order.targetTitle ?? '智汇AI 商品',
          quantity: order.quantity ?? 1,
          amountYuan: String(order.amount),
          payType: order.paymentMethod ?? '',
          paidAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
          subscriptionUrl: `${config.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'https://aizhs.top'}/user/subscription`,
        })
        void sendEmail({
          to: user.email,
          subject: receipt.subject,
          html: receipt.html,
          text: receipt.text,
          scene: 'notification',
        }).catch(() => {})
      }
    }
  } catch {
    /* 收据邮件失败不阻塞订单完成 */
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
    await purchaseVip({
      userId: order.userId,
      vipLevelId: order.productId,
      orderId: order.id,
      paidAt: order.paidAt ?? undefined,
      // F-148:下单时 amount = price * quantity,履约必须按同一 quantity 延长对应期数,
      // 否则买 N 份只发 1 期(超收)。历史订单 quantity 有默认值 1。
      quantity: order.quantity ?? 1,
    })
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
      paidAt: order.paidAt ?? undefined,
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
  // business_orders_total{type,status="cancelled"}:同样只在条件 UPDATE 真的改到行之后计
  // (0 行影响的并发分支已在上面 return 掉)。取消 pending 订单不是支付事件 ⇒
  // 不写 business_payments_total,免得给支付面板添一个不存在的档口。
  recordOrderSample(String(order.orderType), 'cancelled')
  return { success: true, order: updated }
}

/**
 * 状态机：退款抢占(必须在调用支付渠道之前执行)。
 *
 * F-09:原实现先调支付宝再落本地状态,两个并发退款请求都能读到 paid、各调一次支付宝,
 * 本地再各自无条件置 refunded ⇒ 真实资金双出。状态机只有 pending/paid/cancelled/refunded,
 * 不新增中间态,直接用条件 UPDATE(paid→refunded)做抢占闸门:0 行命中即说明已被并发请求
 * 抢占,调用方必须返回冲突且不得再调支付渠道。
 */
export async function claimRefund(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.status !== 'paid')
    return { success: false, reason: `订单状态(${order.status})不可退款` }
  const claimed = await updateOrderStatus(orderNo, 'refunded', 'paid')
  if (!claimed) return { success: false, reason: '订单状态已变更,退款未落库' }
  return { success: true, order: claimed }
}

/**
 * 状态机：解除退款抢占(refunded→paid)。
 * F-09:抢占发生在支付渠道调用之前,渠道失败/抛异常必须回退,否则订单被误记为已退款、
 * 用户无法再次发起退款。支付宝侧 out_request_no 固定为 refund_<outTradeNo>,重试幂等。
 */
export async function abortRefund(orderNo: string): Promise<boolean> {
  const reverted = await updateOrderStatus(orderNo, 'paid', 'refunded')
  return Boolean(reverted)
}

/**
 * F-629:退款时回收该订单已发放的「充值赠送」token。
 * 赠送流水以 related_order_no=`bonus:${orderNo}` 落账(见 creditTopupBonus),退款原先只按
 * `refund:${orderNo}` 扣回本金,两笔流水互不匹配 ⇒ 赠送永久留在用户账上,「充值→退款」可循环套利。
 * - 扣回量取实际入账流水的 quantity(不按当前阶梯重算:配置可能在支付后、退款前被改);
 * - 幂等键 = refundTokenDeduct 内部 `refund:` 前缀 + 传入单号 ⇒ `refund:bonus:${orderNo}`,
 *   与本金 `refund:${orderNo}` 互不冲突,重复退款仍被 unique 索引拦截;
 * - 未发放(无流水 / quantity<=0)直接跳过,不报错。
 */
async function reclaimTopupBonus(order: Order): Promise<void> {
  if (order.orderType !== 2 || !order.userId || order.productId) return
  const rows = await db
    .select({ quantity: tokenFlows.quantity })
    .from(tokenFlows)
    .where(and(eq(tokenFlows.relatedOrderNo, `bonus:${order.orderNo}`), eq(tokenFlows.opType, 0)))
    .limit(1)
  const issued = rows[0]?.quantity ?? 0
  if (!Number.isFinite(issued) || issued <= 0) return
  await refundTokenDeduct(order.userId, issued, `bonus:${order.orderNo}`, '退款扣回赠送')
}

/**
 * F-407:退款时按订单将佣金置无效(status=0,不再计入可提现/汇总),并冲减已入账的
 * token 佣金。冲减复用 refundTokenDeduct(以佣金流水 id 为幂等键,重复退款被拦截);
 * 失败向上抛出,订单保持 paid 等待重试(与 F-33 本金扣回同语义)。
 */
async function revokeOrderCommissions(order: Order): Promise<void> {
  const flows = await db
    .select({
      id: commissionFlows.id,
      beneficiaryId: commissionFlows.beneficiaryId,
      token: commissionFlows.token,
      status: commissionFlows.status,
    })
    .from(commissionFlows)
    .where(eq(commissionFlows.orderId, order.id))
  if (flows.length === 0) return
  await db.update(commissionFlows).set({ status: 0 }).where(eq(commissionFlows.orderId, order.id))
  for (const flow of flows) {
    if (flow.status === 1 && flow.token > 0 && flow.beneficiaryId) {
      await refundTokenDeduct(flow.beneficiaryId, flow.token, `comm:${flow.id}`, '退款冲减佣金')
    }
  }
}

/**
 * 状态机：退款完成（由退款流程调用）。
 *
 * 2026-08-02 P0 修复(B2):退款时退还 token 余额(token 充值订单/活动订单)。
 * 2026-08-05 P0-2 修复:原实现用 rechargeToken 退款=再发一次 token(钱退+token 再入账)。
 * 改为 refundTokenDeduct 尽力扣回 —— 事务内行锁 + (refund:orderNo, opType=3) 幂等键,
 * 余额不足扣到 0,重复退款被 unique 索引拦截。
 * 2026-11-10:扣回与 rechargeIfTokenOrder 同一判据,补 !productId。orderType=2 同时表示
 * 自定义金额充值(productId 空,支付时入账)与 VIP 购买(productId=vipLevelId,支付时不入账)。
 * 有 productId 的退款不得扣回从未入账的 token。
 *
 * P2 遗留(2026-08-06):退款无审核/二次确认流程——调用方(payment-gateway 退款端点)
 * 鉴权后直接置为 refunded,角色权限够即可一键退款,无审批/复核/风控(如大额/频次阈值)。
 * 资金敏感操作建议补人工审核或风控规则后再落库 refunded。
 *
 * F-629:本金扣回后同时回收该订单已发放的「充值赠送」token(见 reclaimTopupBonus)。
 */
export async function refundOrder(
  orderNo: string,
  opts?: { alreadyClaimed?: boolean },
): Promise<OrderOperationResult> {
  // F-09:alreadyClaimed 表示调用方已在调用支付渠道之前用 claimRefund 抢占过状态,
  // 这里不再重复做 paid→refunded 迁移,只负责退款副作用(token 扣回/指标)。
  const alreadyClaimed = opts?.alreadyClaimed === true
  const order = await findOrderByNo(orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (!alreadyClaimed && order.status !== 'paid')
    return { success: false, reason: `订单状态(${order.status})不可退款` }
  // F-33:先扣回 token,再落 refunded。
  // 原实现先 updateOrderStatus('refunded') 再把扣回失败 try/catch 吞掉 —— 钱已退、token
  // 还留在用户账上且调用方拿到 success,属于静默资金损失。现在扣回失败直接抛给调用方,
  // 订单保持 paid 等待重试;refundTokenDeduct 按 refund:<orderNo> 幂等,重试不会二次扣减。
  // 与 rechargeIfTokenOrder / creditTopupBonus 同一判据:有 productId 的 VIP/套餐单
  // 支付时没有 rechargeToken,退款不能按金额把未入账 token 扣回去。
  if ((order.orderType === 2 || order.orderType === 3) && order.userId && !order.productId) {
    try {
      await refundTokenDeduct(order.userId, order.amount, orderNo, '退款')
      // F-629:本金扣回后在同一 try 内回收该订单已发放的赠送 token,
      // 失败与本金扣回同语义(抛出 → 调用方重试;alreadyClaimed 先 abortRefund 回 paid)。
      await reclaimTopupBonus(order)
    } catch (e) {
      // F-09:抢占路径下订单已置 refunded,扣回失败必须解除抢占回到 paid,
      // 保持 F-33「扣回失败 → 订单保持 paid 等待重试」的既有语义。
      if (alreadyClaimed) await abortRefund(orderNo)
      throw e
    }
  }
  // F-407:本金扣回之后、落 refunded 之前冲减该单佣金 —— 按订单将 commissionFlows 置
  // status=0(不再计入 availableWithdrawal),并对已入账 token 佣金 refundTokenDeduct 冲减
  // (幂等键 comm:<flow.id>,重复退款被唯一键拦截)。失败与 F-33 同语义:alreadyClaimed 先
  // 回 paid 再抛,订单保持 paid 等待重试,绝不出现「钱已退、佣金仍可提现」。
  try {
    await revokeOrderCommissions(order)
  } catch (e) {
    if (alreadyClaimed) await abortRefund(orderNo)
    throw e
  }
  // F-371:退款必须同步回收已发放权益(VIP / 开发者订阅 / API 订阅配额),
  // 且「回收权益 + 订单置 refunded + 审计留痕」在同一事务内完成。
  // 与上面的 token 扣回同语义:任一步失败即整体回滚 —— 非抢占路径订单保持 paid 等待重试,
  // 抢占路径先解除抢占再抛出,绝不会出现「钱已退、权益还在」的半状态。
  // 注:金额侧扣回仍走 refundTokenDeduct(行锁 + refund:<orderNo> 唯一键,本身原子且幂等),
  // 不在这里重写第二套账务;重复退款由订单状态与流水唯一键双重拦截。
  try {
    const outcome = await db.transaction(async (tx) => {
      if (!alreadyClaimed) {
        const refundedOrder = await updateOrderStatus(orderNo, 'refunded', 'paid', null, tx)
        if (!refundedOrder) return { ok: false as const }
      }
      await revokeOrderEntitlements(order, tx)
      return { ok: true as const }
    })
    if (!outcome.ok) {
      return { success: false, reason: '订单状态已变更,退款未落库' }
    }
  } catch (e) {
    // F-09:抢占路径下订单已是 refunded,回收失败必须解除抢占回到 paid 才能重试
    if (alreadyClaimed) await abortRefund(orderNo)
    throw e
  }
  // ihui_payment_refund_total:退款状态落库成功后按渠道计数
  recordPaymentRefund(order.paymentMethod ?? 'unknown')
  // business_orders_total{type,status="refunded"} / business_payments_total{channel,status="refund"}:
  // 与上一行同一处收口(退款状态已落库),档口沿用既有 ihui_payment_refund_total 的语义。
  recordOrderSample(String(order.orderType), 'refunded')
  recordPaymentSample(order.paymentMethod ?? 'unknown', 'refund')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
