/**
 * 课程管理API（管理后台）
 * 对应后端路由：/course
 * 注意：此文件用于管理后台的课程管理，与courses.ts（用户端课程）不同
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface Course {
  id?: string
  title?: string
  description?: string
  cover?: string
  category?: string
  categoryId?: string
  level?: string
  duration?: number
  lessonCount?: number
  studentCount?: number
  rating?: number
  ratingCount?: number
  price?: number
  isFree?: boolean
  status?: number
  instructorId?: string
  instructorName?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface CourseListParams extends PaginationParams {
  title?: string
  category?: string
  categoryId?: string
  level?: string
  status?: number
  instructorId?: string
  startTime?: string
  endTime?: string
}

export const createCourse = withApiResponseHandler(
  async (data: Course): Promise<ApiResponse<Course>> => {
    const response = await request.post<Course>('/course', data)
    return normalizeApiResponse(response)
  }
)

export const updateCourse = withApiResponseHandler(
  async (data: Course): Promise<ApiResponse<Course>> => {
    const response = await request.put<Course>('/course', data)
    return normalizeApiResponse(response)
  }
)

export const getCourseList = withApiResponseHandler(
  async (params?: CourseListParams): Promise<ApiResponse<PaginationResponse<Course>>> => {
    const response = await request.get('/course/list', { params })
    interface CourseListResponse {
      list: Course[]
      total: number
      page: number
      pageSize: number
    }
    const normalizedResponse = normalizeApiResponse<CourseListResponse>(response)
    const data = normalizedResponse.data?.list || []
    const total = normalizedResponse.data?.total || data.length
    const page = normalizedResponse.data?.page || params?.page || 1
    const pageSize = normalizedResponse.data?.pageSize || params?.pageSize || 20

    return {
      ...normalizedResponse,
      data: {
        list: (Array.isArray(data) ? data : []) as Course[],
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

export const getCourseDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<Course>> => {
    const response = await request.get<Course>(`/course/${id}`)
    return normalizeApiResponse(response)
  }
)

export const deleteCourse = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/course/${idsString}`)
    return normalizeApiResponse(response)
  }
)

export const exportCourse = withApiResponseHandler(
  async (params?: CourseListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/course/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)
