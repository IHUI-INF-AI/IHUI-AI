import { COURSES_API_PATHS, COURSE_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

import request from '@/utils/request'
import { isDemoMode } from '@/utils/envUtils'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { logger } from '@/utils/logger'

// 课程接口
export interface Course {
  id: string
  title: string
  description: string
  cover: string
  category: string
  categoryId?: string
  level: 'beginner' | 'intermediate' | 'advanced'
  duration: number // 分钟
  lessonCount: number
  studentCount: number
  rating: number
  ratingCount: number
  price: number
  isFree: boolean
  instructor: {
    id: string
    name: string
    avatar: string
    bio?: string
  }
  tags?: string[]
  createTime: string
  updateTime: string
  isEnrolled?: boolean
  progress?: number // 学习进度 0-100
}

// 课程章节接口
export interface CourseLesson {
  id: string
  courseId: string
  title: string
  description?: string
  videoUrl?: string
  duration: number // 秒
  order: number
  isFree: boolean
  isCompleted?: boolean
  createTime: string
}

// 课程分类接口
export interface CourseCategory {
  id: string
  name: string
  description?: string
  icon?: string
  count?: number
}

// 获取课程列表
export async function getCoursesList(
  params: PaginationParams & {
    category?: string
    keyword?: string
    level?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
): Promise<ApiResponse<PaginationResponse<Course>>> {
  try {
    if (isDemoMode()) {
      const list: Course[] = Array.from({ length: 6 }).map((_, idx) => ({
        id: `course-${idx + 1}`,
        title: `演示课程 ${idx + 1}`,
        description: t('text.courses.演示课程描述展示13'),
        cover: '/images/demo/course.png',
        level: 'beginner',
        category: 'ai-basics',
        duration: 180, // 分钟
        lessonCount: 12,
        studentCount: 2000 + idx * 50,
        rating: 4.6,
        ratingCount: 120 + idx * 5,
        instructor: {
          id: `teacher-${idx + 1}`,
          name: '演示讲师',
          avatar: '/images/demo/avatar.png',
        },
        price: 0,
        isFree: true,
        isEnrolled: false,
        tags: ['演示', 'AI'],
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: t('api.courses.演示数据'),
        data: {
          list,
          pagination: {
            page: params.page || 1,
            pageSize: params.pageSize || 20,
            total: list.length,
            totalPages: 1,
          },
        },
        timestamp: Date.now(),
      }
    }

    const response = await request.get(COURSES_API_PATHS.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.courses.获取成功1'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取课程列表失败',
      data: {
        list: [],
        pagination: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取课程详情
export async function getCourseDetail(
  id: string
): Promise<ApiResponse<Course & { lessons: CourseLesson[] }>> {
  try {
    const response = await request.get(COURSES_API_PATHS.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.courses.获取成功2'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取课程详情失败',
      data: {} as Course & { lessons: CourseLesson[] },
      timestamp: Date.now(),
    }
  }
}

// 获取课程分类
export async function getCourseCategories(): Promise<ApiResponse<CourseCategory[]>> {
  try {
    if (isDemoMode()) {
      return {
        code: 200,
        success: true,
        message: t('api.courses.演示数据3'),
        data: [
          { id: 'all', name: '全部' },
          { id: 'ai-basics', name: 'AI基础' },
          { id: 'ai-applications', name: 'AI应用' },
          { id: 'ai-development', name: 'AI开发' },
          { id: 'business', name: '商业应用' },
        ],
        timestamp: Date.now(),
      }
    }

    const response = await request.get(COURSES_API_PATHS.categories)
    return {
      code: 200,
      success: true,
      message: t('api.courses.获取成功4'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.warn('[Courses] Failed to get course categories, returning default:', {
      error: error instanceof Error ? error.message : String(error),
    })
    // 返回默认分类
    return {
      code: 200,
      success: true,
      message: t('api.courses.获取成功5'),
      data: [
        { id: 'all', name: '全部' },
        { id: 'ai-basics', name: 'AI基础' },
        { id: 'ai-applications', name: 'AI应用' },
        { id: 'ai-development', name: 'AI开发' },
        { id: 'business', name: '商业应用' },
      ],
      timestamp: Date.now(),
    }
  }
}

// 报名课程
export async function enrollCourse(courseId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.post(COURSES_API_PATHS.enroll(courseId))
    return {
      code: 200,
      success: true,
      message: t('api.courses.报名成功6'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '报名失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取学习进度
export async function getCourseProgress(
  courseId: string
): Promise<ApiResponse<{ progress: number; completedLessons: string[] }>> {
  try {
    const response = await request.get(COURSES_API_PATHS.progress(courseId))
    return {
      code: 200,
      success: true,
      message: t('api.courses.获取成功7'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取学习进度失败',
      data: { progress: 0, completedLessons: [] },
      timestamp: Date.now(),
    }
  }
}

// 标记课程完成
export async function completeLesson(
  courseId: string,
  lessonId: string
): Promise<ApiResponse<boolean>> {
  try {
    await request.post(COURSES_API_PATHS.lessonComplete(courseId, lessonId))
    return {
      code: 200,
      success: true,
      message: t('api.courses.完成成功8'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '标记失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取我的课程
export async function getMyCourses(
  params?: PaginationParams
): Promise<ApiResponse<PaginationResponse<Course>>> {
  try {
    const response = await request.get(COURSES_API_PATHS.my, { params })
    return {
      code: 200,
      success: true,
      message: t('api.courses.获取成功9'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取我的课程失败',
      data: {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 更新课程
export async function updateCourse(
  data: Partial<Course>
): Promise<ApiResponse<Course>> {
  try {
    const response = await request.put(COURSE_PATHS.update, data)
    return {
      code: 200,
      success: true,
      message: t('api.courses.更新成功10'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新课程失败',
      data: {} as Course,
      timestamp: Date.now(),
    }
  }
}

// 导出课程
export async function exportCourses(
  params?: PaginationParams & {
    category?: string
    keyword?: string
    level?: string
  }
): Promise<ApiResponse<Blob>> {
  try {
    const response = await request.post(COURSE_PATHS.export, params, { responseType: 'blob' })
    return {
      code: 200,
      success: true,
      message: t('api.courses.导出成功11'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出课程失败',
      data: new Blob(),
      timestamp: Date.now(),
    }
  }
}

// 删除课程
export async function deleteCourses(
  ids: string
): Promise<ApiResponse<void>> {
  try {
    await request.delete(COURSE_PATHS.delete(ids))
    return {
      code: 200,
      success: true,
      message: t('api.courses.删除成功12'),
      data: undefined,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除课程失败',
      data: undefined,
      timestamp: Date.now(),
    }
  }
}
