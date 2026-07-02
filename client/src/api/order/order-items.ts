/**
 * 订单明细管理 API (订单商品 + 订单支付)
 * 对接后端: app/api/v1/order/items.py
 * 路由前缀: /api/v1/order
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface OrderItemListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  orderId?: number
  [k: string]: unknown
}

export interface OrderItem {
  id: number
  orderId: number
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  createTime?: string | null
}

export interface OrderPayment {
  id: number
  orderId: number
  paymentMethod: string
  paymentAmount: number
  paymentStatus: string
  paymentTime?: string | null
  transactionId?: string | null
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 订单商品
// ===========================================================================

/** 订单商品列表 */
export async function orderItemList(params: OrderItemListParams = {}): Promise<ApiResponse<PaginationResponse<OrderItem>>> {
  const res = await http.get('/api/v1/order/order-items/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      order_id: params.orderId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<OrderItem>>
}

/** 订单商品详情 */
export async function orderItemDetail(itemId: number): Promise<ApiResponse<OrderItem | null>> {
  const res = await http.get(`/api/v1/order/order-items/${itemId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrderItem | null>
}

/** 创建订单商品 */
export async function orderItemCreate(payload: Partial<OrderItem> & { orderId: number; productId: string; productName: string }): Promise<ApiResponse<OrderItem>> {
  const res = await http.post('/api/v1/order/order-items/create', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrderItem>
}

/** 修改订单商品 */
export async function orderItemUpdate(itemId: number, payload: Partial<OrderItem>): Promise<ApiResponse<OrderItem>> {
  const res = await http.put(`/api/v1/order/order-items/${itemId}`, payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrderItem>
}

/** 删除订单商品 */
export async function orderItemDelete(itemId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/order/order-items/${itemId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 订单支付
// ===========================================================================

/** 订单支付列表 */
export async function orderPaymentList(params: OrderItemListParams = {}): Promise<ApiResponse<PaginationResponse<OrderPayment>>> {
  const res = await http.get('/api/v1/order/order-payments/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      order_id: params.orderId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<OrderPayment>>
}

/** 订单支付详情 */
export async function orderPaymentDetail(paymentId: number): Promise<ApiResponse<OrderPayment | null>> {
  const res = await http.get(`/api/v1/order/order-payments/${paymentId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrderPayment | null>
}

/** 创建订单支付 */
export async function orderPaymentCreate(payload: Partial<OrderPayment> & { orderId: number; paymentMethod: string; paymentAmount: number }): Promise<ApiResponse<OrderPayment>> {
  const res = await http.post('/api/v1/order/order-payments/create', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrderPayment>
}

/** 更新订单支付状态 */
export async function orderPaymentUpdateStatus(paymentId: number, status: string): Promise<ApiResponse<OrderPayment>> {
  const res = await http.put(`/api/v1/order/order-payments/${paymentId}/status`, { status })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<OrderPayment>
}

export const orderItemsApi = {
  orderItemList,
  orderItemDetail,
  orderItemCreate,
  orderItemUpdate,
  orderItemDelete,
}

export const orderPaymentsApi = {
  orderPaymentList,
  orderPaymentDetail,
  orderPaymentCreate,
  orderPaymentUpdateStatus,
}

export default { orderItemsApi, orderPaymentsApi }
