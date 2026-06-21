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

export interface ExamSignUp {
  id: string
  examId: string
  examName?: string
  userId: string
  status: 'signing_up' | 'completed' | 'cancel_sign_up'
  score?: number
  totalScore?: number
  passScore?: number
  passed?: boolean
  duration?: number
  startTime?: string
  endTime?: string
}

export interface ExamRecord {
  id: string
  examId: string
  examName?: string
  paperId?: string
  userId: string
  answers?: Record<string, unknown>
  score?: number
  correctNum?: number
  wrongNum?: number
  duration?: number
  status?: string
  createTime: string
}

export interface ExamWrong {
  id: string
  examId: string
  examName?: string
  questionId: string
  questionTitle?: string
  userAnswer?: string
  correctAnswer?: string
  analysis?: string
  createTime: string
}

export interface FollowUser {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  bio?: string
  followerNum?: number
  followNum?: number
  mutualFollow?: boolean
  createTime: string
}

export interface Comment {
  id: string
  refType: 'course' | 'lesson' | 'ask' | 'circle' | 'live' | 'article'
  refId: string
  refTitle?: string
  content: string
  rating?: number
  likeNum: number
  replyNum: number
  status?: string
  createTime: string
}

export interface Certificate {
  id: string
  lessonId: string
  lessonName?: string
  userId: string
  name: string
  issueTime: string
  image?: string
}

export const memberApi = {
  // 账号
  profile: () => http.get<ApiResponse<MemberProfile>>('/user/profile'),
  updateProfile: (data: Partial<MemberProfile>) => http.put<ApiResponse<MemberProfile>>('/user/profile', data),
  uploadAvatar: (file: FormData) =>
    http.post<ApiResponse<{ url: string }>>('/user/upload/avatar', file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // 密码 / 安全
  changePassword: (data: { oldPwd: string; newPwd: string }) =>
    http.post<ApiResponse<void>>('/user/change-password', data),
  bindPhone: (data: { phone: string; code: string }) =>
    http.post<ApiResponse<void>>('/user/bind-phone', data),
  bindEmail: (data: { email: string; code: string }) =>
    http.post<ApiResponse<void>>('/user/bind-email', data),

  // 设置
  setting: () => http.get<ApiResponse<Record<string, unknown>>>('/user/setting'),
  updateSetting: (data: Record<string, unknown>) => http.put<ApiResponse<void>>('/user/setting', data),

  // VIP
  vipList: () => http.get<ApiResponse<unknown[]>>('/user/vip/list'),
  vipBuy: (data: { level: number; payType: string }) =>
    http.post<ApiResponse<{ orderId: string }>>('/user/vip/buy', data),

  // 积分
  pointAccount: () => http.get<ApiResponse<{ total: number; available: number; frozen: number; used: number; level: number }>>('/point/account'),
  pointLog: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<PointLog>>>('/point/log/list', { params }),
  pointTodaySign: () => http.post<ApiResponse<{ point: number; continuous: number }>>('/point/today-sign'),
  pointSignStatus: () => http.get<ApiResponse<{ signed: boolean; continuous: number }>>('/point/sign-status'),

  // 学习记录
  learnRecord: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/user/video/log/list', { params }),
  learnRecordSave: (data: { lessonId: string; duration: number; progress: number }) =>
    http.post<ApiResponse<unknown>>('/user/video/log', data),
  learnStat: () =>
    http.get<ApiResponse<{ totalDays: number; totalMinutes: number; continuousDays: number; todayMinutes: number }>>(
      '/user/learn/stat'
    ),

  // 考试 - 报名 / 记录 / 错题
  examSignUp: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<ExamSignUp>>>('/exam/sign-up/list', { params }),
  examRecord: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<ExamRecord>>>('/exam/record/list', { params }),
  examWrongList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<ExamWrong>>>('/exam/wrong/list', { params }),
  examWrongRemove: (id: string) => http.delete<ApiResponse<void>>(`/exam/wrong/${id}`),

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
