/**
 * Resource API 客户端(适配 @/utils/request + FastAPI 后端 /resource/* 端点)
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface ResourceItem {
  id: string | number
  title: string
  description?: string
  cover?: string
  type?: 'doc' | 'video' | 'audio' | 'image' | 'archive' | 'other'
  size?: number
  url?: string
  downloadUrl?: string
  previewUrl?: string
  categoryId?: string | number
  categoryName?: string
  tagList?: string[]
  uploaderId?: string | number
  uploaderName?: string
  downloadNum?: number
  viewNum?: number
  likeNum?: number
  score?: number
  publishTime?: string
  top?: boolean
  free?: boolean
  points?: number
}

export interface ResourceListParams {
  current?: number
  size?: number
  keyword?: string
  categoryId?: string | number
  type?: string
  uploaderId?: string | number
  top?: boolean
  sort?: 'new' | 'hot' | 'download'
}

export const resourceApi = {
  /** 资源列表 */
  list: (params: ResourceListParams = {}) =>
    http.get<ApiResponse<PaginationResponse<ResourceItem>>>('/resource/list', { params }),

  /** 资源详情 */
  detail: (id: string | number) =>
    http.get<ApiResponse<ResourceItem>>('/resource/detail', { params: { id } }),

  /** 热门资源 */
  hot: (limit = 10) =>
    http.get<ApiResponse<ResourceItem[]>>('/resource/hot', { params: { limit } }),

  /** 推荐资源 */
  recommend: (limit = 6) =>
    http.get<ApiResponse<ResourceItem[]>>('/resource/recommend', { params: { limit } }),

  /** 资源分类 */
  categories: () =>
    http.get<ApiResponse<{ id: string | number; name: string; count?: number }[]>>('/resource/categories'),

  /** 我的资源 */
  my: (params: ResourceListParams = {}) =>
    http.get<ApiResponse<PaginationResponse<ResourceItem>>>('/resource/my', { params }),

  /** 上传资源 */
  upload: (payload: Partial<ResourceItem>) =>
    http.post<ApiResponse<ResourceItem>>('/resource/upload', payload),

  /** 资源下载 */
  download: (id: string | number) =>
    http.get<ApiResponse<{ url: string; expire: number }>>('/resource/download', { params: { id } }),

  /** 资源收藏 */
  favorite: (id: string | number) => http.post<ApiResponse<void>>('/resource/favorite', { id }),

  /** 资源点赞 */
  like: (id: string | number) => http.post<ApiResponse<void>>('/resource/like', { id }),

  /** 资源评分 */
  rate: (id: string | number, score: number) =>
    http.post<ApiResponse<void>>('/resource/rate', { id, score }),
}
