/**
 * 问答社区 API
 * 对接后端 /ask/* 端点
 */

import http from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'

export interface AskCategory {
  id: number
  name: string
}

export interface AskQuestion {
  id: number
  title: string
  content: string
  image?: string
  member_id: string
  member_name: string
  member_avatar?: string
  status: string
  favorite_num: number
  like_num: number
  comment_num: number
  watch_num: number
  answer_num: number
  is_top: boolean
  is_essence: boolean
  cid_list: number[]
  category_list: AskCategory[]
  is_like: boolean
  create_time: string
  update_time?: string
}

export interface AskAnswer {
  id: number
  question_id: number
  content: string
  user_id: string
  user_name: string
  user_avatar?: string
  like_num: number
  comment_num: number
  is_adopted: boolean
  is_like: boolean
  create_time: string
}

export interface AskComment {
  id: number
  target_type: 'question' | 'answer'
  target_id: number
  user_id: string
  user_name: string
  content: string
  pid?: number
  create_time: string
}

export const askApi = {
  // 公开问题列表
  listPublic: (params?: { page?: number; limit?: number; keyword?: string; cid?: number; order_column?: string; order_direction?: string }) =>
    http.get('/ask/public-api/list', { params }),

  // 问题详情
  detail: (id: number) => http.get('/ask/public-api', { params: { id } }),

  // 分类列表 - 缓存 5 分钟，分类不常变化
  categories: () =>
    defaultCache.wrap(
      '/ask/category/list',
      () => http.get('/ask/category/list'),
      undefined,
      5 * 60 * 1000
    ),

  // 提问
  create: (data: { title: string; content: string; image?: string; cid_list?: number[]; tags?: string[] }) =>
    http.post('/ask', data),

  // 回答
  answer: (questionId: number, content: string) =>
    http.post('/ask/answer', { question_id: questionId, content }),

  // 回答列表
  answerList: (questionId: number, params?: { page?: number; limit?: number }) =>
    http.get('/ask/answer/list', { params: { question_id: questionId, ...params } }),

  // 点赞
  toggleLike: (targetType: 'question' | 'answer', targetId: number) =>
    http.post('/ask/like', null, { params: { target_type: targetType, target_id: targetId } }),

  // 收藏
  toggleFavorite: (targetType: 'question' | 'answer', targetId: number) =>
    http.post('/ask/favorite', null, { params: { target_type: targetType, target_id: targetId } }),

  // 采纳
  adopt: (answerId: number) => http.post('/ask/answer/adopt', { id: answerId }),

  // 评论
  comment: (data: { target_type: 'question' | 'answer'; target_id: number; content: string; pid?: number }) =>
    http.post('/ask/comment', data),

  // 评论列表
  commentList: (targetType: 'question' | 'answer', targetId: number) =>
    http.get('/ask/comment/list', { params: { target_type: targetType, target_id: targetId } }),
}
