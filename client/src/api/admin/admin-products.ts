/**
 * 管理后台 - 产品/商品 API
 * 后端约定：/admin/products 列表、增删改、上下架
 */
import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

export interface AdminProduct {
  id: string
  name: string
  image: string
  type: string
  price: number
  status: string
  stock: number
  sales: number
  createdAt: string
}

export interface AdminProductListParams extends PaginationParams {
  type?: string
  status?: string
  keyword?: string
}

export interface AdminProductListResult {
  list: AdminProduct[]
  total: number
}

export interface AdminProductCreateParams {
  name: string
  image?: string
  type: string
  price: number
  stock?: number
}

export interface AdminProductUpdateParams extends Partial<AdminProductCreateParams> {
  status?: string
}

/** 获取产品列表 */
export async function getAdminProducts(
  params?: AdminProductListParams
): Promise<ApiResponse<AdminProductListResult>> {
  try {
    const response = await request.get<AdminProductListResult>('/admin/products', { params })
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: { list: [], total: 0 },
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 新增产品 */
export async function createAdminProduct(
  data: AdminProductCreateParams
): Promise<ApiResponse<AdminProduct>> {
  try {
    const response = await request.post<AdminProduct>('/admin/products', data)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '创建失败',
      data: {} as AdminProduct,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 更新产品 */
export async function updateAdminProduct(
  id: string,
  data: AdminProductUpdateParams
): Promise<ApiResponse<AdminProduct>> {
  try {
    const response = await request.put<AdminProduct>(`/admin/products/${id}`, data)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '更新失败',
      data: {} as AdminProduct,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 删除产品 */
export async function deleteAdminProduct(id: string): Promise<ApiResponse<boolean>> {
  try {
    const response = await request.delete<boolean>(`/admin/products/${id}`)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '删除失败',
      data: false,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 上架/下架 */
export async function toggleAdminProductStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<ApiResponse<AdminProduct>> {
  try {
    const response = await request.put<AdminProduct>(`/admin/products/${id}/status`, { status })
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '操作失败',
      data: {} as AdminProduct,
      success: false,
      timestamp: Date.now(),
    }
  }
}
