// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 图像生成端点(`/api/image-gen/*`,apps/api `routes/other/image-gen-routes.ts`)。
 *
 * 端点清单(2026-11-05 立,门 300 台账 A 类:web / RN 端内直拼路径收口):
 * - GET  /api/image-gen/gallery    公开图库(ai_gc_content,分页)
 * - GET  /api/image-gen/history    当前用户生成历史(分页)
 * - GET  /api/image-gen/favorites  当前用户收藏(分页)
 * - POST /api/image-gen/generate   登记一条生成记录(链路未接通时回 503)
 * - GET  /api/image-gen/templates  提示词模板(content_generation_templates,不分页)
 *
 * 后端**没有**收藏增删端点(该模块只注册上述 5 条 GET/POST),故不在此臆造 add/remove。
 */
import type { ApiResult, ImageGenResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface ImageGenListQuery {
  page?: number
  pageSize?: number
}

export interface ImageGenPage<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** `GET /api/image-gen/gallery` 行(ai_gc_content 裸行;该表无 image_url 列)。 */
export interface ImageGenGalleryItem {
  id: string
  userUuid: string
  agentId: string | null
  gcType: string | null
  content: string | null
  status: number | null
  createdAt: string
  updatedAt: string
}

/** `GET /api/image-gen/history` 行(同 ai_gc_content,按当前用户过滤)。 */
export type ImageGenHistoryItem = ImageGenGalleryItem

/** `GET /api/image-gen/favorites` 行(image_gen_favorites)。 */
export interface ImageGenFavoriteItem {
  id: string
  prompt: string
  imageUrl: string
  createdAt: string
}

/** `GET /api/image-gen/templates` 行(content_generation_templates)。 */
export interface ImageGenTemplate {
  id: string
  name: string
  description: string | null
  prompt: string | null
  category: string | null
  status: number
  createdAt: string
}

/** `POST /api/image-gen/generate` 入参(后端接受 content/prompt 两形态,同给时 content 优先)。 */
export interface GenerateImageInput {
  content?: string
  prompt?: string
  agentId?: string
  size?: string
  imageUrl?: string
}

/** 公开图库 — GET /api/image-gen/gallery */
export async function getImageGallery<T = ImageGenGalleryItem>(
  query: ImageGenListQuery = {},
): Promise<ApiResult<ImageGenPage<T>>> {
  return fetchApi<ImageGenPage<T>>(`/api/image-gen/gallery${buildQs(query)}`)
}

/** 当前用户生成历史 — GET /api/image-gen/history */
export async function getImageHistory<T = ImageGenHistoryItem>(
  query: ImageGenListQuery = {},
): Promise<ApiResult<ImageGenPage<T>>> {
  return fetchApi<ImageGenPage<T>>(`/api/image-gen/history${buildQs(query)}`)
}

/** 当前用户收藏 — GET /api/image-gen/favorites */
export async function getFavoriteImages<T = ImageGenFavoriteItem>(
  query: ImageGenListQuery = {},
): Promise<ApiResult<ImageGenPage<T>>> {
  return fetchApi<ImageGenPage<T>>(`/api/image-gen/favorites${buildQs(query)}`)
}

/** 创建图像生成任务 — POST /api/image-gen/generate(201 `{ item, imageUrl }`) */
export async function generateImage(input: GenerateImageInput): Promise<ApiResult<ImageGenResult>> {
  return fetchApi<ImageGenResult>('/api/image-gen/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 图像生成模板 — GET /api/image-gen/templates(固定 `{ list }`,不分页) */
export async function getImageTemplates<T = ImageGenTemplate>(): Promise<
  ApiResult<{ list: T[] }>
> {
  return fetchApi<{ list: T[] }>('/api/image-gen/templates')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
