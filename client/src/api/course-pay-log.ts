import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface CoursePayLog {
  id?: string
  userId?: string
  courseId?: string
  coursePayId?: string
  payAmount?: number
  payMethod?: string
  payStatus?: number
  payTime?: string
  refundStatus?: number
  refundAmount?: number
  refundTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface CoursePayLogListParams extends PaginationParams {
  userId?: string
  courseId?: string
  coursePayId?: string
  payStatus?: number
  refundStatus?: number
  startTime?: string
  endTime?: string
}

export const updateCoursePayLog = withApiResponseHandler(
  async (data: CoursePayLog): Promise<ApiResponse<CoursePayLog>> => {
    const response = await request.put<CoursePayLog>('/coursePayLog', data)
    return normalizeApiResponse(response)
  }
)

export const createCoursePayLog = withApiResponseHandler(
  async (data: CoursePayLog): Promise<ApiResponse<CoursePayLog>> => {
    const response = await request.post<CoursePayLog>('/coursePayLog', data)
    return normalizeApiResponse(response)
  }
)

export const exportCoursePayLog = withApiResponseHandler(
  async (params?: CoursePayLogListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/coursePayLog/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getCoursePayLogDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<CoursePayLog>> => {
    const response = await request.get<CoursePayLog>(`/coursePayLog/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCoursePayLogList = withApiResponseHandler(
  async (params?: CoursePayLogListParams): Promise<ApiResponse<PaginationResponse<CoursePayLog>>> => {
    const response = await request.get<PaginationResponse<CoursePayLog>>('/coursePayLog/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteCoursePayLog = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/coursePayLog/${idsString}`)
    return normalizeApiResponse(response)
  }
)
