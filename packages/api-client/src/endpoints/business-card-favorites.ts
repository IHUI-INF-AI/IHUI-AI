// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 名片收藏端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET /api/business-card/favorites?page&pageSize
 *    (apps/api/src/routes/other/business-card-routes.ts:267-306,businessCardRoutes 挂 /api)
 *    → 信封 success({ list, total, page, pageSize })。
 *    **list 元素 = 扁平行**(business-card-routes.ts:272-291 select 逐字段现读):
 *    businessCards 本体字段(id/userId/name/title/company/phone/email/avatar/intro/
 *    qrCode/isPublic/viewCount/createdAt/updatedAt)+ favoritedAt(收藏时间,
 *    businessCardFavorites.createdAt 改名)+ favoriteCount + authorNickname/authorAvatar。
 *    ⚠ web 基准页 apps/web/app/(main)/business-card/favorites/page.tsx:34-42 把它声明成
 *    {list:[{card,favoriteId,createdAt}]} 并读 entry.card.name —— 与真实响应 shape 不符
 *    (entry.card 实际 undefined),是 web 该页的现场缺陷,不是后端契约。RN 按后端真实
 *    shape 消费(favoritedAt 作收藏时间、id 作删除参数),不照抄该坏 type,差异如实登记。
 *  - DELETE /api/business-card/favorites/:id
 *    (business-card-routes.ts:309-329)——**:id = 名片 id(cardId)**,后端按
 *    cardId + userId 删收藏行;404 = '收藏记录不存在'(:321)。web 页传 entry.favoriteId
 *    (undefined)同样是那处缺陷的连带;RN 传行的真实 id。
 *  - 分页参数走 parsePagination(business-card-routes.ts:268),page/pageSize 与 chat 域同形态。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** 收藏行(GET data.list 元素,字段=后端 select 别名逐字现读) */
export interface BusinessCardFavoriteRow {
  /** 名片 id(DELETE 取消收藏的参数) */
  id: string
  /** 名片所有者 user id */
  userId: string
  name: string
  title?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  avatar?: string | null
  intro?: string | null
  qrCode?: string | null
  isPublic?: number | boolean
  viewCount?: number
  /** 名片创建时间(非收藏时间) */
  createdAt: string
  updatedAt: string
  /** 收藏时间(businessCardFavorites.createdAt) */
  favoritedAt: string
  favoriteCount?: number
  authorNickname?: string | null
  authorAvatar?: string | null
}

export interface BusinessCardFavoritesResult {
  list: BusinessCardFavoriteRow[]
  total: number
  page: number
  pageSize: number
}

export interface BusinessCardFavoritesQuery {
  page?: number
  pageSize?: number
}

export async function getBusinessCardFavorites(
  query: BusinessCardFavoritesQuery = {},
): Promise<ApiResult<BusinessCardFavoritesResult>> {
  return fetchApi<BusinessCardFavoritesResult>(`/api/business-card/favorites${buildQs(query)}`)
}

/** 取消收藏:参数是名片 id(后端按 cardId+userId 删行,business-card-routes.ts:314-319) */
export async function unfavoriteBusinessCard(
  cardId: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/api/business-card/favorites/${cardId}`, {
    method: 'DELETE',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
