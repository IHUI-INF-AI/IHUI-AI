import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from './index.js';
import { orders } from '@ihui/database';
import { generateOutTradeNo } from '../services/wechat-pay.js';

export interface CreateOrderInput {
  userId: string;
  amount: number; // 分
  orderType: number; // 0=token 1=activity 2=identity 3=agent
  productId?: string;
  payType: string; // wechat/alipay/wechat_android/fund
  openId?: string;
  description?: string;
}

export async function createOrder(input: CreateOrderInput) {
  const outTradeNo = generateOutTradeNo(input.payType === 'alipay' ? 'ALI' : 'WX');
  const [order] = await db
    .insert(orders)
    .values({
      orderNo: outTradeNo,
      userId: input.userId,
      amount: input.amount,
      currency: 'CNY',
      status: 'pending',
      paymentMethod: input.payType,
    })
    .returning();
  return order!;
}

export async function findOrderByNo(orderNo: string) {
  const rows = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1);
  return rows[0];
}

export async function updateOrderStatus(
  orderNo: string,
  status: string,
  _paymentStatus?: string,
) {
  const values: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'paid') values.paidAt = new Date();
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
