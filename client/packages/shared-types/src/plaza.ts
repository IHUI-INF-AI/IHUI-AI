import type { PaginationParams } from './api'

export interface PlazaTaskItem {
  id?: string | number
  title?: string
  description?: string
  content?: string
  status?: string
  types?: string[]
  categorys?: string[]
  creator?: string
  creatorName?: string
  creatorAvatar?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  createTime?: string
  updateTime?: string
  [key: string]: unknown
}

export interface PlazaTaskListParams extends PaginationParams {
  status?: string
  search?: string
  creator?: string
  types?: string[]
  categorys?: string[]
}

export interface PlazaDemand {
  id?: string | number
  title?: string
  description?: string
  content?: string
  category?: string
  status?: number
  budget?: number
  deadline?: string
  creatorId?: string
  creatorName?: string
  creatorAvatar?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  createTime?: string
  updateTime?: string
  [key: string]: unknown
}
