import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface OrderRecord {
  orderId?: number | string
  orderNo?: string
  status?: string
  [key: string]: unknown
}

export async function getAdminOrders(params?: Recordable): Promise<ApiResponse<PaginatedData<OrderRecord>>> {
  const data = await http.get<{ list: OrderRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/orders',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
export function completeAdminOrder(orderId: number | string): Promise<ApiResponse> {
  return Promise.resolve({ code: 200, success: true, message: '', data: null })
}
