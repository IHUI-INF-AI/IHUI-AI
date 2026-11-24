// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库端点(`/api/knowledge-base/*`,apps/api `routes/other/knowledge-base-routes.ts`)。
 *
 * 端点清单(2026-11-05 立,门 300 台账 A 类:web / RN 端内直拼路径收口):
 * - GET  /api/knowledge-base               列表(分页 + categoryId/search 过滤)
 * - GET  /api/knowledge-base/categories    分类(含每类文章数)
 * - POST /api/knowledge-base               创建
 * - GET  /api/knowledge-base/:id           详情(现网实回 `{ item }`)
 * - PUT  /api/knowledge-base/:id           更新(仅作者)
 *
 * 搜索复用列表端点(`?search=`),后端没有独立 search 路由。
 * 后端**没有** DELETE 端点,故不在此臆造 deleteKnowledgeBase。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface KnowledgeBaseListQuery {
  page?: number
  pageSize?: number
  categoryId?: string
  search?: string
}

/** `GET /api/knowledge-base` 行(左连分类/作者后的列集)。 */
export interface KnowledgeBaseListItem {
  id: string
  title: string
  summary: string | null
  viewCount: number
  updatedAt: string
  categoryId: string | null
  categoryName: string | null
  authorName: string | null
}

export interface KnowledgeBaseList<T = KnowledgeBaseListItem> {
  list: T[]
  total: number
}

/** `GET /api/knowledge-base/categories` 行。 */
export interface KnowledgeBaseCategory {
  id: string
  name: string
  count: number
}

/** `knowledge_base` 表裸行(GET /:id 与 POST/PUT 的 `item`)。 */
export interface KnowledgeBaseItem {
  id: string
  title: string
  summary: string | null
  content: string | null
  coverImage: string | null
  categoryId: string | null
  authorId: string | null
  isPublished: boolean
  status: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeBaseNavItem {
  id: string
  title: string
}

/** GET /api/knowledge-base/:id 默认回包(现网只有 `item`,prev/next 保留为可选)。 */
export interface KnowledgeBaseDetail<T = KnowledgeBaseItem> {
  item: T
  prev?: KnowledgeBaseNavItem | null
  next?: KnowledgeBaseNavItem | null
}

export interface CreateKnowledgeBaseInput {
  title: string
  summary?: string
  content?: string
  coverImage?: string
  categoryId?: string
  tags?: string[]
  isPublished?: boolean
  status?: number
}

export type UpdateKnowledgeBaseInput = Partial<CreateKnowledgeBaseInput>

/** 知识库列表 — GET /api/knowledge-base */
export async function listKnowledgeBases<T = KnowledgeBaseList>(
  query: KnowledgeBaseListQuery = {},
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/knowledge-base${buildQs(query)}`)
}

/** 知识库搜索 — 与列表同一端点,仅固定 `search` 语义 */
export async function searchKnowledgeBase<T = KnowledgeBaseList>(
  query: string,
  options: Omit<KnowledgeBaseListQuery, 'search'> = {},
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/knowledge-base${buildQs({ ...options, search: query })}`)
}

/** 分类列表 — GET /api/knowledge-base/categories */
export async function getKnowledgeBaseCategories<T = KnowledgeBaseCategory>(): Promise<
  ApiResult<{ list: T[] }>
> {
  return fetchApi<{ list: T[] }>('/api/knowledge-base/categories')
}

/** 详情 — GET /api/knowledge-base/:id */
export async function getKnowledgeBase<T = KnowledgeBaseDetail>(
  id: string,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/knowledge-base/${encodeURIComponent(id)}`)
}

/** 创建 — POST /api/knowledge-base */
export async function createKnowledgeBase<T = KnowledgeBaseItem>(
  input: CreateKnowledgeBaseInput,
): Promise<ApiResult<{ item: T }>> {
  return fetchApi<{ item: T }>('/api/knowledge-base', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 — PUT /api/knowledge-base/:id */
export async function updateKnowledgeBase<T = KnowledgeBaseItem>(
  id: string,
  input: UpdateKnowledgeBaseInput,
): Promise<ApiResult<{ item: T }>> {
  return fetchApi<{ item: T }>(`/api/knowledge-base/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
