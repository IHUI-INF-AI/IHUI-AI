import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { API_ENDPOINTS } from '@/config/swagger-endpoints'

export interface ZhsAgent {
  id?: string
  uuid?: string
  name?: string
  description?: string
  avatar?: string
  category?: string
  price?: number
  status?: number
  developerUuid?: string
  developerName?: string
  createdAt?: string
  updatedAt?: string
}

export interface ZhsAgentListParams extends PaginationParams {
  name?: string
  category?: string
  status?: number
  developerUuid?: string
  startDate?: string
  endDate?: string
}

export const createZhsAgent = withApiResponseHandler(
  async (data: ZhsAgent): Promise<ApiResponse<ZhsAgent>> => {
    const response = await request.post<ZhsAgent>(API_ENDPOINTS.agent.create, data)
    return normalizeApiResponse(response)
  }
)

export const updateZhsAgent = withApiResponseHandler(
  async (data: ZhsAgent): Promise<ApiResponse<ZhsAgent>> => {
    const response = await request.put<ZhsAgent>(API_ENDPOINTS.agent.update, data)
    return normalizeApiResponse(response)
  }
)

/** 与 Java 后端 8080 /ai-program/zhsAgent/list 一致，分页参数以后端 Swagger 为准（常见为 pageNum、pageSize） */
export const getZhsAgentList = withApiResponseHandler(
  async (params?: ZhsAgentListParams): Promise<ApiResponse<PaginationResponse<ZhsAgent>>> => {
    const response = await request.get(API_ENDPOINTS.agent.list, { params })
    interface ZhsAgentListResponse {
      list: ZhsAgent[]
      total: number
      page: number
      pageSize: number
    }
    const normalizedResponse = normalizeApiResponse<ZhsAgentListResponse>(response)
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const pageSize = normalizedResponse.data?.pageSize || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as ZhsAgent[],
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

export const getZhsAgentDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<ZhsAgent>> => {
    const response = await request.get<ZhsAgent>(API_ENDPOINTS.agent.detail.replace('{id}', id))
    return normalizeApiResponse(response)
  }
)

export const deleteZhsAgent = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(API_ENDPOINTS.agent.delete.replace('{ids}', idsString))
    return normalizeApiResponse(response)
  }
)

export const deleteZhsAgentById = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<null>> => {
    const response = await request.delete<null>(API_ENDPOINTS.agent.delete.replace('{ids}', id))
    return normalizeApiResponse(response)
  }
)

export const exportZhsAgent = withApiResponseHandler(
  async (params?: ZhsAgentListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>(API_ENDPOINTS.agent.export, params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)
