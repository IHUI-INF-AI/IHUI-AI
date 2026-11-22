// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 标签域端点(Wave1 2026-10-26 立,web→RN 跨端对齐补屏 tags / tags/[slug] gap→aligned)。
 *
 * 覆盖端点(后端 apps/api/src/routes/social.ts 已实装,注册于 /api 前缀,本文件只读封装):
 * - GET /api/tags               (公开,usage_count 倒序,信封 data.tags ⇒ web tags/page.tsx:42 同址)
 * - GET /api/tags/:slug         (公开,标签详情,404 = 标签不存在 ⇒ web PageClient.tsx:70 同址)
 * - GET /api/tags/:id/resources (公开,标签下资源分页列表,信封 data.list ⇒ web PageClient.tsx:77 同址)
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 单条标签(对齐后端 findTags 返回的 tags 行)。 */
export interface TagItem {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string | null
  color?: string | null
  createdAt?: string
}

/** /api/tags 的信封 data 载荷。 */
export interface TagsListPayload {
  tags: TagItem[]
}

/** /api/tags/:slug 的信封 data 载荷。 */
export interface TagDetailPayload {
  tag: TagItem
}

/** 单条标签关联(对齐后端 findTagResources 返回的 tag_relations 行)。 */
export interface TagResourceItem {
  id: string
  tagId: string
  resourceType: string
  resourceId: string
  createdBy?: string | null
  createdAt: string
}

/** /api/tags/:id/resources 的信封 data 载荷。 */
export interface TagResourcesPayload {
  list: TagResourceItem[]
  total: number
  page: number
  pageSize: number
}

/** 获取标签列表(公开端点,标签云数据源)。 */
export async function getTags(): Promise<ApiResult<TagsListPayload>> {
  return fetchApi<TagsListPayload>('/api/tags')
}

/** 按 slug 获取标签详情(公开端点;不存在时后端 404 ⇒ success=false,消费侧渲染 notFound)。 */
export async function getTagBySlug(slug: string): Promise<ApiResult<TagDetailPayload>> {
  return fetchApi<TagDetailPayload>(`/api/tags/${encodeURIComponent(slug)}`)
}

/** 获取标签下的资源列表(公开端点,分页;web 侧不带参数取默认页,RN 同口径,opts 留作分页扩展)。 */
export async function getTagResources(
  tagId: string,
  opts?: { page?: number; pageSize?: number },
): Promise<ApiResult<TagResourcesPayload>> {
  const params = new URLSearchParams()
  if (opts?.page !== undefined) params.set('page', String(opts.page))
  if (opts?.pageSize !== undefined) params.set('pageSize', String(opts.pageSize))
  const qs = params.toString()
  return fetchApi<TagResourcesPayload>(
    `/api/tags/${encodeURIComponent(tagId)}/resources${qs ? `?${qs}` : ''}`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
