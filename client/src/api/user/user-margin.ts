import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface UserMargin {
  id?: string
  userId?: string
  marginType?: string
  marginAmount?: number
  availableAmount?: number
  frozenAmount?: number
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface UserMarginListParams {
  page?: number
  pageSize?: number
  userId?: string
  marginType?: string
  status?: number
}

export const createUserMargin = withApiResponseHandler(
  async (data: UserMargin): Promise<ApiResponse<UserMargin>> => {
    const response = await request.post<UserMargin>('/AuthuserMargin', data)
    return normalizeApiResponse(response)
  }
)

export const updateUserMargin = withApiResponseHandler(
  async (data: UserMargin): Promise<ApiResponse<UserMargin>> => {
    const response = await request.put<UserMargin>('/AuthuserMargin', data)
    return normalizeApiResponse(response)
  }
)

export const exportUserMargin = withApiResponseHandler(
  async (params?: UserMarginListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/AuthuserMargin/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getUserMarginById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<UserMargin>> => {
    const response = await request.get<UserMargin>(`/AuthuserMargin/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getUserMarginList = withApiResponseHandler(
  async (params?: UserMarginListParams): Promise<ApiResponse<PageResult<UserMargin>>> => {
    const response = await request.get<PageResult<UserMargin>>('/AuthuserMargin/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteUserMargin = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/AuthuserMargin/${idsString}`)
    return normalizeApiResponse(response)
  }
)
