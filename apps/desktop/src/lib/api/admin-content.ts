/**
 * AdminContent 统一 CRUD API 客户端(desktop 端本地扩展)。
 *
 * 背景:packages/api-client(只读)中已存在 listAiGc / listCarousel / listAdminComments /
 *      listNewsInformation 等独立 list 端点,但 create/update/delete 散落在各自的子模块,
 *      且 admin 后台已落地统一端点 `/api/admin/content/:type/:id`(由 subagent A 实现,
 *      支持 10 种 type)。本文件统一封装 list / get / create / update / delete,
 *      供 desktop AdminContent 页面 4 个 Tab(announcement / help-article /
 *      article / advertise)共用。
 *
 * 接口约定(与后端对齐):
 *   GET    /api/admin/content/:type?page=&pageSize=&search=    → PageData
 *   GET    /api/admin/content/:type/:id                        → { item }
 *   POST   /api/admin/content/:type          body: Record      → { item }
 *   PATCH  /api/admin/content/:type/:id      body: Record      → { item }
 *   DELETE /api/admin/content/:type/:id                        → { id, deleted }
 */
import type { ApiResult } from '@ihui/types'
import { fetchApi } from '@ihui/api-client'

/** desktop AdminContent 4 Tab 实际使用的 type(后端端点支持 10 种) */
export const CONTENT_TYPES = ['announcement', 'help-article', 'article', 'advertise'] as const

export type ContentType = (typeof CONTENT_TYPES)[number]

export interface ContentRow {
  id: string | number
  title?: string
  content?: string
  status?: string | number
  isPublished?: boolean
  isPinned?: boolean
  sort?: number
  sortOrder?: number
  position?: string
  imageUrl?: string
  linkUrl?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface ContentListParams {
  page: number
  pageSize: number
  search?: string
}

interface ContentListResponse {
  list: ContentRow[]
  total: number
  page: number
  pageSize: number
  type: ContentType
}

interface ContentItemResponse {
  item: ContentRow
  type: ContentType
}

interface ContentDeleteResponse {
  id: string
  deleted: boolean
  type: ContentType
}

function base(type: ContentType): string {
  return `/api/admin/content/${encodeURIComponent(type)}`
}

export async function listAdminContent(
  type: ContentType,
  params: ContentListParams,
): Promise<ApiResult<ContentListResponse>> {
  const qs = new URLSearchParams()
  qs.set('page', String(params.page))
  qs.set('pageSize', String(params.pageSize))
  if (params.search) qs.set('search', params.search)
  return fetchApi<ContentListResponse>(`${base(type)}?${qs.toString()}`)
}

export async function getAdminContent(
  type: ContentType,
  id: string,
): Promise<ApiResult<ContentItemResponse>> {
  return fetchApi<ContentItemResponse>(`${base(type)}/${encodeURIComponent(id)}`)
}

export async function createAdminContent(
  type: ContentType,
  body: Record<string, unknown>,
): Promise<ApiResult<ContentItemResponse>> {
  return fetchApi<ContentItemResponse>(base(type), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminContent(
  type: ContentType,
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<ContentItemResponse>> {
  return fetchApi<ContentItemResponse>(`${base(type)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminContent(
  type: ContentType,
  id: string,
): Promise<ApiResult<ContentDeleteResponse>> {
  return fetchApi<ContentDeleteResponse>(`${base(type)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
