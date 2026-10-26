// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生中心域端点(Wave2 2026-10-26 立)
 *
 * 覆盖端点(与 apps/web app/(main)/student/* 页面同契约,后端 apps/api 路由不动):
 * - GET    /api/edu/my-report            学习报告统计(web student/page.tsx:59)
 * - GET    /api/edu/my-lessons           我的课程分页(web student/my-lessons/page.tsx:55)
 * - GET    /api/comments/mine            我的评论分页(web student/my-comments/page.tsx:84)
 * - DELETE /api/comments/:id             删除我的评论(web student/my-comments/page.tsx:89)
 * - GET    /api/resources/mine           我上传的资源分页(web student/my-resources/page.tsx:60)
 * - DELETE /api/resources/:id            删除我的资源(web student/my-resources/page.tsx:65)
 * - GET    /api/edu/my-offline-records   线下学习记录列表(web student/offline-records/page.tsx:41)
 * - POST   /api/edu/offline-records      新建线下学习记录(同页 :63)
 * - PUT    /api/edu/offline-records/:id  更新线下学习记录(同页 :58)
 * - DELETE /api/edu/offline-records/:id  删除线下学习记录(同页 :73)
 *
 * 报告导出(POST /api/edu/my-report/export)已由 endpoints/edu.ts 封装
 * (exportMyReport / exportMyReportJson),本文件不重复封装,消费侧直接复用。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 学习报告 =====================

/** 学习报告统计(对齐 web student/page.tsx Report 结构)。 */
export interface StudentReport {
  lessons: { total: number; completed: number; inProgress: number; avgProgress: number }
  exams: { total: number; passed: number; avgScore: number }
  certificates: { total: number }
}

/** 获取学习报告统计 — GET /api/edu/my-report */
export async function getMyReport(): Promise<ApiResult<StudentReport>> {
  return fetchApi<StudentReport>('/api/edu/my-report')
}

// ===================== 我的课程 =====================

/** 我的课程行(对齐 web my-lessons/page.tsx MyLesson;status: 1 进行中 / 2 已完成 / 3 已退款)。 */
export interface MyLessonRow {
  id: string
  lessonId: string
  title: string
  coverImage: string | null
  progress: number
  status: number
}

/** 我的课程分页列表 — GET /api/edu/my-lessons?page&pageSize */
export async function getMyLessons(
  query: PageQuery = {},
): Promise<ApiResult<PageData<MyLessonRow>>> {
  return fetchApi<PageData<MyLessonRow>>(`/api/edu/my-lessons${buildQs(query)}`)
}

// ===================== 我的评论 =====================

/** 我的评论行(对齐 web my-comments/page.tsx MyComment;targetType: article/news/resource/lesson/ask)。 */
export interface MyCommentRow {
  id: string
  content: string
  targetId: string
  targetType: string
  targetTitle?: string | null
  createdAt: string
}

/** 我的评论分页列表 — GET /api/comments/mine?page&pageSize */
export async function getMyComments(
  query: PageQuery = {},
): Promise<ApiResult<PageData<MyCommentRow>>> {
  return fetchApi<PageData<MyCommentRow>>(`/api/comments/mine${buildQs(query)}`)
}

/** 删除我的评论 — DELETE /api/comments/:id */
export async function deleteMyComment(id: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/comments/${id}`, { method: 'DELETE' })
}

// ===================== 我的资源 =====================

/** 我上传的资源行(对齐 web my-resources/page.tsx MyResource;status: 0 待审核 / 1 已发布 / 2 已下架 / 3 已驳回)。 */
export interface MyResourceRow {
  id: string
  title: string
  description?: string | null
  fileType?: string | null
  fileSize?: number | null
  viewCount: number
  downloadCount: number
  status: number
  createdAt: string
}

/** 我上传的资源分页列表 — GET /api/resources/mine?page&pageSize */
export async function getMyResources(
  query: PageQuery = {},
): Promise<ApiResult<PageData<MyResourceRow>>> {
  return fetchApi<PageData<MyResourceRow>>(`/api/resources/mine${buildQs(query)}`)
}

/** 删除我的资源 — DELETE /api/resources/:id */
export async function deleteMyResource(id: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/resources/${id}`, { method: 'DELETE' })
}

// ===================== 线下学习记录 =====================

/** 线下学习记录附件(对齐 web components/form/AttachmentsUpload AttachmentItem)。 */
export interface OfflineRecordAttachment {
  url: string
  name: string
  type: string
  size: number
}

/** 线下学习记录(对齐 web student/offline-records/types.ts OfflineRecord)。 */
export interface OfflineRecord {
  id: string
  type: string
  title: string
  description: string | null
  hours: number | null
  occurredAt: string | null
  attachments: OfflineRecordAttachment[]
}

/** 新建/更新线下学习记录载荷(对齐 web offline-records/page.tsx:49-56 请求体)。 */
export interface OfflineRecordInput {
  type: string
  title: string
  description?: string
  hours?: number
  occurredAt?: string
  attachments?: OfflineRecordAttachment[]
}

/** 线下学习记录列表 — GET /api/edu/my-offline-records
 * 载荷可能是裸数组或 { list }(web 端 page.tsx:41-43 做同款防御归一,RN 消费侧沿用)。 */
export async function getMyOfflineRecords(): Promise<
  ApiResult<OfflineRecord[] | { list?: OfflineRecord[] }>
> {
  return fetchApi<OfflineRecord[] | { list?: OfflineRecord[] }>('/api/edu/my-offline-records')
}

/** 新建线下学习记录 — POST /api/edu/offline-records */
export async function createOfflineRecord(input: OfflineRecordInput): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/edu/offline-records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新线下学习记录 — PUT /api/edu/offline-records/:id */
export async function updateOfflineRecord(
  id: string,
  input: OfflineRecordInput,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/edu/offline-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除线下学习记录 — DELETE /api/edu/offline-records/:id */
export async function deleteOfflineRecord(id: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/edu/offline-records/${id}`, { method: 'DELETE' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
