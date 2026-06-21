import request from '../utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '../utils/apiResponseHandler'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AuthVeriCode {
  id?: string
  phone?: string
  code?: string
  codeType?: string
  expireTime?: string
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface AuthVeriCodeListParams {
  page?: number
  pageSize?: number
  phone?: string
  codeType?: string
  status?: number
}

export const createAuthVeriCode = withApiResponseHandler(
  async (data: AuthVeriCode): Promise<ApiResponse<AuthVeriCode>> => {
    const response = await request.post<AuthVeriCode>('/auth_veri_codes', data)
    return normalizeApiResponse(response)
  }
)

export const updateAuthVeriCode = withApiResponseHandler(
  async (data: AuthVeriCode): Promise<ApiResponse<AuthVeriCode>> => {
    const response = await request.put<AuthVeriCode>('/auth_veri_codes', data)
    return normalizeApiResponse(response)
  }
)

export const exportAuthVeriCode = withApiResponseHandler(
  async (params?: AuthVeriCodeListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/auth_veri_codes/export', params, { responseType: 'blob' })
    return normalizeApiResponse(response)
  }
)

export const getAuthVeriCodeById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AuthVeriCode>> => {
    const response = await request.get<AuthVeriCode>(`/auth_veri_codes/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getAuthVeriCodeList = withApiResponseHandler(
  async (params?: AuthVeriCodeListParams): Promise<ApiResponse<PageResult<AuthVeriCode>>> => {
    const response = await request.get<PageResult<AuthVeriCode>>('/auth_veri_codes/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteAuthVeriCode = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/auth_veri_codes/${idsString}`)
    return normalizeApiResponse(response)
  }
)
