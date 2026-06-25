import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AuthToken {
  id?: string
  userId?: string
  token?: string
  tokenType?: string
  expiresAt?: string
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface AuthTokenListParams {
  page?: number
  pageSize?: number
  userId?: string
  tokenType?: string
  status?: number
}

export const updateAuthToken = withApiResponseHandler(
  async (data: AuthToken): Promise<ApiResponse<AuthToken>> => {
    const response = await request.put<AuthToken>('/auth_tokens', data)
    return normalizeApiResponse(response)
  }
)

export const createAuthToken = withApiResponseHandler(
  async (data: AuthToken): Promise<ApiResponse<AuthToken>> => {
    const response = await request.post<AuthToken>('/auth_tokens', data)
    return normalizeApiResponse(response)
  }
)

export const exportAuthToken = withApiResponseHandler(
  async (params?: AuthTokenListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/auth_tokens/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getAuthTokenById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AuthToken>> => {
    const response = await request.get<AuthToken>(`/auth_tokens/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAuthTokenList = withApiResponseHandler(
  async (params?: AuthTokenListParams): Promise<ApiResponse<PageResult<AuthToken>>> => {
    const response = await request.get<PageResult<AuthToken>>('/auth_tokens/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAuthToken = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/auth_tokens/${idsString}`)
    return normalizeApiResponse(response)
  }
)
