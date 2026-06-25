/**
 * News API 客户端(适配 @/utils/request + FastAPI 后端 /news/* + /announcement/* 端点)
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'
import { defaultCache } from '@/utils/requestCache'

export interface NewsItem {
  id: string | number
  title: string
  summary?: string
  content?: string
  cover?: string
  author?: string
  source?: string
  categoryId?: string | number
  categoryName?: string
  viewNum?: number
  likeNum?: number
  commentNum?: number
  publishTime?: string
  top?: boolean
  hot?: boolean
  link?: string
}

export interface NewsListParams {
  current?: number
  size?: number
  keyword?: string
  categoryId?: string | number
  top?: boolean
  hot?: boolean
}

export const newsApi = {
  /** 资讯列表 */
  list: (params: NewsListParams = {}) =>
    http.get<ApiResponse<PaginationResponse<NewsItem>>>('/news/list', { params }),

  /** 资讯详情 */
  detail: (id: string | number) =>
    http.get<ApiResponse<NewsItem>>('/news/detail', { params: { id } }),

  /** 热门资讯 */
  hot: (limit = 10) =>
    http.get<ApiResponse<NewsItem[]>>('/news/hot', { params: { limit } }),

  /** 资讯分类 - 缓存 5 分钟，分类不常变化 */
  categories: () =>
    defaultCache.wrap(
      '/news/categories',
      () => http.get<ApiResponse<{ id: string | number; name: string; count?: number }[]>>('/news/categories'),
      undefined,
      5 * 60 * 1000
    ),

  /** 推荐资讯 */
  recommend: (limit = 6) =>
    http.get<ApiResponse<NewsItem[]>>('/news/recommend', { params: { limit } }),

  /** 资讯点赞 */
  like: (id: string | number) => http.post<ApiResponse<void>>('/news/like', { id }),

  /** 资讯收藏 */
  favorite: (id: string | number) => http.post<ApiResponse<void>>('/news/favorite', { id }),

  /** 公告列表 */
  announcement: (limit = 5) =>
    http.get<ApiResponse<NewsItem[]>>('/announcement/list', { params: { limit } }),
}
