import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface UserAgentContext {
  id?: string
  userId?: string
  agentId?: string
  contextType?: string
  contextData?: string
  status?: number
  createdAt?: string
  updatedAt?: string
}

export interface UserAgentContextListParams extends PaginationParams {
  userId?: string
  agentId?: string
  contextType?: string
  status?: number
  startTime?: string
  endTime?: string
}

export const updateUserAgentContext = withApiResponseHandler(
  async (data: UserAgentContext): Promise<ApiResponse<UserAgentContext>> => {
    const response = await request.put<UserAgentContext>('/userAgentContext', data)
    return normalizeApiResponse(response)
  }
)

export const createUserAgentContext = withApiResponseHandler(
  async (data: UserAgentContext): Promise<ApiResponse<UserAgentContext>> => {
    const response = await request.post<UserAgentContext>('/userAgentContext', data)
    return normalizeApiResponse(response)
  }
)

export const exportUserAgentContext = withApiResponseHandler(
  async (params?: UserAgentContextListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/userAgentContext/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getUserAgentContextDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<UserAgentContext>> => {
    const response = await request.get<UserAgentContext>(`/userAgentContext/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getUserAgentContextList = withApiResponseHandler(
  async (params?: UserAgentContextListParams): Promise<ApiResponse<PaginationResponse<UserAgentContext>>> => {
    const response = await request.get<PaginationResponse<UserAgentContext>>('/userAgentContext/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteUserAgentContext = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/userAgentContext/${idsString}`)
    return normalizeApiResponse(response)
  }
)
