import { fetchApi } from '@/lib/api'

export type ArticleStatus = 'draft' | 'published'

export interface Article {
  id: string
  title: string
  authorName?: string | null
  categoryName?: string | null
  status: ArticleStatus
  viewCount: number
  createdAt: string
  summary?: string | null
  content?: string
}

export interface ArticlesData {
  list: Article[]
  total: number
}

export interface ArticleForm {
  title: string
  authorName: string
  summary: string
  content: string
  published: boolean
}

export const PAGE_SIZE = 10

export const EMPTY_FORM: ArticleForm = {
  title: '',
  authorName: '',
  summary: '',
  content: '',
  published: false,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchArticles(params: {
  page: number
  search: string
  status: 'all' | ArticleStatus
}): Promise<ArticlesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.status !== 'all') qs.set('status', params.status)
  return api<ArticlesData>(`/api/admin/articles?${qs.toString()}`)
}
