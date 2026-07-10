import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface ProductRecord {
  productId?: number | string
  productName?: string
  productType?: string
  status?: string
  [key: string]: unknown
}

export async function getAdminProducts(params?: Recordable): Promise<ApiResponse<PaginatedData<ProductRecord>>> {
  const data = await http.get<{ list: ProductRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/resources/products',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
