/**
 * 管理后台 - 订单 API
 * 后端约定：/admin/orders 列表、详情、完成、取消
 */
import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { seedFallbackB } from '@/utils/seedData'

export interface AdminOrder {
  id: string
  orderNo: string
  userId: string
  userName: string
  productId: string
  productName: string
  amount: number
  status: string
  paymentMethod: string
  createdAt: string
}

export interface AdminOrderListParams extends PaginationParams {
  status?: string
  keyword?: string
}

export interface AdminOrderListResult {
  list: AdminOrder[]
  total: number
}

/** 获取订单列表 */
export async function getAdminOrders(
  params?: AdminOrderListParams
): Promise<ApiResponse<AdminOrderListResult>> {
  try {
    const response = await request.get<AdminOrderListResult>('/admin/orders', { params })
    return normalizeApiResponse(response)
  } catch (_e) {
    // P15.1 seedData fallback
    return seedFallbackB('orders', params) as any
  }
}

/** 订单详情 */
export async function getAdminOrderDetail(id: string): Promise<ApiResponse<AdminOrder>> {
  try {
    const response = await request.get<AdminOrder>(`/admin/orders/${id}`)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: {} as AdminOrder,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 完成订单 */
export async function completeAdminOrder(id: string): Promise<ApiResponse<AdminOrder>> {
  try {
    const response = await request.put<AdminOrder>(`/admin/orders/${id}/complete`)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '操作失败',
      data: {} as AdminOrder,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 取消订单 */
export async function cancelAdminOrder(id: string): Promise<ApiResponse<AdminOrder>> {
  try {
    const response = await request.put<AdminOrder>(`/admin/orders/${id}/cancel`)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '操作失败',
      data: {} as AdminOrder,
      success: false,
      timestamp: Date.now(),
    }
  }
}
