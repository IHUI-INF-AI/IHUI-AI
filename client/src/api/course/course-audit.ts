import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

export interface CourseAudit {
  id?: string
  courseId?: string
  courseName?: string
  auditType?: string
  auditStatus?: number
  auditUserId?: string
  auditUserName?: string
  auditTime?: string
  auditRemark?: string
  submitUserId?: string
  submitTime?: string
  createdAt?: string
  updatedAt?: string
}

export interface CourseAuditListParams extends PaginationParams {
  courseId?: string
  auditType?: string
  auditStatus?: number
  auditUserId?: string
  startTime?: string
  endTime?: string
}

export const updateCourseAudit = withApiResponseHandler(
  async (data: CourseAudit): Promise<ApiResponse<CourseAudit>> => {
    const response = await request.put<CourseAudit>('/courseAudit', data)
    return normalizeApiResponse(response)
  }
)

export const createCourseAudit = withApiResponseHandler(
  async (data: CourseAudit): Promise<ApiResponse<CourseAudit>> => {
    const response = await request.post<CourseAudit>('/courseAudit', data)
    return normalizeApiResponse(response)
  }
)

export const exportCourseAudit = withApiResponseHandler(
  async (params?: CourseAuditListParams): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>('/courseAudit/export', params, {
      responseType: 'blob',
    })
    return normalizeApiResponse(response)
  }
)

export const getCourseAuditDetail = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<CourseAudit>> => {
    const response = await request.get<CourseAudit>(`/courseAudit/${id}`)
    return normalizeApiResponse(response)
  }
)

export const getCourseAuditList = withApiResponseHandler(
  async (params?: CourseAuditListParams): Promise<ApiResponse<PaginationResponse<CourseAudit>>> => {
    const response = await request.get<PaginationResponse<CourseAudit>>('/courseAudit/list', { params })
    return normalizeApiResponse(response)
  }
)

export const deleteCourseAudit = withApiResponseHandler(
  async (ids: string | string[]): Promise<ApiResponse<null>> => {
    const idsString = Array.isArray(ids) ? ids.join(',') : ids
    const response = await request.delete<null>(`/courseAudit/${idsString}`)
    return normalizeApiResponse(response)
  }
)
