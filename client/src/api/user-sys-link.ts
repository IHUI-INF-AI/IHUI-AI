import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface UserSysLink {
  id?: string
  userId?: string
  sysUserId?: string
  platformType?: string
  linkStatus?: number
  linkTime?: string
  lastSyncTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserSysLinkListParams extends PaginationParams {
  userId?: string
  sysUserId?: string
  platformType?: string
  linkStatus?: number
  startTime?: string
  endTime?: string
}

export const updateUserSysLink = withApiResponseHandler(
  async (data: UserSysLink): Promise<ApiResponse<UserSysLink>> => {
    const response = await request.put<UserSysLink>('/userSysLink', data)
    return normalizeApiResponse(response)
  }
)

export const createUserSysLink = withApiResponseHandler(
  async (data: UserSysLink): Promise<ApiResponse<UserSysLink>> => {
    const response = await request.post<UserSysLink>('/userSysLink', data)
    return normalizeApiResponse(response)
  }
)

export const exportUserSysLink = withApiResponseHandler(
  async (params?: UserSysLinkListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/userSysLink/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getUserSysLinkDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<UserSysLink>> => {
    const response = await request.get<UserSysLink>(`/userSysLink/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getUserSysLinkList = withApiResponseHandler(
  async (params?: UserSysLinkListParams): Promise<ApiResponse<PaginationResponse<UserSysLink>>> => {
    const response = await request.get('/userSysLink/list', { params })
    const normalized = normalizeApiResponse(response)
    
    if (normalized.data && typeof normalized.data === 'object' && 'list' in normalized.data) {
      return normalized as ApiResponse<PaginationResponse<UserSysLink>>
    }
    
    return {
      code: normalized.code ?? 200,
      success: normalized.success,
      message: normalized.message,
      data: {
        list: normalized.data as UserSysLink[],
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

export const deleteUserSysLink = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/userSysLink/${idsString}`)
    return normalizeApiResponse(response)
  }
)
