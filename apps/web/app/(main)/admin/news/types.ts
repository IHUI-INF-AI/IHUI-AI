import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass, inputSm } from '@/lib/form-styles'
import { DEFAULT_PAGE_SIZE as PAGE_SIZE } from '@ihui/shared/constants'
import type {
  AdminCategory,
  NewsArticle,
  NewsArticlesData,
  NewsInformation,
  NewsInfoData,
} from '@ihui/types'

export { api, selectClass, inputSm, PAGE_SIZE }

export type { AdminCategory as Category } from '@ihui/types'
export type Article = NewsArticle
export type ArticlesData = NewsArticlesData
export type Information = NewsInformation
export type InfoData = NewsInfoData

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

export const INFO_PAGE_SIZE = 10

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
