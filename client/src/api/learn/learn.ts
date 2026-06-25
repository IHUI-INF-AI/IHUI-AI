/**
 * 课程学习 API 客户端
 * 适配 g:\1\server 后端:
 *   - /course/* 课程 CRUD
 *   - /courseVideo/* 课程视频
 *   - /educationPlatform/* 学习平台
 *   - /userVideoLog/* 学习记录
 *   - /userVideoComment/* 评论
 *   - /coursePayLog/* 支付记录
 */
import http from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

export interface LearnCategory {
  id: number | string
  name: string
  parentId?: number | string
  sort?: number
  icon?: string
}

export interface Lesson {
  id: string
  name: string
  title?: string
  description?: string
  image?: string
  cover?: string
  price: number
  originalPrice?: number
  isFree?: boolean
  learnNum?: number
  signUpNum?: number
  subscribeNum?: number
  likeCount?: number
  favoriteCount?: number
  watchCount?: number
  duration?: number
  level?: string
  lecturer?: string
  teacherName?: string
  categoryId?: number | string
  categoryName?: string
  status?: string
  isTop?: boolean
  isEssence?: boolean
  phrase?: string
  signUp?: { status: string; progress?: number }
  createTime?: string
  updateTime?: string
}

export interface Chapter {
  id: string
  lessonId: string
  name: string
  order: number
  videoList?: Lesson[]
}

export interface SignUp {
  id: string
  lessonId: string
  userId: string
  status: 'signing_up' | 'completed' | 'cancel_sign_up'
  progress: number
  createTime: string
}

export interface LearnRecord {
  id: string
  lessonId: string
  userId: string
  duration: number
  progress: number
  lastTime: string
}

export interface LessonOrder {
  id: string
  lessonId: string
  userId: string
  amount: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  payType?: string
  createTime: string
  payTime?: string
}

export interface Certificate {
  id: string
  lessonId: string
  userId: string
  name: string
  issueTime: string
  image?: string
}

export interface Homework {
  id: string
  lessonId: string
  chapterId?: string
  title: string
  content: string
  deadline?: string
  submitStatus?: 'pending' | 'submitted' | 'graded'
  score?: number
}

export interface Comment {
  id: string
  lessonId: string
  userId: string
  userName: string
  content: string
  rating: number
  createTime: string
}

export const learnApi = {
  // 课程分类 - 缓存 5 分钟，分类不常变化
  categories: () =>
    defaultCache.wrap(
      '/learn/category/list',
      () => http.get<ApiResponse<LearnCategory[]>>('/learn/category/list'),
      undefined,
      5 * 60 * 1000
    ),
  categoryTree: () =>
    defaultCache.wrap(
      '/learn/category/tree',
      () => http.get<ApiResponse<LearnCategory[]>>('/learn/category/tree'),
      undefined,
      5 * 60 * 1000
    ),

  // 课程(对接 /course 后端)
  list: (params?: PaginationParams & { title?: string; categoryId?: string; level?: string }) =>
    http.get<ApiResponse<PaginationResponse<Lesson>>>('/course/list', { params }),
  detail: (id: string) => http.get<ApiResponse<Lesson>>(`/course/${id}`),
  recommend: (params?: { limit?: number }) =>
    http.get<ApiResponse<Lesson[]>>('/learn/lesson/recommend', { params }),

  // 课程视频(对接 /courseVideo 后端)
  videoList: (params: { courseId?: string }) =>
    http.get<ApiResponse<Lesson[]>>('/courseVideo/list', { params }),
  videoDetail: (id: string) => http.get<ApiResponse<Lesson>>(`/courseVideo/${id}`),

  // 章节
  chapterList: (lessonId: string) =>
    http.get<ApiResponse<Chapter[]>>(`/learn/chapter/list`, { params: { lessonId } }),

  // 报名(sign-up)
  signUp: (lessonId: string) => http.post<ApiResponse<SignUp>>('/learn/sign-up', { lessonId }),
  cancelSignUp: (lessonId: string) =>
    http.delete<ApiResponse<void>>('/learn/sign-up', { params: { lessonId } }),

  // 学习记录
  recordSave: (data: { lessonId: string; duration: number; progress: number }) =>
    http.post<ApiResponse<LearnRecord>>('/learn/record', data),
  recordUpdate: (data: { lessonId: string; progress: number; lastTime?: string }) =>
    http.put<ApiResponse<LearnRecord>>('/learn/record', data),
  recordList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<LearnRecord>>>('/learn/record/list', { params }),
  totalLearnTime: () => http.get<ApiResponse<{ total: number }>>('/learn/sign-up/total-learn-time'),
  todayLearnTime: () => http.get<ApiResponse<{ total: number }>>('/learn/sign-up/today-learn-time'),

  // 订单 / 支付
  createOrder: (data: { lessonId: string; payType?: string }) =>
    http.post<ApiResponse<LessonOrder>>('/learn/lesson/order', data),
  payOrder: (data: { orderId: string; payType: string }) =>
    http.post<ApiResponse<LessonOrder>>('/learn/lesson/order/payment', data),
  orderList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<LessonOrder>>>('/learn/lesson/order/list', { params }),

  // 收藏
  favoriteList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<Lesson>>>('/learn/lesson/favorite/list', { params }),
  toggleFavorite: (lessonId: string) =>
    http.post<ApiResponse<{ isFavorite: boolean }>>('/learn/lesson/favorite', { lessonId }),

  // 证书
  certificateList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<Certificate>>>('/learn/certificate/list', { params }),
  certificateDetail: (id: string) =>
    http.get<ApiResponse<Certificate>>(`/learn/certificate/${id}`),

  // 作业
  homeworkList: (params?: PaginationParams & { lessonId?: string }) =>
    http.get<ApiResponse<PaginationResponse<Homework>>>('/learn/homework/list', { params }),

  // 评论 / 评分
  commentList: (lessonId: string, params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<Comment>>>('/learn/comment/list', {
      params: { lessonId, ...params },
    }),
  commentSubmit: (data: { lessonId: string; content: string; rating: number }) =>
    http.post<ApiResponse<Comment>>('/learn/comment', data),

  // 专题课程
  topicList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<Lesson>>>('/learn/topic/list', { params }),
  topicDetail: (id: string) => http.get<ApiResponse<Lesson>>(`/learn/topic/${id}`),

  // 学习地图
  mapList: () => http.get<ApiResponse<LearnCategory[]>>('/learn/map/list'),
  mapDetail: (id: string) => http.get<ApiResponse<LearnCategory>>(`/learn/map/${id}`),
}

export default learnApi
