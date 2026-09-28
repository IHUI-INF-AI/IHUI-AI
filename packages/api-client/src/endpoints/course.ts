// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export interface Course {
  id: string
  title: string
  cover: string | null
  description: string
  categoryId: string
  categoryName: string
  instructor: string
  instructorAvatar: string | null
  price: number
  originalPrice: number | null
  lessonCount: number
  studentCount: number
  rating: number
  level: string
  tags: string[]
  isEnrolled: boolean
  isFree: boolean
  createdAt: string
  updatedAt: string
}

export interface CourseCategory {
  id: string
  name: string
  icon: string | null
  sort: number
  courseCount: number
}

export interface CourseProgress {
  courseId: string
  totalLessons: number
  completedLessons: number
  progress: number
  lastLearnedAt: string | null
  lessons: LessonProgress[]
}

export interface LessonProgress {
  lessonId: string
  title: string
  isCompleted: boolean
  lastPosition: number
}

export type CourseListQuery = {
  page?: number
  pageSize?: number
  categoryId?: string
  keyword?: string
  level?: string
  sort?: string
}

export async function getCourses(
  query: CourseListQuery = {},
): Promise<ApiResult<PageData<Course>>> {
  return fetchApi<PageData<Course>>(`/api/course${buildQs(query)}`)
}

export async function getCourseById(id: string): Promise<ApiResult<Course>> {
  return fetchApi<Course>(`/api/course/${encodeURIComponent(id)}`)
}

/** 课程(学习)分类列表
 * 门 8 死调用清账(2026-09-28):上一版 GET /api/course/categories 从未注册;真路由 =
 * GET /learn/categories(learn.ts:555,公开,返回 { list })。O87b 实测过该端点回真实分类行。
 * 解包成数组是为守住本函数既有签名(消费方 category.ts:51 直接把 data 当 CategoryNode[] 用)。 */
export async function getCategories(): Promise<ApiResult<CourseCategory[]>> {
  const res = await fetchApi<{ list: CourseCategory[] }>('/api/learn/categories')
  return res.success ? { ...res, data: res.data.list } : res
}

export async function enrollCourse(id: string): Promise<ApiResult<{ enrolled: boolean }>> {
  return fetchApi<{ enrolled: boolean }>(`/api/course/${encodeURIComponent(id)}/enroll`, {
    method: 'POST',
  })
}

export async function getProgress(id: string): Promise<ApiResult<CourseProgress>> {
  return fetchApi<CourseProgress>(`/api/course/${encodeURIComponent(id)}/progress`)
}

export async function completeLesson(input: {
  courseId: string
  lessonId: string
}): Promise<ApiResult<{ completed: boolean }>> {
  return fetchApi<{ completed: boolean }>('/api/course/lesson-complete', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getMyCourses(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<Course>>> {
  return fetchApi<PageData<Course>>(`/api/course/my${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
