/**
 * Article API 客户端(适配 @/utils/request + FastAPI 后端 /article/* 端点)
 */
import http from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface ArticleItem {
  id: string | number
  title: string
  summary?: string
  content?: string
  cover?: string
  authorId?: string | number
  authorName?: string
  authorAvatar?: string
  categoryId?: string | number
  categoryName?: string
  tagList?: string[]
  viewNum?: number
  likeNum?: number
  commentNum?: number
  favoriteNum?: number
  publishTime?: string
  updateTime?: string
  top?: boolean
  essence?: boolean
  link?: string
}

export interface ArticleListParams {
  current?: number
  size?: number
  keyword?: string
  categoryId?: string | number
  authorId?: string | number
  tag?: string
  top?: boolean
  essence?: boolean
}

export const articleApi = {
  /** 文章列表 */
  list: (params: ArticleListParams = {}) =>
    http.get<ApiResponse<PaginationResponse<ArticleItem>>>('/article/list', { params }),

  /** 文章详情 */
  detail: (id: string | number) =>
    http.get<ApiResponse<ArticleItem>>('/article/detail', { params: { id } }),

  /** 热门文章 */
  hot: (limit = 10) =>
    http.get<ApiResponse<ArticleItem[]>>('/article/hot', { params: { limit } }),

  /** 精选文章 */
  essence: (limit = 6) =>
    http.get<ApiResponse<ArticleItem[]>>('/article/essence', { params: { limit } }),

  /** 文章分类 - 缓存 5 分钟，分类不常变化 */
  categories: () =>
    defaultCache.wrap(
      '/article/categories',
      () => http.get<ApiResponse<{ id: string | number; name: string; count?: number }[]>>('/article/categories'),
      undefined,
      5 * 60 * 1000
    ),

  /** 我的文章 */
  my: (params: ArticleListParams = {}) =>
    http.get<ApiResponse<PaginationResponse<ArticleItem>>>('/article/my', { params }),

  /** 发布文章 */
  publish: (payload: Partial<ArticleItem>) =>
    http.post<ApiResponse<ArticleItem>>('/article/publish', payload),

  /** 文章点赞 */
  like: (id: string | number) => http.post<ApiResponse<void>>('/article/like', { id }),

  /** 文章收藏 */
  favorite: (id: string | number) => http.post<ApiResponse<void>>('/article/favorite', { id }),

  /** 文章评论 */
  comments: (id: string | number, params: { current?: number; size?: number } = {}) =>
    http.get<ApiResponse<PaginationResponse<unknown>>>('/article/comments', { params: { id, ...params } }),
}
