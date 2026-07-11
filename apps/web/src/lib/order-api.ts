import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

export type OrderStatus =
  'pending' | 'paid' | 'cancelled' | 'refunding' | 'refunded' | 'completed' | 'failed'

export type OrderType = 'course' | 'vip' | 'live' | 'product' | 'recharge'

export interface Order {
  id: string
  orderNo: string
  userId: string
  type: OrderType
  targetId: string
  targetTitle: string
  amount: number
  discountAmount: number
  payAmount: number
  status: OrderStatus
  payMethod: string | null
  paidAt: string | null
  refundedAt: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export type OrderListQuery = {
  page?: number
  pageSize?: number
  status?: OrderStatus
  type?: OrderType
}

export async function getOrders(query: OrderListQuery = {}): Promise<ApiResult<PageData<Order>>> {
  return fetchApi<PageData<Order>>(`/api/orders/me${buildQs(query)}`)
}

export async function getOrderById(orderNo: string): Promise<ApiResult<Order>> {
  return fetchApi<Order>(`/api/orders/${encodeURIComponent(orderNo)}`)
}

export async function createOrder(input: {
  type: OrderType
  targetId: string
  couponId?: string
  remark?: string
}): Promise<ApiResult<{ orderNo: string; payAmount: number }>> {
  return fetchApi<{ orderNo: string; payAmount: number }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function cancelOrder(
  orderNo: string,
  reason?: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/orders/${encodeURIComponent(orderNo)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function refundOrder(
  orderNo: string,
  reason: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/orders/${encodeURIComponent(orderNo)}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}
