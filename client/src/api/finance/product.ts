/**
 * 产品管理 API
 * 对接后端: zhs_product 模块
 * 路由前缀: /api/v1/zhs_product
 *
 * 后端列表响应为 { code, msg, data: { list, total, page, size } },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update 接口使用 Body 传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface ProductListParams {
  page?: number
  limit?: number
  name?: string
  type?: string
  status?: string
  [k: string]: unknown
}

export interface Product {
  itemId: string
  name: string
  type: string
  status: string
  createTime?: string | null
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
// 产品 CRUD
// ===========================================================================

/** 产品列表 */
export async function productList(params: ProductListParams = {}): Promise<ApiResponse<PaginationResponse<Product>>> {
  const res = await http.get('/api/v1/zhs_product/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      name: params.name || undefined,
      type: params.type || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<Product>>
}

/** 产品详情 */
export async function productDetail(itemId: string): Promise<ApiResponse<Product | null>> {
  const res = await http.get(`/api/v1/zhs_product/${itemId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Product | null>
}

/** 新增产品 (Body 传值) */
export async function productCreate(data: Partial<Product> & { name: string; type: string }): Promise<ApiResponse<Product>> {
  const res = await http.post('/api/v1/zhs_product', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Product>
}

/** 修改产品 (Body 传值) */
export async function productUpdate(data: Partial<Product> & { itemId: string }): Promise<ApiResponse<Product>> {
  const res = await http.put('/api/v1/zhs_product', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Product>
}

/** 删除产品 (支持批量, 逗号分隔) */
export async function productDelete(itemIds: string): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/zhs_product/${itemIds}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const productApi = {
  productList,
  productDetail,
  productCreate,
  productUpdate,
  productDelete,
}

export default productApi