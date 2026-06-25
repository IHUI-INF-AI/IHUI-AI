/**
 * 订单 API
 * 提供订单相关的接口
 */

import { apiClient } from '../core/client'
import type { ApiResponse } from '@/types/api'

/**
 * 订单信息
 */
export interface Order {
  id: string
  orderNo: string
  userId: string
  amount: number
  status: 'pending' | 'processing' | 'paid' | 'completed' | 'failed' | 'cancelled' | 'timeout' | 'refunded'
  productName: string
  productId: string
  description?: string
  type?: 'product' | 'service' | 'subscription' | 'vip' | 'recharge' | 'refund' | 'consumption' | 'tool' | 'agent' | 'withdraw' | 'tokens'
  createTime: string
  payTime?: string
  completeTime?: string
  paymentMethod?: string
  remark?: string
  originalAmount?: number
  discount?: number
  paymentId?: string
  updateTime?: string
  expireTime?: string
}

/**
 * 获取订单详情
 */
export async function getOrderDetail(orderNo: string): Promise<ApiResponse<Order>> {
  return apiClient.get(`/orders/${orderNo}`)
}

/**
 * 获取订单列表
 */
export async function getOrderList(params?: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<ApiResponse<{
  items: Order[]
  total: number
  page: number
  pageSize: number
}>> {
  return apiClient.get('/orders', { params })
}

/**
 * 获取订单列表（别名）
 */
export const getOrders = getOrderList

/**
 * 创建订单
 */
export async function createOrder(data: {
  productId: string
  amount: number
  paymentMethod?: string
  remark?: string
}): Promise<ApiResponse<Order>> {
  return apiClient.post('/orders', data)
}

/**
 * 取消订单
 */
export async function cancelOrder(orderNo: string): Promise<ApiResponse<void>> {
  return apiClient.post(`/orders/${orderNo}/cancel`)
}

/**
 * 确认收货
 */
export async function confirmOrder(orderNo: string): Promise<ApiResponse<void>> {
  return apiClient.post(`/orders/${orderNo}/confirm`)
}
