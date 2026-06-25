/**
 * 智能体类型管理API
 * 对应后端路由：/category
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface Category {
  id?: string
  name?: string
  code?: string
  description?: string
  parentId?: string
  level?: number
  sort?: number
  status?: number
  icon?: string
  createdAt?: string
  updatedAt?: string
}

export interface CategoryListParams extends PaginationParams {
  name?: string
  code?: string
  parentId?: string
  level?: number
  status?: number
  startTime?: string
  endTime?: string
}

export const createCategory = withApiResponseHandler(
  async (data: Category): Promise<ApiResponse<Category>> => {
    const response = await request.post<Category>('/category', data)
    return normalizeApiResponse(response)
  }
)

export const updateCategory = withApiResponseHandler(
  async (data: Category): Promise<ApiResponse<Category>> => {
    const response = await request.put<Category>('/category', data)
    return normalizeApiResponse(response)
  }
)

export const getCategoryList = withApiResponseHandler(
  async (params?: CategoryListParams): Promise<ApiResponse<PaginationResponse<Category>>> => {
    const response = await request.get('/category/list', { params })
    interface CategoryListResponse {
      list: Category[]
      total: number
      page: number
      pageSize: number
    }
    const normalizedResponse = normalizeApiResponse<CategoryListResponse>(response)
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const pageSize = normalizedResponse.data?.pageSize || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as Category[],
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }
  }
)

export const getCategoryDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<Category>> => {
    const response = await request.get<Category>(`/category/${id}`)
    return normalizeApiResponse(response)
  }
)

export const deleteCategory = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/category/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const exportCategory = withApiResponseHandler(
  async (params?: CategoryListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/category/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)
