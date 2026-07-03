import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { ApiResponse, CourseItem, CourseListParams, CourseVideoItem, PageResult } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export async function getCourseList(
  adapter: SharedRequestAdapter,
  params: CourseListParams = {},
): Promise<ApiResponse<PageResult<CourseItem>>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.LIST,
    method: 'GET',
    params: { ...params },
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  const normalized = normalizeApiResponse<PageResult<CourseItem> | CourseItem[]>(response)
  const payload = normalized.data
  const list = Array.isArray(payload) ? payload : (payload as { list?: CourseItem[] })?.list || []
  const total = Array.isArray(payload) ? list.length : (payload as { total?: number })?.total || list.length
  const page = Array.isArray(payload) ? (params.page || params.pageNum || 1) : (payload as { page?: number })?.page || params.page || params.pageNum || 1
  const pageSize = Array.isArray(payload) ? (params.pageSize || list.length) : (payload as { pageSize?: number })?.pageSize || params.pageSize || 20
  return {
    ...normalized,
    data: { list, total, page, pageSize, totalPages: Math.ceil((total || 0) / (pageSize || 20)) },
  }
}

export async function getCourseDetail(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<CourseItem | null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.DETAIL(id),
    method: 'GET',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<CourseItem | null>(response)
}

export async function createCourse(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<CourseItem | null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.CREATE,
    method: 'POST',
    headers: { 'content-type': 'application/json', 'COURSE-PLATFORM': 'system_wechat' },
    data,
    base: 1,
  })
  return normalizeApiResponse<CourseItem | null>(response)
}

export async function updateCourse(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<CourseItem | null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.UPDATE,
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'COURSE-PLATFORM': 'system_wechat' },
    data,
    base: 1,
  })
  return normalizeApiResponse<CourseItem | null>(response)
}

export async function deleteCourse(
  adapter: SharedRequestAdapter,
  ids: string | number | Array<string | number>,
): Promise<ApiResponse<null>> {
  const idsStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.DELETE(idsStr),
    method: 'DELETE',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<null>(response)
}

export async function getVideoList(
  adapter: SharedRequestAdapter,
  params: CourseListParams = {},
): Promise<ApiResponse<PageResult<CourseVideoItem>>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_LIST,
    method: 'GET',
    params: { ...params },
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  const normalized = normalizeApiResponse<PageResult<CourseVideoItem> | CourseVideoItem[]>(response)
  const payload = normalized.data
  const list = Array.isArray(payload) ? payload : (payload as { list?: CourseVideoItem[] })?.list || []
  const total = Array.isArray(payload) ? list.length : (payload as { total?: number })?.total || list.length
  const page = Array.isArray(payload) ? (params.page || params.pageNum || 1) : (payload as { page?: number })?.page || params.page || params.pageNum || 1
  const pageSize = Array.isArray(payload) ? (params.pageSize || list.length) : (payload as { pageSize?: number })?.pageSize || params.pageSize || 20
  return {
    ...normalized,
    data: { list, total, page, pageSize, totalPages: Math.ceil((total || 0) / (pageSize || 20)) },
  }
}

export async function getVideoDetail(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<CourseVideoItem | null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_DETAIL(id),
    method: 'GET',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<CourseVideoItem | null>(response)
}

export async function createVideo(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<CourseVideoItem | null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_CREATE,
    method: 'POST',
    headers: { 'content-type': 'application/json', 'COURSE-PLATFORM': 'system_wechat' },
    data,
    base: 1,
  })
  return normalizeApiResponse<CourseVideoItem | null>(response)
}

export async function updateVideo(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<CourseVideoItem | null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_UPDATE,
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'COURSE-PLATFORM': 'system_wechat' },
    data,
    base: 1,
  })
  return normalizeApiResponse<CourseVideoItem | null>(response)
}

export async function deleteVideo(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_DELETE(id),
    method: 'DELETE',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<null>(response)
}

export async function issueVideo(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_ISSUE(id),
    method: 'POST',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<null>(response)
}

export async function delistCourse(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.DELIST(id),
    method: 'POST',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<null>(response)
}

export async function operateVideoLog(
  adapter: SharedRequestAdapter,
  videoId: string | number,
  type: string,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_OPERATE(videoId, type),
    method: 'GET',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<null>(response)
}

export async function deleteVideoLog(
  adapter: SharedRequestAdapter,
  ids: string,
): Promise<ApiResponse<null>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.COURSE.VIDEO_LOG(ids),
    method: 'DELETE',
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<null>(response)
}

export async function getVideoCommentList(
  adapter: SharedRequestAdapter,
  params: Record<string, unknown> = {},
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: '/userVideoComment/list',
    method: 'GET',
    params,
    base: 1,
    headers: { 'COURSE-PLATFORM': 'system_wechat' },
  })
  return normalizeApiResponse<unknown>(response)
}

export async function createVideoComment(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: '/userVideoComment',
    method: 'POST',
    headers: { 'content-type': 'application/json', 'COURSE-PLATFORM': 'system_wechat' },
    data,
    base: 1,
  })
  return normalizeApiResponse<unknown>(response)
}

export async function submitUserFeedback(
  adapter: SharedRequestAdapter,
  data: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: '/userFeedback',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data,
    base: 1,
  })
  return normalizeApiResponse<unknown>(response)
}

export async function getUserFeedbackList(
  adapter: SharedRequestAdapter,
  params: Record<string, unknown> = {},
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: '/userFeedback/list',
    method: 'GET',
    params,
    base: 1,
  })
  return normalizeApiResponse<unknown>(response)
}

export async function getCategoryParent(
  adapter: SharedRequestAdapter,
  ids: string,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: `/categoryDictionary/get/parent?ids=${ids}`,
    method: 'GET',
    base: 1,
  })
  return normalizeApiResponse<unknown>(response)
}