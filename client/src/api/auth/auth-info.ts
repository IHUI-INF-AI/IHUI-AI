import request from '../../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AuthInfo {
  id?: string
  userId?: string
  realName?: string
  idCard?: string
  idCardFront?: string
  idCardBack?: string
  status?: number
  auditStatus?: number
  auditRemark?: string
  createdAt?: string
  updatedAt?: string
}

export interface AuthInfoListParams {
  page?: number
  pageSize?: number
  userId?: string
  realName?: string
  status?: number
  auditStatus?: number
}

export const createAuthInfo = withApiResponseHandler(
  async (data: AuthInfo): Promise<ApiResponse<AuthInfo>> => {
    const response = await request.post<AuthInfo>('/auth_info', data)
    return normalizeApiResponse(response)
  }
)

export const updateAuthInfo = withApiResponseHandler(
  async (data: AuthInfo): Promise<ApiResponse<AuthInfo>> => {
    const response = await request.put<AuthInfo>('/auth_info', data)
    return normalizeApiResponse(response)
  }
)

export const exportAuthInfo = withApiResponseHandler(
  async (params?: AuthInfoListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/auth_info/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getAuthInfoById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AuthInfo>> => {
    const response = await request.get<AuthInfo>(`/auth_info/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAuthInfoList = withApiResponseHandler(
  async (params?: AuthInfoListParams): Promise<ApiResponse<PageResult<AuthInfo>>> => {
    const response = await request.get<PageResult<AuthInfo>>('/auth_info/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAuthInfo = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/auth_info/${idsString}`)
    return normalizeApiResponse(response)
  }
)
