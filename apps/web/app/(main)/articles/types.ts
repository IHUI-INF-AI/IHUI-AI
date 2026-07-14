export interface ArticleCategory {
  id: string
  name: string
  sort: number
  status: number
}

export type ArticleStatus = 'draft' | 'published' | 'reviewing'

export interface ArticleItem {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorId?: string
  authorName?: string | null
  categoryId?: string | null
  viewCount: number
  likeCount?: number
  status?: ArticleStatus
  publishedAt?: string | null
  isPinned?: boolean
}

export interface ArticlesData {
  list: ArticleItem[]
  total: number
  page: number
  pageSize: number
}

export interface ArticleDetail extends ArticleItem {
  content: string
}

export interface MyArticlesData {
  list: ArticleItem[]
  total: number
  page: number
  pageSize: number
}
