import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

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

export async function getCategories(): Promise<ApiResult<CourseCategory[]>> {
  return fetchApi<CourseCategory[]>('/api/course/categories')
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
