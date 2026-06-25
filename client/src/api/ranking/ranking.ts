/**
 * 排行榜 API
 * 对接后端 /ranking/* 端点
 */

import http from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'

export interface RankItem {
  rank: number
  user_id?: string
  user_name?: string
  score?: number
  level?: number
  agent_id?: number | string
  name?: string
  heat?: number
  course_id?: number
  title?: string
  view_num?: number
  student_num?: number
}

export interface RankList {
  id: number
  name: string
  code: string
  type: string
  period: string
  description?: string
}

export const rankApi = {
  // 榜单列表 - 缓存 10 分钟，榜单类型不常变化
  lists: () =>
    defaultCache.wrap(
      '/ranking/list',
      () => http.get('/ranking/list'),
      undefined,
      10 * 60 * 1000
    ),

  // 用户积分榜
  user: (params?: { period?: string; limit?: number }) => http.get('/ranking/user', { params }),

  // 智能体热度榜
  agent: (params?: { period?: string; limit?: number }) => http.get('/ranking/agent', { params }),

  // 课程人气榜
  course: (params?: { limit?: number }) => http.get('/ranking/course', { params }),
}
