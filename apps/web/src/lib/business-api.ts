/**
 * 业务相关 API
 * 合并迁移自旧架构：checkin, ranking, tools, plaza, fund, trader, stock, groups, miniprogram, product-identity
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 签到 */
export interface Checkin {
  cid: number
  continuousNum: number
  memberId?: string
  createTime?: string | null
  [key: string]: unknown
}

/** 签到记录 */
export interface CheckinRecord {
  rid: number
  type: string
  memberId?: string
  createTime?: string | null
  [key: string]: unknown
}

/** 排行榜条目 */
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
  types?: string[]
  categories?: string[]
  status?: string
  creator?: string
  creatorAvatar?: string
  createdAt?: string
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

/** 交易者 */
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

/** 小程序 */
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

// ===================== checkin（签到） =====================

/** 签到列表 */
export async function getCheckinList(
  query: PageQuery & { memberId?: string } = {},
): Promise<ApiResult<PageData<Checkin>>> {
  return fetchApi<PageData<Checkin>>(`/api/checkin/list${buildQs(query)}`)
}

/** 签到详情 */
export async function getCheckinDetail(cid: number): Promise<ApiResult<Checkin>> {
  return fetchApi<Checkin>(`/api/checkin/${cid}`)
}

/** 创建签到 */
export async function createCheckin(input: {
  continuousNum: number
  memberId?: string
}): Promise<ApiResult<Checkin>> {
  return fetchApi<Checkin>('/api/checkin', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 修改签到 */
export async function updateCheckin(
  cid: number,
  input: { continuousNum?: number },
): Promise<ApiResult<Checkin>> {
  return fetchApi<Checkin>(`/api/checkin/${cid}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除签到 */
export async function deleteCheckin(cid: number): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/checkin/${cid}`, { method: 'DELETE' })
}

/** 签到记录列表 */
export async function getCheckinRecords(
  query: PageQuery & { memberId?: string; type?: string } = {},
): Promise<ApiResult<PageData<CheckinRecord>>> {
  return fetchApi<PageData<CheckinRecord>>(`/api/checkin/record/list${buildQs(query)}`)
}

/** 签到记录详情 */
export async function getCheckinRecordDetail(rid: number): Promise<ApiResult<CheckinRecord>> {
  return fetchApi<CheckinRecord>(`/api/checkin/record/${rid}`)
}

/** 创建签到记录 */
export async function createCheckinRecord(input: {
  type: string
}): Promise<ApiResult<CheckinRecord>> {
  return fetchApi<CheckinRecord>('/api/checkin/record', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 修改签到记录 */
export async function updateCheckinRecord(
  rid: number,
  input: { type?: string },
): Promise<ApiResult<CheckinRecord>> {
  return fetchApi<CheckinRecord>(`/api/checkin/record/${rid}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除签到记录 */
export async function deleteCheckinRecord(rid: number): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/checkin/record/${rid}`, { method: 'DELETE' })
}

// ===================== ranking（排行榜） =====================

/** 获取排行榜列表 */
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
  query: PageQuery & {
    status?: string
    search?: string
    creator?: string
    types?: string[]
    categories?: string[]
  } = {},
): Promise<ApiResult<PageData<PlazaItem>>> {
  return fetchApi<PageData<PlazaItem>>(`/api/plaza${buildQs(query)}`)
}

/** 获取广场详情 */
export async function getPlazaDetail(id: string): Promise<ApiResult<PlazaItem>> {
  return fetchApi<PlazaItem>(`/api/plaza/${id}`)
}

/** 发布广场任务 */
export async function createPlaza(input: {
  title: string
  description: string
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

/** 获取基金净值历史 */
export async function getFundNetValueHistory(
  code: string,
  query: { start?: string; end?: string } = {},
): Promise<ApiResult<Array<{ date: string; netValue: number }>>> {
  return fetchApi<Array<{ date: string; netValue: number }>>(
    `/api/fund/${code}/history${buildQs(query)}`,
  )
}

// ===================== trader（交易者） =====================

/** 获取交易者列表 */
export async function getTraders(
  query: PageQuery & { level?: number } = {},
): Promise<ApiResult<PageData<Trader>>> {
  return fetchApi<PageData<Trader>>(`/api/trader${buildQs(query)}`)
}

/** 获取交易者详情 */
export async function getTraderDetail(id: string): Promise<ApiResult<Trader>> {
  return fetchApi<Trader>(`/api/trader/${id}`)
}

/** 关注交易者 */
export async function followTrader(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/trader/${id}/follow`, { method: 'POST' })
}

/** 取消关注交易者 */
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
    method: 'PUT',
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

/** 退出群组 */
export async function leaveGroup(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/groups/${id}/leave`, { method: 'POST' })
}

// ===================== miniprogram（小程序） =====================

/** 获取小程序列表 */
export async function getMiniprograms(
  query: PageQuery & { category?: string } = {},
): Promise<ApiResult<PageData<Miniprogram>>> {
  return fetchApi<PageData<Miniprogram>>(`/api/miniprogram${buildQs(query)}`)
}

/** 获取小程序详情 */
export async function getMiniprogramDetail(id: string): Promise<ApiResult<Miniprogram>> {
  return fetchApi<Miniprogram>(`/api/miniprogram/${id}`)
}

/** 创建小程序 */
export async function createMiniprogram(
  input: Partial<Miniprogram>,
): Promise<ApiResult<Miniprogram>> {
  return fetchApi<Miniprogram>('/api/miniprogram', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新小程序 */
export async function updateMiniprogram(
  id: string,
  input: Partial<Miniprogram>,
): Promise<ApiResult<Miniprogram>> {
  return fetchApi<Miniprogram>(`/api/miniprogram/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除小程序 */
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
    method: 'PUT',
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
