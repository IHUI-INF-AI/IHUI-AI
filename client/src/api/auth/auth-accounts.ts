import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AuthAccount {
  id?: string
  userId?: string
  platform?: string
  openId?: string
  unionId?: string
  nickname?: string
  avatar?: string
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface AuthAccountListParams {
  page?: number
  pageSize?: number
  userId?: string
  platform?: string
  status?: number
}

export const createAuthAccount = withApiResponseHandler(
  async (data: AuthAccount): Promise<ApiResponse<AuthAccount>> => {
    const response = await request.post<AuthAccount>('/auth_accounts', data)
    return normalizeApiResponse(response)
  }
)

export const updateAuthAccount = withApiResponseHandler(
  async (data: AuthAccount): Promise<ApiResponse<AuthAccount>> => {
    const response = await request.put<AuthAccount>('/auth_accounts', data)
    return normalizeApiResponse(response)
  }
)

export const exportAuthAccount = withApiResponseHandler(
  async (params?: AuthAccountListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/auth_accounts/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const bindAuthAccount = withApiResponseHandler(
  async (data: { userId?: string; platform?: string; openId?: string }): Promise<ApiResponse<AuthAccount>> => {
    const response = await request.post<AuthAccount>('/auth_accounts/bind', data)
    return normalizeApiResponse(response)
  }
)

export const getAuthAccountById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AuthAccount>> => {
    const response = await request.get<AuthAccount>(`/auth_accounts/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAuthAccountList = withApiResponseHandler(
  async (params?: AuthAccountListParams): Promise<ApiResponse<PageResult<AuthAccount>>> => {
    const response = await request.get<PageResult<AuthAccount>>('/auth_accounts/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAuthAccount = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/auth_accounts/${idsString}`)
    return normalizeApiResponse(response)
  }
)
