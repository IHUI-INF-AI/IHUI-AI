import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface CoursePay {
  id?: string
  courseId?: string
  courseName?: string
  price?: number
  originalPrice?: number
  discountType?: string
  discountValue?: number
  status?: number
  startTime?: string
  endTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface CoursePayListParams extends PaginationParams {
  courseId?: string
  status?: number
  startTime?: string
  endTime?: string
}

export const updateCoursePay = withApiResponseHandler(
  async (data: CoursePay): Promise<ApiResponse<CoursePay>> => {
    const response = await request.put<CoursePay>('/coursePay', data)
    return normalizeApiResponse(response)
  }
)

export const createCoursePay = withApiResponseHandler(
  async (data: CoursePay): Promise<ApiResponse<CoursePay>> => {
    const response = await request.post<CoursePay>('/coursePay', data)
    return normalizeApiResponse(response)
  }
)

export const exportCoursePay = withApiResponseHandler(
  async (params?: CoursePayListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/coursePay/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getCoursePayDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<CoursePay>> => {
    const response = await request.get<CoursePay>(`/coursePay/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCoursePayList = withApiResponseHandler(
  async (params?: CoursePayListParams): Promise<ApiResponse<PaginationResponse<CoursePay>>> => {
    const response = await request.get<PaginationResponse<CoursePay>>('/coursePay/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteCoursePay = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/coursePay/${idsString}`)
    return normalizeApiResponse(response)
  }
)
