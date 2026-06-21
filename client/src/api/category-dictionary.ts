import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface CategoryDictionary {
  id?: string
  name?: string
  code?: string
  description?: string
  status?: number
  sort?: number
  createdAt?: string
  updatedAt?: string
}

export interface CategoryDictionaryListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: number
}

export const updateCategoryDictionary = withApiResponseHandler(
  async (data: CategoryDictionary): Promise<ApiResponse<CategoryDictionary>> => {
    const response = await request.put<CategoryDictionary>('/categoryDictionary', data)
    return normalizeApiResponse(response)
  }
)

export const createCategoryDictionary = withApiResponseHandler(
  async (data: CategoryDictionary): Promise<ApiResponse<CategoryDictionary>> => {
    const response = await request.post<CategoryDictionary>('/categoryDictionary', data)
    return normalizeApiResponse(response)
  }
)

export const exportCategoryDictionary = withApiResponseHandler(
  async (params?: CategoryDictionaryListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/categoryDictionary/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getCategoryDictionaryById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<CategoryDictionary>> => {
    const response = await request.get<CategoryDictionary>(`/categoryDictionary/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCategoryDictionaryList = withApiResponseHandler(
  async (params?: CategoryDictionaryListParams): Promise<ApiResponse<PageResult<CategoryDictionary>>> => {
    const response = await request.get<PageResult<CategoryDictionary>>('/categoryDictionary/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteCategoryDictionary = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/categoryDictionary/${idsString}`)
    return normalizeApiResponse(response)
  }
)
