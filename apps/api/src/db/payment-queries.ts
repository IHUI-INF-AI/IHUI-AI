// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, gte, lt, lte, asc } from 'drizzle-orm'
import { db } from './index.js'
import { orders, eduOrders, type Order } from '@ihui/database'
import { generateOutTradeNo } from '../services/wechat-pay.js'
import { withAuditBoth } from '../utils/audit.js'
import { bizDayStartUtc } from '../utils/biz-day.js'

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
/** 事务句柄（DB-02：让下单/完成订单可加入调用方事务，避免跨事务半提交）。 */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function createOrder(
  input: CreateOrderInput,
  operatorId: string | null,
  outerTx?: DbTx,
) {
  const run = async (tx: DbTx) => {
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
  }
  return outerTx ? run(outerTx) : db.transaction(run)
}

export async function findOrderByNo(orderNo: string, tx?: DbTx) {
  const rows = await (tx ?? db).select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
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
  outerTx?: DbTx,
): Promise<Order | undefined> {
  const values: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }
  if (status === 'paid') values.paidAt = new Date()
  if (status === 'cancelled') values.cancelTime = new Date()
  if (status === 'refunded') values.refundTime = new Date()
  values.updatedBy = operatorId
  // F-147:paid 只能从 pending 迁移。历史调用方(vip.ts 主动查单)不传 fromStatus,
  // 曾出现 paid→paid 重放再次进入发卡链路;这里统一兜底为条件更新,0 行即视为已处理。
  const effectiveFrom = fromStatus ?? (status === 'paid' ? 'pending' : undefined)
  const run = async (tx: DbTx) => {
    const conds = [eq(orders.orderNo, orderNo)]
    if (effectiveFrom) conds.push(eq(orders.status, effectiveFrom))
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
      if (effectiveFrom) eduConds.push(eq(eduOrders.status, effectiveFrom))
      await tx
        .update(eduOrders)
        .set(eduValues)
        .where(and(...eduConds))
    }
    return updated
  }
  return outerTx ? run(outerTx) : db.transaction(run)
}

/** F-566:单轮关单取数上限,避免全量拉超期 pending 单拖死 scheduler worker。 */
const EXPIRED_ORDER_BATCH_LIMIT = 200

export async function queryPendingOrders() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, thirtyMinAgo)))
    .orderBy(asc(orders.createdAt))
    .limit(EXPIRED_ORDER_BATCH_LIMIT)
}

/**
 * F-231:对账本地取数用**上海自然日**,与支付宝/微信账单的北京时间归档口径一致。
 *
 * 旧实现用 `${billDate}T00:00:00Z`~`T23:59:59Z` 的 UTC 日界,每天错开 8 小时,固定产出假差异;
 * 且上界 `lt T23:59:59Z` 还截掉了当日最后一秒。日界不在此处重算(守门 246):
 * `new Date(billDate)` 是 UTC 零点、也就是上海同日 08:00,落在账单日同一个上海自然日内,
 * 拿它作参照点交给唯一出口 `bizDayStartUtc` 即可得到上海当日 00:00 与次日 00:00 的 UTC 时刻。
 */
export async function listPaidOrdersByDate(billDate: string) {
  const billDayRef = new Date(billDate)
  const start = bizDayStartUtc(0, billDayRef)
  // 两端闭区间:上界 = 次日 00:00 前 1ms,即上海当日 23:59:59.999,完整覆盖当日 24h。
  const end = new Date(bizDayStartUtc(-1, billDayRef).getTime() - 1)
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, start), lte(orders.createdAt, end)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
