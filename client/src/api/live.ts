/**
 * 直播 API 客户端
 * 适配 g:\1\server 后端:
 *   - /live/channel/* 频道 CRUD
 *   - /live/comment/* 评论弹幕
 *   - /live/subscribe/* 订阅
 *   - /live/category/* 分类
 *   - /live/gift/* 礼物打赏
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

export interface LiveCategory {
  id: number | string
  name: string
  parentId?: number | string
  icon?: string
  sort?: number
}

export interface LiveChannel {
  id: string
  title: string
  description?: string
  cover?: string
  hostId?: string
  hostName?: string
  hostAvatar?: string
  categoryId?: number | string
  categoryName?: string
  pullUrl?: string
  playUrlHls?: string
  playUrlRtmp?: string
  playUrlFlv?: string
  status: number
  type: number
  price: number
  isRecord?: boolean
  recordUrl?: string
  startTime?: string
  endTime?: string
  planStartTime?: string
  planDuration?: number
  onlineNum: number
  viewNum: number
  likeNum: number
  commentNum: number
  isTop?: boolean
  isEssence?: boolean
  isSubscribed?: boolean
}

export interface LiveComment {
  id: string
  channelId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  type: 'text' | 'gift' | 'enter'
  giftId?: string
  giftName?: string
  giftCount?: number
  createTime: string
}

export interface LiveGift {
  id: string
  name: string
  icon?: string
  price: number
  description?: string
  category?: 'cheap' | 'medium' | 'expensive'
}

export const liveApi = {
  // 分类
  categoryList: () => http.get<ApiResponse<LiveCategory[]>>('/live/category/list'),
  categoryTree: () => http.get<ApiResponse<LiveCategory[]>>('/live/category/tree'),

  // 频道
  list: (params?: PaginationParams & { status?: number; categoryId?: string; hostId?: string; keyword?: string }) =>
    http.get<ApiResponse<PaginationResponse<LiveChannel>>>('/live/channel/list', { params }),
  detail: (id: string) => http.get<ApiResponse<LiveChannel>>(`/live/channel/${id}`),
  create: (data: unknown) => http.post<ApiResponse<LiveChannel>>('/live/channel', data),
  update: (id: string, data: unknown) => http.put<ApiResponse<LiveChannel>>(`/live/channel/${id}`, data),
  delete: (id: string) => http.delete<ApiResponse<void>>(`/live/channel/${id}`),

  // 状态变更(开播/结束)
  start: (id: string) => http.post<ApiResponse<LiveChannel>>(`/live/channel/${id}/start`),
  end: (id: string) => http.post<ApiResponse<LiveChannel>>(`/live/channel/${id}/end`),
  recordStart: (id: string) => http.post<ApiResponse<LiveChannel>>(`/live/channel/${id}/record/start`),
  recordEnd: (id: string) => http.post<ApiResponse<LiveChannel>>(`/live/channel/${id}/record/end`),

  // 订阅
  subscribe: (id: string) => http.post<ApiResponse<{ subscribed: boolean }>>(`/live/channel/${id}/subscribe`),
  unsubscribe: (id: string) => http.delete<ApiResponse<{ subscribed: boolean }>>(`/live/channel/${id}/subscribe`),
  subscribedList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<LiveChannel>>>('/live/subscribe/list', { params }),

  // 评论 / 弹幕
  commentList: (channelId: string, params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<LiveComment>>>('/live/comment/list', {
      params: { channelId, ...params },
    }),
  commentSubmit: (data: { channelId: string; content: string; type?: string }) =>
    http.post<ApiResponse<LiveComment>>('/live/comment', data),
  commentDelete: (id: string) => http.delete<ApiResponse<void>>(`/live/comment/${id}`),

  // 礼物
  giftList: () => http.get<ApiResponse<LiveGift[]>>('/live/gift/list'),
  giftSend: (data: { channelId: string; giftId: string; count: number }) =>
    http.post<ApiResponse<void>>('/live/gift/send', data),

  // 互动
  like: (id: string) => http.post<ApiResponse<{ likeNum: number }>>(`/live/channel/${id}/like`),

  // 主播端
  hostChannelList: (params?: PaginationParams) =>
    http.get<ApiResponse<PaginationResponse<LiveChannel>>>('/live/host/channel/list', { params }),

  // 公告
  announce: (id: string, data: { content: string; pinned?: boolean }) =>
    http.post<ApiResponse<void>>(`/live/channel/${id}/announce`, data),
}

export default liveApi
