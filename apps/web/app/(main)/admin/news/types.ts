import { fetchApi } from '@/lib/api'

export interface Article {
  id: string
  categoryId: string | null
  title: string
  summary: string | null
  content: string
  coverImage: string | null
  authorId: string | null
  authorName: string | null
  isPublished: boolean
  isPinned: boolean
  viewCount: number
  sort: number
  status: number
  publishedAt: string | null
  createdAt: string
  categoryName?: string | null
}

export interface Category {
  id: string
  name: string
  sort: number
  status: number
}

export interface ArticlesData {
  list: Article[]
  total: number
  page: number
  pageSize: number
}

export interface Information {
  id: string
  title: string
  content: string
  type: string | null
  url: string | null
  sourceName: string | null
  sourceUrl: string | null
  sourceCreator: string | null
  sourceTime: string | null
  insertTime: string | null
  browse: number | null
  creator: string | null
  crearedTime: string | null
}

export interface InfoData {
  list: Information[]
  total: number
  page: number
  pageSize: number
}

export interface ArticleForm {
  title: string
  summary: string
  content: string
  categoryId: string
  coverImage: string
  authorName: string
  isPublished: boolean
  isPinned: boolean
  sort: string
  status: boolean
}

export interface InfoForm {
  title: string
  type: string
  url: string
  sourceName: string
  sourceUrl: string
  sourceCreator: string
  sourceTime: string
  insertTime: string
  browse: string
  creator: string
  crearedTime: string
  content: string
}

export const PAGE_SIZE = 20
export const INFO_PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const inputSm = 'h-8 text-xs'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchArticles(params: {
  page: number
  search: string
  categoryId: string
  status: string
}): Promise<ArticlesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.categoryId && params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  return api<ArticlesData>(`/api/admin/news/articles?${qs.toString()}`)
}

export const EMPTY_FORM: ArticleForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  coverImage: '',
  authorName: '',
  isPublished: false,
  isPinned: false,
  sort: '0',
  status: true,
}

export const EMPTY_INFO: InfoForm = {
  title: '',
  type: '',
  url: '',
  sourceName: '',
  sourceUrl: '',
  sourceCreator: '',
  sourceTime: '',
  insertTime: '',
  browse: '0',
  creator: '',
  crearedTime: '',
  content: '',
}
