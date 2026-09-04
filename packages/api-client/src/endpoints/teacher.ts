// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Teacher 跨端共享类型与端点函数
 *
 * 从 apps/miniapp-taro/src/api/index.ts 与 apps/mobile-rn Teacher screens 下沉,
 * 供 web/miniapp-taro/mobile-rn 等端复用,端内不重造业务逻辑。
 * 端点:GET /teacher/list、GET /teacher/:id、GET /teacher/:id/courses、
 *      GET /teacher/:id/reviews、POST /teacher/:id/follow
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

export interface Teacher {
  id: string | number
  name: string
  avatar?: string
  title?: string
  intro?: string
  courses?: number
  students?: number
  /** 粉丝数(GET /teacher/:id 返回) */
  fans?: number
  /** 评分(GET /teacher/:id 返回) */
  rating?: number
}

export type TeacherList = Teacher[]

/** 讲师主讲课程(price 单位:分,GET /teacher/:id/courses 返回) */
export interface TeacherCourse {
  id: string | number
  title: string
  coverUrl?: string
  price?: number
  students?: number
}

/** 学员评价(GET /teacher/:id/reviews 返回) */
export interface TeacherReview {
  id?: string | number
  nickname?: string
  avatar?: string
  rating?: number
  content?: string
  time?: string
}

/** 讲师列表查询参数(分页 + 关键词) */
export interface TeacherListQuery {
  page?: number
  pageSize?: number
  keyword?: string
}

/** 课程/评价接口响应兼容「数组」或「{ list }」两种返回结构 */
type ListRes<T> = T[] | { list?: T[] }

function normalizeList<T>(data: ListRes<T> | undefined): T[] {
  if (Array.isArray(data)) return data
  return data?.list ?? []
}

/** 讲师分页列表 — GET /teacher/list?page&pageSize&keyword */
export async function getTeacherList(
  query: TeacherListQuery = {},
): Promise<ApiResult<PageData<Teacher>>> {
  return fetchApi<PageData<Teacher>>(`/teacher/list${buildQs(query)}`)
}

/** 讲师详情 — GET /teacher/:id */
export async function getTeacherDetail(id: string | number): Promise<ApiResult<Teacher>> {
  return fetchApi<Teacher>(`/teacher/${encodeURIComponent(id)}`)
}

/** 讲师主讲课程 — GET /teacher/:id/courses(响应兼容数组与 { list } 两种结构) */
export async function getTeacherCourses(id: string | number): Promise<ApiResult<TeacherCourse[]>> {
  const res = await fetchApi<ListRes<TeacherCourse>>(`/teacher/${encodeURIComponent(id)}/courses`)
  if (!res.success) return res
  return { success: true, data: normalizeList(res.data) }
}

/** 讲师学员评价 — GET /teacher/:id/reviews(响应兼容数组与 { list } 两种结构) */
export async function getTeacherReviews(id: string | number): Promise<ApiResult<TeacherReview[]>> {
  const res = await fetchApi<ListRes<TeacherReview>>(`/teacher/${encodeURIComponent(id)}/reviews`)
  if (!res.success) return res
  return { success: true, data: normalizeList(res.data) }
}

/** 关注/取消关注讲师 — POST /teacher/:id/follow,body { follow } */
export async function followTeacher(
  id: string | number,
  follow: boolean,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/teacher/${encodeURIComponent(id)}/follow`, {
    method: 'POST',
    body: JSON.stringify({ follow }),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
