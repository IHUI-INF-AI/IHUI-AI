import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface ZhsActivity {
  id?: string
  uuid?: string
  title?: string
  description?: string
  startTime?: string
  endTime?: string
  status?: number
  imageUrl?: string
  createdAt?: string
  updatedAt?: string
}

export interface ZhsActivityListParams extends PaginationParams {
  title?: string
  status?: number
  startDate?: string
  endDate?: string
}

export const createZhsActivity = withApiResponseHandler(
  async (data: ZhsActivity): Promise<ApiResponse<ZhsActivity>> => {
    const response = await request.post<ZhsActivity>('/zhs_activity', data)
    return normalizeApiResponse(response)
  }
)

export const updateZhsActivity = withApiResponseHandler(
  async (data: ZhsActivity): Promise<ApiResponse<ZhsActivity>> => {
    const response = await request.put<ZhsActivity>('/zhs_activity', data)
    return normalizeApiResponse(response)
  }
)

export const getZhsActivityList = withApiResponseHandler(
  async (params?: ZhsActivityListParams): Promise<ApiResponse<PaginationResponse<ZhsActivity>>> => {
    const response = await request.get('/zhs_activity/list', { params })
    interface ZhsActivityListResponse {
      list: ZhsActivity[]
      total: number
      page: number
      pageSize: number
    }
    const normalizedResponse = normalizeApiResponse<ZhsActivityListResponse>(response)
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const pageSize = normalizedResponse.data?.pageSize || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as ZhsActivity[],
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

export const getZhsActivityDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<ZhsActivity>> => {
    const response = await request.get<ZhsActivity>(`/zhs_activity/${id}`)
    return normalizeApiResponse(response)
  }
)

export const deleteZhsActivity = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/zhs_activity/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const exportZhsActivity = withApiResponseHandler(
  async (params?: ZhsActivityListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/zhs_activity/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const updateZhsActivityStatus = withApiResponseHandler(
  async (data: { id: string; status: number }): Promise<ApiResponse<null>> => {
    const response = await request.post<null>('/zhs_activity/activityStatus', data)
    return normalizeApiResponse(response)
  }
)
