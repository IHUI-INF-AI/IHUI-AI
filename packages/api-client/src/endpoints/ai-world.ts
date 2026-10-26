// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 世界详情/编辑/收藏/历史端点(2026-10-26 Wave2 补屏立:
 * web `/ai-world/[id]`、`/ai-world/edit/[id]`、`/ai-world/favorites`、`/ai-world/history`
 * 四条 gap 路由收口 api-client 统一层,后端 apps/api 已实装不动)。
 *
 * 覆盖端点:
 * - GET /api/ai-world/:id        → data.world 条目详情(routes/user/ai-feed-routes.ts)
 * - PUT /api/ai-world/:id        → data.item 条目更新(routes/other/ai-world-routes.ts)
 * - GET /api/ai-world/categories → data **是数组本身**(success(categories))
 * - GET /api/ai-world/favorites  → data.list 我的收藏(需登录)
 * - GET /api/ai-world/history    → data.list 历史版本(需登录)
 * 收藏检查/加藏/取消复用 social.ts checkFavorite/addFavorite/deleteFavorite(resourceType='aiworld')。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 条目详情(对齐后端 ai_world_items 行 DTO;config 字段后端 zod 不存在,不声明)。 */
export interface AiWorldDetailItem {
  id: string
  categoryId: string | null
  title: string
  content: string | null
  coverImage: string | null
  authorId: string | null
  viewCount: number
  status: number
  createdAt: string
  updatedAt: string
}

/** GET /api/ai-world/:id 的信封 data 载荷。 */
export interface AiWorldDetailPayload {
  world: AiWorldDetailItem
}

/** 条目分类(GET /api/ai-world/categories 直接返回数组,仅声明消费字段)。 */
export interface AiWorldCategoryRow {
  id: string
  name: string
  slug?: string
}

/** PUT /api/ai-world/:id 请求体(对齐后端 zod:title 1..200、coverImage ≤500、categoryId uuid)。 */
export interface AiWorldUpdateBody {
  title?: string
  content?: string
  coverImage?: string
  categoryId?: string
  status?: number
}

/** PUT /api/ai-world/:id 的信封 data 载荷。 */
export interface AiWorldUpdatePayload {
  item: AiWorldDetailItem
}

/** 收藏/历史列表行(favorites 页消费 createdAt,history 页消费 updatedAt)。 */
export interface AiWorldCollectionItem {
  id: string
  title: string
  coverImage: string | null
  viewCount: number
  status?: number
  createdAt?: string
  updatedAt?: string
}

/** GET /api/ai-world/favorites 与 /api/ai-world/history 的信封 data 载荷。 */
export interface AiWorldCollectionPayload {
  list: AiWorldCollectionItem[]
  total?: number
}

/** 获取条目详情 — GET /api/ai-world/:id。 */
export async function getAiWorldItem(id: string): Promise<ApiResult<AiWorldDetailPayload>> {
  return fetchApi<AiWorldDetailPayload>(`/api/ai-world/${encodeURIComponent(id)}`)
}

/** 更新条目 — PUT /api/ai-world/:id。 */
export async function updateAiWorldItem(
  id: string,
  body: AiWorldUpdateBody,
): Promise<ApiResult<AiWorldUpdatePayload>> {
  return fetchApi<AiWorldUpdatePayload>(`/api/ai-world/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 获取全部分类 — GET /api/ai-world/categories(data 为数组本身)。 */
export async function getAiWorldCategories(): Promise<ApiResult<AiWorldCategoryRow[]>> {
  return fetchApi<AiWorldCategoryRow[]>('/api/ai-world/categories')
}

/** 我的收藏 AI 世界条目 — GET /api/ai-world/favorites(需登录)。 */
export async function getAiWorldFavorites(): Promise<ApiResult<AiWorldCollectionPayload>> {
  return fetchApi<AiWorldCollectionPayload>('/api/ai-world/favorites')
}

/** AI 世界历史版本 — GET /api/ai-world/history(需登录)。 */
export async function getAiWorldHistory(): Promise<ApiResult<AiWorldCollectionPayload>> {
  return fetchApi<AiWorldCollectionPayload>('/api/ai-world/history')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
