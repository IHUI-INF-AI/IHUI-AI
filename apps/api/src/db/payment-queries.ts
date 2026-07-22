import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from './index.js';
import { orders } from '@ihui/database';
import { generateOutTradeNo } from '../services/wechat-pay.js';
import { withAudit } from '../utils/audit.js';

export interface CreateOrderInput {
  userId: string;
  amount: number; // 分
  orderType: number; // 1=membership 2=token 3=activity 4=identity（0=未分类）
  productId?: string;
  payType: string; // wechat/alipay/wechat_android/fund
  openId?: string;
  description?: string;
}

/**
 * 创建订单。
 * @param operatorId 操作者 userId(用于 updatedBy 审计)。route handler 传 request.userId ?? null;系统异步任务传 null。
 */
export async function createOrder(input: CreateOrderInput, operatorId: string | null) {
  const outTradeNo = generateOutTradeNo(input.payType === 'alipay' ? 'ALI' : 'WX');
  const [order] = await db
    .insert(orders)
    .values(withAudit({
      orderNo: outTradeNo,
      userId: input.userId,
      amount: input.amount,
      currency: 'CNY',
      status: 'pending',
      paymentMethod: input.payType,
      orderType: input.orderType,
      productId: input.productId,
    }, operatorId))
    .returning();
  return order!;
}

export async function findOrderByNo(orderNo: string) {
  const rows = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1);
  return rows[0];
}

/**
 * 更新订单状态。
 * @param operatorId 操作者 userId(用于 updatedBy 审计)。route handler 传 request.userId ?? null;系统异步任务(支付回调、定时清理)传 null。
 */
export async function updateOrderStatus(
  orderNo: string,
  status: string,
  _paymentStatus?: string,
  operatorId: string | null = null,
) {
  const values: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'paid') values.paidAt = new Date();
  values.updatedBy = operatorId;
  await db.update(orders).set(values).where(eq(orders.orderNo, orderNo));
}

export async function queryPendingOrders() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, thirtyMinAgo)));
}

export async function listPaidOrdersByDate(billDate: string) {
  const start = new Date(`${billDate}T00:00:00Z`);
  const end = new Date(`${billDate}T23:59:59Z`);
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, start), lt(orders.createdAt, end)));
}
