/**
 * 订单业务服务。
 * 在 payment-queries（billing.orders）之上提供：下单、状态机转换（完成/取消）、查询。
 * 订单状态：pending(待支付) → paid(已支付) → cancelled(已取消) / refunded(已退款)。
 */

import {
  createOrder as createOrderRow,
  findOrderByNo,
  updateOrderStatus,
  queryPendingOrders,
  listPaidOrdersByDate,
  type CreateOrderInput,
} from '../db/payment-queries.js';
import type { Order } from '@ihui/database';

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

export type PlaceOrderInput = CreateOrderInput;

export interface OrderOperationResult {
  success: boolean;
  order?: Order;
  reason?: string;
}

/** 下单：创建一笔 pending 订单。 */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  return createOrderRow(input);
}

/** 查询订单详情。 */
export async function getOrder(orderNo: string): Promise<Order | undefined> {
  return findOrderByNo(orderNo);
}

/**
 * 状态机：完成订单（支付成功回调调用）。
 * 仅 pending 订单可转为 paid；记录支付时间。
 */
export async function completeOrder(
  orderNo: string,
  _tradeNo?: string,
): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo);
  if (!order) return { success: false, reason: '订单不存在' };
  if (order.status !== 'pending') return { success: false, reason: `订单状态(${order.status})不可完成` };
  await updateOrderStatus(orderNo, 'paid');
  const updated = await findOrderByNo(orderNo);
  return { success: true, order: updated };
}

/**
 * 状态机：取消订单。
 * 仅 pending 订单可取消；已支付订单需走退款流程。
 */
export async function cancelOrder(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo);
  if (!order) return { success: false, reason: '订单不存在' };
  if (order.status !== 'pending') return { success: false, reason: `订单状态(${order.status})不可取消` };
  await updateOrderStatus(orderNo, 'cancelled');
  const updated = await findOrderByNo(orderNo);
  return { success: true, order: updated };
}

/**
 * 状态机：退款完成（由退款流程调用）。
 */
export async function refundOrder(orderNo: string): Promise<OrderOperationResult> {
  const order = await findOrderByNo(orderNo);
  if (!order) return { success: false, reason: '订单不存在' };
  if (order.status !== 'paid') return { success: false, reason: `订单状态(${order.status})不可退款` };
  await updateOrderStatus(orderNo, 'refunded');
  const updated = await findOrderByNo(orderNo);
  return { success: true, order: updated };
}

/** 查询超时未支付订单（默认 30 分钟）。供对账/定时关单使用。 */
export async function findExpiredOrders(): Promise<Order[]> {
  return queryPendingOrders();
}

/** 查询某日已支付订单（对账用）。 */
export async function findPaidOrdersByDate(billDate: string): Promise<Order[]> {
  return listPaidOrdersByDate(billDate);
}
