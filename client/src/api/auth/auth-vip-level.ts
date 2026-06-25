/**
 * VIP等级管理API
 * 对应后端路由：/auth_vip_level
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface AuthVipLevel {
  id?: string
  level?: number
  levelName?: string
  description?: string
  price?: number
  duration?: number
  durationUnit?: string
  benefits?: string[]
  status?: number
  sort?: number
  createdAt?: string
  updatedAt?: string
}

export interface AuthVipLevelListParams extends PaginationParams {
  levelName?: string
  level?: number
  status?: number
  startTime?: string
  endTime?: string
}

export const createAuthVipLevel = withApiResponseHandler(
  async (data: AuthVipLevel): Promise<ApiResponse<AuthVipLevel>> => {
    const response = await request.post<AuthVipLevel>('/auth_vip_level', data)
    return normalizeApiResponse(response)
  }
)

export const updateAuthVipLevel = withApiResponseHandler(
  async (data: AuthVipLevel): Promise<ApiResponse<AuthVipLevel>> => {
    const response = await request.put<AuthVipLevel>('/auth_vip_level', data)
    return normalizeApiResponse(response)
  }
)

export const getAuthVipLevelList = withApiResponseHandler(
  async (params?: AuthVipLevelListParams): Promise<ApiResponse<PaginationResponse<AuthVipLevel>>> => {
    const response = await request.get('/auth_vip_level/list', { params })
    interface AuthVipLevelListResponse {
      list: AuthVipLevel[]
      total: number
      page: number
      pageSize: number
    }
    const normalizedResponse = normalizeApiResponse<AuthVipLevelListResponse>(response)
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const pageSize = normalizedResponse.data?.pageSize || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as AuthVipLevel[],
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

export const getAuthVipLevelDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AuthVipLevel>> => {
    const response = await request.get<AuthVipLevel>(`/auth_vip_level/${id}`)
    return normalizeApiResponse(response)
  }
)

export const deleteAuthVipLevel = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/auth_vip_level/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const exportAuthVipLevel = withApiResponseHandler(
  async (params?: AuthVipLevelListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/auth_vip_level/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)
