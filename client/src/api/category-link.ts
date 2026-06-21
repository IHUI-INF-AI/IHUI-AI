import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface CategoryLink {
  id?: string
  categoryId?: string
  categoryName?: string
  linkedAgentId?: string
  linkedAgentName?: string
  linkType?: string
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface CategoryLinkListParams extends PaginationParams {
  categoryId?: string
  linkedAgentId?: string
  linkType?: string
  status?: number
  startTime?: string
  endTime?: string
}

export const updateCategoryLink = withApiResponseHandler(
  async (data: CategoryLink): Promise<ApiResponse<CategoryLink>> => {
    const response = await request.put<CategoryLink>('/category_link', data)
    return normalizeApiResponse(response)
  }
)

export const createCategoryLink = withApiResponseHandler(
  async (data: CategoryLink): Promise<ApiResponse<CategoryLink>> => {
    const response = await request.post<CategoryLink>('/category_link', data)
    return normalizeApiResponse(response)
  }
)

export const exportCategoryLink = withApiResponseHandler(
  async (params?: CategoryLinkListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/category_link/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getCategoryLinkDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<CategoryLink>> => {
    const response = await request.get<CategoryLink>(`/category_link/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCategoryLinkList = withApiResponseHandler(
  async (params?: CategoryLinkListParams): Promise<ApiResponse<PaginationResponse<CategoryLink>>> => {
    const response = await request.get<PaginationResponse<CategoryLink>>('/category_link/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteCategoryLink = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/category_link/${idsString}`)
    return normalizeApiResponse(response)
  }
)
