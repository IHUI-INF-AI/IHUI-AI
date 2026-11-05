// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文章端点(2026-11-05 立,门 300 存量裁决 A 类)。
 *
 * 后端真源 `apps/api/src/routes/other/article.ts`(openapi.json 112190-112326):
 *  - GET  /api/article/categories
 *  - GET  /api/article/list?page&pageSize&categoryId&search
 *  - GET  /api/article/detail/:id
 *  - GET  /api/article/hot?page&pageSize
 *  - GET  /api/article/my?page&pageSize
 *  - POST /api/article/publish
 *  - PUT/DELETE /api/article/:id
 *  - GET /api/articles?page&pageSize (裸数组,不分页包) / GET /api/articles/:id
 *
 * 不解包、不 try/catch:401/续期/超时由共享 fetchApi 统一处理。
 */
import type { ApiResult } from '@ihui/types'
import { fetchApi } from '../client.js'

type QueryValue = string | number | undefined

function withQuery(path: string, params?: Record<string, QueryValue>): string {
  if (!params) return path
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : path
}

/** 文章分类 — GET /api/article/categories */
export async function listArticleCategories<T = { list: unknown[] }>(): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/article/categories')
}

/** 文章列表 — GET /api/article/list(支持 page/pageSize/categoryId/search) */
export async function listArticles<T = { list: unknown[]; total?: number }>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/article/list', params))
}

/** 热门文章 — GET /api/article/hot */
export async function listHotArticles<T = { list: unknown[] }>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/article/hot', params))
}

/** 我的文章 — GET /api/article/my */
export async function listMyArticles<T = { list: unknown[]; total?: number }>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/article/my', params))
}

/** 文章详情(管理端)— GET /api/article/detail/:id */
export async function getArticleDetail<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/article/detail/${id}`)
}

/** 发布文章 — POST /api/article/publish */
export async function publishArticle<T = unknown>(
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/article/publish', { method: 'POST', body: JSON.stringify(body) })
}

/** 更新文章 — PUT /api/article/:id */
export async function updateArticle<T = unknown>(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/article/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

/** 删除文章 — DELETE /api/article/:id */
export async function deleteArticle<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/article/${id}`, { method: 'DELETE' })
}

/** 公开文章列表 — GET /api/articles(裸数组) */
export async function listPublicArticles<T = unknown[]>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/articles', params))
}

/** 公开文章详情 — GET /api/articles/:id */
export async function getPublicArticle<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/articles/${encodeURIComponent(id)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
