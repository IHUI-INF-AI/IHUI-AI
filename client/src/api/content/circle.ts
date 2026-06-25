/**
 * 圈子社区 API
 * 对接后端 /circle/* 端点
 */

import http from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'

export interface Circle {
  id: number
  name: string
  description?: string
  avatar?: string
  cover?: string
  category_id: number
  owner_id: string
  owner_name: string
  member_num: number
  post_num: number
  status: number
  is_official: boolean
  is_top: boolean
  is_essence: boolean
  create_time: string
}

export interface CirclePost {
  id: number
  circle_id: number
  user_id: string
  user_name: string
  user_avatar?: string
  title?: string
  content: string
  images?: string[]
  like_num: number
  comment_num: number
  watch_num: number
  is_top: boolean
  is_essence: boolean
  create_time: string
}

export const circleApi = {
  // 圈子列表
  list: (params?: { page?: number; limit?: number; category_id?: number; keyword?: string; is_official?: boolean }) =>
    http.get('/circle/list', { params }),

  // 圈子详情
  detail: (id: number) => http.get('/circle/detail', { params: { id } }),

  // 圈子分类 - 缓存 5 分钟，分类不常变化
  categories: () =>
    defaultCache.wrap(
      '/circle/category/list',
      () => http.get('/circle/category/list'),
      undefined,
      5 * 60 * 1000
    ),

  // 加入 / 退出
  join: (circleId: number) => http.post('/circle/join', { circle_id: circleId }),
  quit: (circleId: number) => http.post('/circle/quit', { circle_id: circleId }),

  // 动态列表
  posts: (circleId: number, params?: { page?: number; limit?: number }) =>
    http.get('/circle/post/list', { params: { circle_id: circleId, ...params } }),

  // 发布动态
  publish: (data: { circle_id: number; title?: string; content: string; images?: string[] }) =>
    http.post('/circle/post', data),

  // 动态详情
  postDetail: (id: number) => http.get('/circle/post/detail', { params: { id } }),

  // 点赞 / 收藏
  toggleLike: (postId: number) => http.post('/circle/post/like', { id: postId }),
  toggleFavorite: (postId: number) => http.post('/circle/post/favorite', { id: postId }),
}
