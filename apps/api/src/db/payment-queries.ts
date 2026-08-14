import { eq, and, gte, lt } from 'drizzle-orm'
import { db } from './index.js'
import { orders, eduOrders, type Order } from '@ihui/database'
import { generateOutTradeNo } from '../services/wechat-pay.js'
import { withAuditBoth } from '../utils/audit.js'

// =============================================================================
// Phase 4: 双向双写辅助 — billing(orders) 入口同步到 edu_orders，消除跨系统断裂。
// 与 order-queries.ts(edu 入口 → 双写 orders)互补：两个入口都写两表，
// 单一数据源，/orders/me 与 /payment/* 等读任意一表都能看到全量订单。
// =============================================================================

/** int 订单类型 → edu_orders 字符串（7→course, 8→card, 其他→数字字符串）。 */
function orderTypeIntToStr(orderType: number): string {
  if (orderType === 7) return 'course'
  if (orderType === 8) return 'card'
  return String(orderType)
}

/** 分 → 元字符串（9900 → "99.00"）。 */
function centsToYuanString(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2)
}

export interface CreateOrderInput {
  userId: string
  amount: number // 分
  orderType: number // 1=membership 2=token 3=activity 4=identity 7=course 8=card（0=未分类）
  productId?: string
  payType: string // wechat/alipay/wechat_android/fund
  openId?: string
  description?: string
  // Phase 1: 教育订单字段统一
  targetId?: string | null
  targetTitle?: string | null
  quantity?: number
  originalPrice?: number // 分
  discountAmount?: number // 分
  remark?: string | null
}

/**
 * 创建订单。
 * @param operatorId 操作者 userId(用于 createdBy + updatedBy 审计)。route handler 传 request.userId ?? null;系统异步任务传 null。
 * Phase 4: 事务内双写 orders + edu_orders（分→元 / int orderType→字符串），与 edu 入口互补。
 */
export async function createOrder(input: CreateOrderInput, operatorId: string | null) {
  return db.transaction(async (tx) => {
    const outTradeNo = generateOutTradeNo(input.payType === 'alipay' ? 'ALI' : 'WX')
    const [order] = await tx
      .insert(orders)
      .values(
        withAuditBoth(
          {
            orderNo: outTradeNo,
            userId: input.userId,
            amount: input.amount,
            currency: 'CNY',
            status: 'pending',
            paymentMethod: input.payType,
            orderType: input.orderType,
            productId: input.productId,
            targetId: input.targetId,
            targetTitle: input.targetTitle,
            quantity: input.quantity,
            originalPrice: input.originalPrice,
            discountAmount: input.discountAmount,
            remark: input.remark,
          },
          operatorId,
        ),
      )
      .returning()
    if (!order) throw new Error('创建订单失败')

    // Phase 4: 双写 — 同步到 edu_orders（同一 UUID + orderNo）
    await tx.insert(eduOrders).values({
      id: order.id,
      orderNo: order.orderNo,
      userId: input.userId,
      orderType: orderTypeIntToStr(input.orderType),
      targetId: input.targetId ?? input.productId,
      targetTitle: input.targetTitle,
      quantity: input.quantity ?? 1,
      originalPrice: centsToYuanString(input.originalPrice),
      discountAmount: centsToYuanString(input.discountAmount),
      payAmount: centsToYuanString(input.amount),
      payType: input.payType,
      status: 'pending',
      remark: input.remark,
    })
    return order
  })
}

export async function findOrderByNo(orderNo: string) {
  const rows = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
  return rows[0]
}

/**
 * 更新订单状态。
 * @param operatorId 操作者 userId(用于 updatedBy 审计)。route handler 传 request.userId ?? null;系统异步任务(支付回调、定时清理)传 null。
 * @param fromStatus 期望的旧状态(可选)。传入时仅当当前状态匹配才更新(条件 UPDATE),
 *   防止并发回调重复触发 saga;返回 undefined 表示状态不匹配(saga 应跳过)。
 *   2026-08-02 P0 修复(B3):原无条件 UPDATE 可被并发回调重复触发。
 * Phase 4: 事务内同步 edu_orders 状态（payTime/cancelTime/refundTime），消除跨系统状态不一致。
 */
export async function updateOrderStatus(
  orderNo: string,
  status: string,
  fromStatus?: string,
  operatorId: string | null = null,
): Promise<Order | undefined> {
  const values: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }
  if (status === 'paid') values.paidAt = new Date()
  if (status === 'cancelled') values.cancelTime = new Date()
  if (status === 'refunded') values.refundTime = new Date()
  values.updatedBy = operatorId
  return db.transaction(async (tx) => {
    const conds = [eq(orders.orderNo, orderNo)]
    if (fromStatus) conds.push(eq(orders.status, fromStatus))
    const [updated] = await tx
      .update(orders)
      .set(values)
      .where(and(...conds))
      .returning()
    if (updated) {
      // Phase 4: 同步状态到 edu_orders（同一 orderNo，条件更新防并发竞态）
      const eduValues: Record<string, unknown> = { status, updatedAt: new Date() }
      if (status === 'paid') eduValues.payTime = new Date()
      if (status === 'cancelled') eduValues.cancelTime = new Date()
      if (status === 'refunded') eduValues.refundTime = new Date()
      const eduConds = [eq(eduOrders.orderNo, orderNo)]
      if (fromStatus) eduConds.push(eq(eduOrders.status, fromStatus))
      await tx.update(eduOrders).set(eduValues).where(and(...eduConds))
    }
    return updated
  })
}

export async function queryPendingOrders() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, thirtyMinAgo)))
}

export async function listPaidOrdersByDate(billDate: string) {
  const start = new Date(`${billDate}T00:00:00Z`)
  const end = new Date(`${billDate}T23:59:59Z`)
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, start), lt(orders.createdAt, end)))
}
