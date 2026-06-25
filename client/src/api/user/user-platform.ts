import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface UserPlatform {
  id?: string
  userId?: string
  platformId?: string
  platformType?: string
  platformUserId?: string
  platformUsername?: string
  platformAvatar?: string
  bindStatus?: number
  bindTime?: string
  lastActiveTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserPlatformListParams extends PaginationParams {
  userId?: string
  platformId?: string
  platformType?: string
  bindStatus?: number
  startTime?: string
  endTime?: string
}

export const updateUserPlatform = withApiResponseHandler(
  async (data: UserPlatform): Promise<ApiResponse<UserPlatform>> => {
    const response = await request.put<UserPlatform>('/userPlatform', data)
    return normalizeApiResponse(response)
  }
)

export const createUserPlatform = withApiResponseHandler(
  async (data: UserPlatform): Promise<ApiResponse<UserPlatform>> => {
    const response = await request.post<UserPlatform>('/userPlatform', data)
    return normalizeApiResponse(response)
  }
)

export const exportUserPlatform = withApiResponseHandler(
  async (params?: UserPlatformListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/userPlatform/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getUserPlatformDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<UserPlatform>> => {
    const response = await request.get<UserPlatform>(`/userPlatform/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getUserPlatformList = withApiResponseHandler(
  async (params?: UserPlatformListParams): Promise<ApiResponse<PaginationResponse<UserPlatform>>> => {
    const response = await request.get('/userPlatform/list', { params })
    const normalized = normalizeApiResponse(response)
    
    if (normalized.data && typeof normalized.data === 'object' && 'list' in normalized.data) {
      return normalized as ApiResponse<PaginationResponse<UserPlatform>>
    }
    
    return {
      code: normalized.code ?? 200,
      success: normalized.success,
      message: normalized.message,
      data: {
        list: normalized.data as UserPlatform[],
        pagination: {
          total: 0,
          page: params?.page || 1,
          pageSize: params?.pageSize || 10,
          totalPages: 0,
        },
      },
    }
  }
)

export const deleteUserPlatform = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/userPlatform/${idsString}`)
    return normalizeApiResponse(response)
  }
)
