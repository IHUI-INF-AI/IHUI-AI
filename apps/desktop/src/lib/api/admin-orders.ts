/**
 * Admin Orders API 扩展端点
 *
 * 背景:packages/api-client (只读) 中 admin 端点仅 adminGetOrders(GET),
 *       没有 PATCH/DELETE /admin/orders/{orderNo} 的实装。
 *       本文件为 desktop 端 admin 业务提供本地封装(只在本端使用),
 *       通过 @ihui/api-client 的 fetchApi 走相同的 token / base URL 链路。
 *
 * 接口约定(与后端对齐):
 *   PATCH /admin/orders/{orderNo}  body: { status, remark? }  →  AdminOrder
 *   POST  /admin/orders/{orderNo}/refund body: { reason }     →  { success: true }
 */
import type { ApiResult } from '@ihui/types'
import { fetchApi } from '@ihui/api-client'
import type { AdminOrder } from '@ihui/api-client'

export type AdminOrderStatus = AdminOrder['status']

export interface UpdateAdminOrderInput {
  status: AdminOrderStatus
  remark?: string
}

export async function updateAdminOrder(
  orderNo: string,
  input: UpdateAdminOrderInput,
): Promise<ApiResult<AdminOrder>> {
  return fetchApi<AdminOrder>(`/admin/orders/${encodeURIComponent(orderNo)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function adminRefundOrder(
  orderNo: string,
  reason: string,
): Promise<ApiResult<{ success: boolean; orderNo: string }>> {
  return fetchApi<{ success: boolean; orderNo: string }>(
    `/admin/orders/${encodeURIComponent(orderNo)}/refund`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  )
}
