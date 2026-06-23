/**
 * 会员中心 API 客户端
 * 适配 g:\1\server 后端:
 *   - /user/* 账号
 *   - /point/* 积分
 *   - /exam/* 考试记录
 *   - /ask/* 我的问答
 *   - /circle/* 我的圈子
 *   - /course/* 我的课程
 *   - /message/* 我的消息
 *   - /favorites/* 收藏
 *   - /userFollow/* 关注
 *   - /userFans/* 粉丝
 *   - /userComment/* 评论
 *   - /resource/* 资源
 *   - /article/* 文章
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import type { Comment } from '@/api/community'
import type { Certificate } from '@/api/learn'

export interface MemberProfile {
  id: string
  name: string
  nickName?: string
  realName?: string
  avatar?: string
  phone?: string
  email?: string
  gender?: 'male' | 'female' | 'unknown'
  birthday?: string
  bio?: string
  school?: string
  profession?: string
  level?: number
  vipLevel?: number
  vipExpireTime?: string
  pointTotal?: number
  learnDays?: number
  createTime?: string
}

export interface PointLog {
  id: string
  userId: string
  action: string
  ruleName?: string
  point: number
  description?: string
  refType?: string
  refId?: string
  createTime: string
}

export type { ExamPaper, ExamQuestion, ExamRecord } from '@/api/exam'

export interface FollowUser {
  id: string | number
  userId: string
  userName?: string
  avatar?: string
  isFollowing?: boolean
}

export interface MemberExamSignUp {
  id: number
  paperId: number
  paperTitle?: string
  userId: string
  status: 'signing_up' | 'completed' | 'cancel_sign_up'
  score?: number
  totalScore?: number
  passScore?: number
  passed?: boolean
  duration?: number
  startTime?: string
  submitTime?: string
}

export interface MemberExamWrong {
  id: number
  paperId: number
  paperTitle?: string
  questionId: number
  questionTitle?: string
  userAnswer?: string
  correctAnswer?: string
  analysis?: string
  createTime: string
}

export const memberApi = {
  profile: () => http.get<ApiResponse<MemberProfile>>('/user/profile'),
  updateProfile: (data: Partial<MemberProfile>) => http.put<ApiResponse<MemberProfile>>('/user/profile', data),
  uploadAvatar: (file: FormData) =>
    http.post<ApiResponse<{ url: string }>>('/user/upload/avatar', file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  changePassword: (data: { oldPwd: string; newPwd: string }) =>
    http.post<ApiResponse<void>>('/user/change-password', data),
  bindPhone: (data: { phone: string; code: string }) =>
    http.post<ApiResponse<void>>('/user/bind-phone', data),
  bindEmail: (data: { email: string; code: string }) =>
    http.post<ApiResponse<void>>('/user/bind-email', data),

  setting: () => http.get<ApiResponse<Record<string, unknown>>>('/user/setting'),
  updateSetting: (data: Record<string, unknown>) => http.put<ApiResponse<void>>('/user/setting', data),

  vipList: () => http.get<ApiResponse<unknown[]>>('/user/vip/list'),
  vipBuy: (data: { level: number; payType: string }) =>
    http.post<ApiResponse<{ orderId: string }>>('/user/vip/buy', data),

  pointAccount: () => http.get<ApiResponse<{ total: number; available: number; frozen: number; used: number; level: number }>>('/point/account'),
  pointLog: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<PointLog>>>('/point/log/list', { params }),
  pointTodaySign: () => http.post<ApiResponse<{ point: number; continuous: number }>>('/point/today-sign'),
  pointSignStatus: () => http.post<ApiResponse<{ signed: boolean; continuous: number }>>('/point/sign-status'),

  learnRecord: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/user/video/log/list', { params }),
  learnRecordSave: (data: { lessonId: string; duration: number; progress: number }) =>
    http.post<ApiResponse<unknown>>('/user/video/log', data),
  learnStat: () =>
    http.get<ApiResponse<{ totalDays: number; totalMinutes: number; continuousDays: number; todayMinutes: number }>>(
      '/user/learn/stat'
    ),

  signUps: (params?: Record<string, unknown>) => import('@/api/exam').then((m) => m.examApi.records(params)),
  records: (params?: Record<string, unknown>) => import('@/api/exam').then((m) => m.examApi.records(params)),
  recordDetail: (id: number | string) => import('@/api/exam').then((m) => m.examApi.recordDetail(Number(id))),
  wrongList: (params?: Record<string, unknown>) => import('@/api/exam').then((m) => m.examApi.wrongList(params)),
  markWrongMastered: (id: number | string) =>
    import('@/api/exam').then((m) => m.examApi.markWrongMastered(Number(id))),

  myAskList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/ask/my-list', { params }),
  myAskDetail: (id: string | number) => http.get<ApiResponse<unknown>>(`/ask/${id}`),
  myAskReply: (data: { askId: string | number; content: string }) =>
    http.post<ApiResponse<unknown>>('/ask/reply', data),

  circleList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/circle/list', { params }),
  circleDynamicList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/circle/dynamic/list', { params }),
  circleCreate: (data: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/circle/create', data),

  articleList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/article/list', { params }),
  articleDetail: (id: string | number) => http.get<ApiResponse<unknown>>(`/article/${id}`),

  messageList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/message/list', { params }),
  messageUnread: () => http.get<ApiResponse<{ unread: number }>>('/message/unread'),

  favoritesList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/user/favorites', { params }),
  favoritesAdd: (id: string | number) => http.post<ApiResponse<unknown>>('/user/favorites', { id }),
  favoritesRemove: (id: string | number) => http.delete<ApiResponse<void>>(`/user/favorites/${id}`),

  followList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/userFollow/list', { params }),
  fanList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/userFans/list', { params }),
  follow: (id: string | number) => http.post<ApiResponse<void>>('/userFollow/' + id),
  unfollow: (id: string | number) => http.delete<ApiResponse<void>>('/userFollow/' + id),

  commentList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/userComment/list', { params }),
  commentCreate: (data: { refType: string; refId: string | number; content: string; rating?: number }) =>
    http.post<ApiResponse<unknown>>('/userComment/create', data),

  resourceList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/resource/list', { params }),
  resourceDetail: (id: string | number) => http.get<ApiResponse<unknown>>(`/resource/${id}`),

  certificateList: () => http.get<ApiResponse<Certificate[]>>('/user/certificate/list'),

  // 我的问答
  myAskList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/ask/question/my', { params }),
  myAnswerList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/ask/answer/my', { params }),

  // 我的圈子
  myCircleList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/circle/my', { params }),
  myCirclePost: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/circle/post/my', { params }),

  // 我的文章
  myArticleList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/article/my', { params }),

  // 我的资源
  myResourceList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/resource/my', { params }),

  // 收藏
  myFavorites: (params?: PaginationParams & { type?: 'lesson' | 'ask' | 'circle' | 'live' | 'article' }) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/user/favorite/list', { params }),
  toggleFavorite: (data: { refType: string; refId: string }) =>
    http.post<ApiResponse<{ isFavorite: boolean }>>('/user/favorite', data),

  // 我的评论
  myComments: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<Comment>>>('/user/comment/list', { params }),

  // 关注 / 粉丝
  followList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<FollowUser>>>('/user/follow/list', { params }),
  fansList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<FollowUser>>>('/user/fans/list', { params }),
  followToggle: (userId: string) => http.post<ApiResponse<{ isFollowing: boolean }>>(`/user/follow/${userId}`),

  // 证书
  myCertificates: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<Certificate>>>('/learn/certificate/list', { params }),

  // 作业
  myHomework: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/homework/list', { params }),
}

export default memberApi
