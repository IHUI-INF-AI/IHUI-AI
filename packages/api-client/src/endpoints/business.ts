// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 业务相关 API
 * 合并迁移自旧架构：checkin, ranking, tools, plaza, fund, trader, stock, groups, miniprogram, product-identity
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 排行榜条*/
export interface RankingItem {
  id: string
  userId?: string
  nickname?: string
  avatar?: string
  rank: number
  score: number
  previousRank?: number
  trend?: 'up' | 'down' | 'same'
  extra?: Record<string, unknown>
  [key: string]: unknown
}

/** 工具 */
export interface ToolItem {
  id: string
  name: string
  description?: string
  icon?: string
  url?: string
  category?: string
  status?: number
  sort?: number
  [key: string]: unknown
}

/** 广场任务 */
export interface PlazaItem {
  id: string
  title: string
  description?: string
  type?: string
  types?: string[]
  categories?: string[]
  status?: string
  taskStatus?: string
  rejectReason?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  creator?: string
  creatorAvatar?: string
  createdAt?: string
  lowestPrice?: number | string | null
  peakPrice?: number | string | null
  contact?: string | null
  cycle?: string | null
  cycleUnit?: string | null
  closingTime?: string | null
  imgs?: string | string[] | null
  [key: string]: unknown
}

/** 基金 */
export interface Fund {
  id: string
  code: string
  name: string
  type?: string
  netValue?: number
  netValueDate?: string
  growth?: number
  growthRate?: number
  [key: string]: unknown
}

/** 交易*/
export interface Trader {
  id: string
  userId?: string
  nickname: string
  avatar?: string
  level?: number
  profitRate?: number
  followers?: number
  [key: string]: unknown
}

/** 股票 */
export interface Stock {
  id: string
  code: string
  name: string
  market?: string
  price?: number
  change?: number
  changeRate?: number
  volume?: number
  [key: string]: unknown
}

/** 群组 */
export interface Group {
  id: string
  name: string
  description?: string
  avatar?: string
  ownerId?: string
  memberCount?: number
  type?: string
  status?: number
  createdAt: string
  [key: string]: unknown
}

/** 小程*/
export interface Miniprogram {
  id: string
  appId: string
  name: string
  description?: string
  logo?: string
  qrcode?: string
  category?: string
  status?: number
  [key: string]: unknown
}

/** 产品身份标识 */
export interface ProductIdentity {
  id: string
  productId: string
  productName?: string
  identityType?: string
  identityValue?: string
  status?: number
  verified?: boolean
  createdAt: string
  [key: string]: unknown
}

// ===================== checkin(签到)—— 2026-09-28 门 8 死调用清账:整族删除 =====================
// 旧 RuoYi 架构的 checkin/checkin/record CRUD 九枚函数在本仓**零消费方**(apps/** 现读),
// 后端从未注册过这一族(/api/checkin* 五处被门 8 判死;真签到面是 POST /api/user/check-in、
// GET /api/user/check-in/status、GET /api/sign-in/history 与小程序兼容面 POST /study/signin)。
// 门 8 红行给出的两条正路是"补后端路由或删死调用",为一族无人调用的旧 CRUD 补后端 = 凭空造功能,
// 故取删。类型 Checkin/CheckinRecord 一并摘(仅本文件自用)。恢复走 git 历史,§7 三问已量。

// ===================== ranking（排行榜=====================

/** 获取排行榜列*/
export async function getRanking(
  query: PageQuery & { type?: string; period?: string } = {},
): Promise<ApiResult<PageData<RankingItem>>> {
  return fetchApi<PageData<RankingItem>>(`/api/ranking${buildQs(query)}`)
}

/** 获取用户在排行榜中的位置 */
export async function getUserRanking(type?: string): Promise<ApiResult<RankingItem>> {
  return fetchApi<RankingItem>(`/api/ranking/me${buildQs(type ? { type } : {})}`)
}

// ===================== tools（工具） =====================

/** 获取工具列表 */
export async function getTools(
  query: PageQuery & { category?: string } = {},
): Promise<ApiResult<PageData<ToolItem>>> {
  return fetchApi<PageData<ToolItem>>(`/api/tools${buildQs(query)}`)
}

/** 获取工具详情 */
export async function getToolDetail(id: string): Promise<ApiResult<ToolItem>> {
  return fetchApi<ToolItem>(`/api/tools/${id}`)
}

/** 创建工具 */
export async function createTool(input: Partial<ToolItem>): Promise<ApiResult<ToolItem>> {
  return fetchApi<ToolItem>('/api/tools', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新工具 */
export async function updateTool(
  id: string,
  input: Partial<ToolItem>,
): Promise<ApiResult<ToolItem>> {
  return fetchApi<ToolItem>(`/api/tools/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除工具 */
export async function deleteTool(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/tools/${id}`, { method: 'DELETE' })
}

// ===================== plaza（广场） =====================

/** 获取广场列表 */
export async function getPlazaList(
  query: {
    page?: number
    pageSize?: number
    status?: string
    taskStatus?: string
    search?: string
    creator?: string
    types?: string[]
    categories?: string[]
  } = {},
): Promise<ApiResult<PageData<PlazaItem>>> {
  return fetchApi<PageData<PlazaItem>>(`/api/plaza/list${buildQs(query)}`)
}

/** 获取广场详情 */
export async function getPlazaDetail(id: string): Promise<ApiResult<PlazaItem>> {
  return fetchApi<PlazaItem>(`/api/plaza/${id}`)
}

/** 发布广场任务 */
export async function createPlaza(input: {
  title: string
  description: string
  lowestPrice?: number
  peakPrice?: number
  contact?: string
  cycle?: string
  cycleUnit?: string
  closingTime?: string
  imgs?: string | string[]
  types?: string[]
  categories?: string[]
}): Promise<ApiResult<PlazaItem>> {
  return fetchApi<PlazaItem>('/api/plaza', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新广场任务 */
export async function updatePlaza(
  id: string,
  input: Partial<PlazaItem>,
): Promise<ApiResult<PlazaItem>> {
  return fetchApi<PlazaItem>(`/api/plaza/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除广场任务 */
export async function deletePlaza(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/plaza/${id}`, { method: 'DELETE' })
}

// ===================== fund（基金） =====================

/** 获取基金列表 */
export async function getFunds(
  query: PageQuery & { type?: string; keyword?: string } = {},
): Promise<ApiResult<PageData<Fund>>> {
  return fetchApi<PageData<Fund>>(`/api/fund${buildQs(query)}`)
}

/** 获取基金详情 */
export async function getFundDetail(code: string): Promise<ApiResult<Fund>> {
  return fetchApi<Fund>(`/api/fund/${code}`)
}

/** 获取基金净值历*/
export async function getFundNetValueHistory(
  code: string,
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<Array<{ date: string; netValue: number }>>> {
  return fetchApi<Array<{ date: string; netValue: number }>>(
    `/api/fund/${code}/history${buildQs(query)}`,
  )
}

// ===================== trader（交易者） =====================

/** 获取交易者列*/
export async function getTraders(
  query: PageQuery & { level?: number } = {},
): Promise<ApiResult<PageData<Trader>>> {
  return fetchApi<PageData<Trader>>(`/api/trader${buildQs(query)}`)
}

/** 获取交易者详*/
export async function getTraderDetail(id: string): Promise<ApiResult<Trader>> {
  return fetchApi<Trader>(`/api/trader/${id}`)
}

/** 关注交易*/
export async function followTrader(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/trader/${id}/follow`, { method: 'POST' })
}

/** 取消关注交易*/
export async function unfollowTrader(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/trader/${id}/unfollow`, { method: 'POST' })
}

// ===================== stock（股票） =====================

/** 获取股票列表 */
export async function getStocks(
  query: PageQuery & { market?: string; keyword?: string } = {},
): Promise<ApiResult<PageData<Stock>>> {
  return fetchApi<PageData<Stock>>(`/api/stock${buildQs(query)}`)
}

/** 获取股票详情 */
export async function getStockDetail(code: string): Promise<ApiResult<Stock>> {
  return fetchApi<Stock>(`/api/stock/${code}`)
}

/** 获取股票行情 */
export async function getStockQuote(code: string): Promise<ApiResult<Stock>> {
  return fetchApi<Stock>(`/api/stock/${code}/quote`)
}

// ===================== groups（群组） =====================

/** 获取群组列表 */
export async function getGroups(
  query: PageQuery & { type?: string } = {},
): Promise<ApiResult<PageData<Group>>> {
  return fetchApi<PageData<Group>>(`/api/groups${buildQs(query)}`)
}

/** 获取群组详情 */
export async function getGroupDetail(id: string): Promise<ApiResult<Group>> {
  return fetchApi<Group>(`/api/groups/${id}`)
}

/** 创建群组 */
export async function createGroup(input: Partial<Group>): Promise<ApiResult<Group>> {
  return fetchApi<Group>('/api/groups', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新群组 */
export async function updateGroup(id: string, input: Partial<Group>): Promise<ApiResult<Group>> {
  return fetchApi<Group>(`/api/groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** 删除群组 */
export async function deleteGroup(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/groups/${id}`, { method: 'DELETE' })
}

/** 加入群组 */
export async function joinGroup(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/groups/${id}/join`, { method: 'POST' })
}

/** 退出群*/
export async function leaveGroup(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/groups/${id}/leave`, { method: 'POST' })
}

// ===================== miniprogram（小程序=====================

/** 获取小程序列*/
export async function getMiniprograms(
  query: PageQuery & { category?: string } = {},
): Promise<ApiResult<PageData<Miniprogram>>> {
  return fetchApi<PageData<Miniprogram>>(`/api/miniprogram${buildQs(query)}`)
}

/** 获取小程序详*/
export async function getMiniprogramDetail(id: string): Promise<ApiResult<Miniprogram>> {
  return fetchApi<Miniprogram>(`/api/miniprogram/${id}`)
}

/** 创建小程*/
export async function createMiniprogram(
  input: Partial<Miniprogram>,
): Promise<ApiResult<Miniprogram>> {
  return fetchApi<Miniprogram>('/api/miniprogram', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新小程*/
export async function updateMiniprogram(
  id: string,
  input: Partial<Miniprogram>,
): Promise<ApiResult<Miniprogram>> {
  return fetchApi<Miniprogram>(`/api/miniprogram/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除小程*/
export async function deleteMiniprogram(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/miniprogram/${id}`, { method: 'DELETE' })
}

// ===================== product-identity（产品身份标识） =====================

/** 获取产品身份标识列表 */
export async function getProductIdentityList(
  query: PageQuery & { productId?: string; identityType?: string } = {},
): Promise<ApiResult<PageData<ProductIdentity>>> {
  return fetchApi<PageData<ProductIdentity>>(`/api/product-identity${buildQs(query)}`)
}

/** 获取产品身份标识详情 */
export async function getProductIdentityDetail(id: string): Promise<ApiResult<ProductIdentity>> {
  return fetchApi<ProductIdentity>(`/api/product-identity/${id}`)
}

/** 创建产品身份标识 */
export async function createProductIdentity(
  input: Partial<ProductIdentity>,
): Promise<ApiResult<ProductIdentity>> {
  return fetchApi<ProductIdentity>('/api/product-identity', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新产品身份标识 */
export async function updateProductIdentity(
  id: string,
  input: Partial<ProductIdentity>,
): Promise<ApiResult<ProductIdentity>> {
  return fetchApi<ProductIdentity>(`/api/product-identity/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** 删除产品身份标识 */
export async function deleteProductIdentity(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/product-identity/${id}`, { method: 'DELETE' })
}

/** 验证产品身份标识 */
export async function verifyProductIdentity(input: {
  productId: string
  identityType: string
  identityValue: string
}): Promise<ApiResult<{ verified: boolean; product?: ProductIdentity }>> {
  return fetchApi<{ verified: boolean; product?: ProductIdentity }>(
    '/api/product-identity/verify',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}
