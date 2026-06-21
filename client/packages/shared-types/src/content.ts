import type { PaginationParams } from './api'

export interface KnowledgePlanetItem {
  id?: string | number
  title?: string
  cover?: string
  description?: string
  content?: string
  type?: string
  category?: string
  author?: string
  viewCount?: number
  likeCount?: number
  createTime?: string
  [key: string]: unknown
}

export interface InformationItem {
  id?: string | number
  title?: string
  cover?: string
  summary?: string
  content?: string
  type?: string
  informationType?: string
  author?: string
  source?: string
  viewCount?: number
  insertTime?: string
  createTime?: string
  [key: string]: unknown
}

export interface InformationListParams extends PaginationParams {
  type?: string
  informationType?: string
  insertTime?: string
}
