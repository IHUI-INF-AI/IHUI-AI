export interface NewsCategory {
  id: string
  name: string
  sort: number
  status: number
}

export interface NewsArticle {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  viewCount: number
  publishedAt?: string | null
  isPinned?: boolean
}

export interface ArticlesData {
  list: NewsArticle[]
  total: number
  page: number
  pageSize: number
}
