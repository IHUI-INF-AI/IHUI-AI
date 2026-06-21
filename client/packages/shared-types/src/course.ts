import type { PaginationParams } from './api'

export interface CourseItem {
  id?: string | number
  title?: string
  description?: string
  cover?: string
  category?: string
  categoryId?: string | number
  type?: string
  status?: number
  studentCount?: number
  rating?: number
  price?: number
  isFree?: boolean
  instructorId?: string
  instructorName?: string
  tags?: string[]
  createTime?: string
  updateTime?: string
  [key: string]: unknown
}

export interface CourseVideoItem {
  id?: string | number
  courseId?: string | number
  title?: string
  description?: string
  cover?: string
  videoUrl?: string
  duration?: number
  viewCount?: number
  likeCount?: number
  commentCount?: number
  sort?: number
  status?: number
  createTime?: string
  [key: string]: unknown
}

export interface CourseListParams extends PaginationParams {
  title?: string
  category?: string
  categoryId?: string | number
  type?: string
  status?: number
  COURSE_PLATFORM?: string
}

export interface VideoComment {
  id?: string | number
  videoId?: string | number
  userId?: string | number
  userName?: string
  avatar?: string
  content?: string
  parentId?: string | number
  likeCount?: number
  createTime?: string
  [key: string]: unknown
}

export interface HomePageResource {
  id?: string | number
  title?: string
  cover?: string
  description?: string
  type?: string
  url?: string
  position?: string
  sort?: number
  [key: string]: unknown
}
