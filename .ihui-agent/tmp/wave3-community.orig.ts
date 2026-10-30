// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Wave3 P10(社区与检索)gap 屏端点封装 —— 后端契约逐条现读(2026-10-26):
 *  - POST /api/circles/:id/posts        → 201 data { post }         (apps/api/src/routes/community/circles.ts:457/532)
 *  - GET  /api/invitations              → data { list }             (apps/api/src/routes/promotions.ts:190)
 *  - POST /api/invitations              → 201 data { invitation }   (apps/api/src/routes/promotions.ts:130/185)
 *  - GET  /api/invitations/invitees     → data { list }             (apps/api/src/routes/promotions.ts:198)
 *  - GET  /api/news/categories          → data { list }             (apps/api/src/routes/news.ts:136)
 *  - GET  /api/news/articles            → data { list,total,page,pageSize } (apps/api/src/routes/news.ts:167;articlesQuerySchema categoryId 须为 uuid)
 *  - GET  /api/search/history           → data { list }             (apps/api/src/routes/search.ts:205/232)
 *  - DELETE /api/search/history         → data { deletedCount }     (apps/api/src/routes/search.ts:237)
 *  - DELETE /api/search/history/:id     → data { id }               (apps/api/src/routes/search.ts:243)
 * fetchApi 已拆 { code, message, data } 信封,本文件 data 泛型即信封内层形状。
 * 圈子列表/发帖 GET 面复用既有 getCircles(community.ts),私信复用 private-letters.ts
 * (§3 共享层优先,零重复实现);本文件只补既有封装缺失的精确形状。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'
import type { PrivateLetter, PrivateLetterMember } from './private-letters.js'

// ===================== 邀请(promotions) =====================

/** 邀请码行(与 apps/api/src/db/promotion-queries.ts invitationFields 投影同形) */
export interface InvitationCodeRow {
  id: string
  code: string
  rewardInviter: number
  rewardInvitee: number
  status: 'unused' | 'used' | 'expired'
  expiresAt: string
}

/** 被邀请人行(与 findInviteesByUser select 投影同形) */
export interface InviteeRow {
  invitationId: string
  inviteeNickname: string | null
  inviteeEmail: string | null
  status: string
  rewardInviter: number
  rewardInvitee: number
  usedAt: string | null
  createdAt: string
}

export async function getInvitationCodes(): Promise<ApiResult<{ list: InvitationCodeRow[] }>> {
  return fetchApi<{ list: InvitationCodeRow[] }>('/api/invitations')
}

export async function generateInvitationCode(): Promise<ApiResult<{ invitation: InvitationCodeRow }>> {
  return fetchApi<{ invitation: InvitationCodeRow }>('/api/invitations', { method: 'POST' })
}

export async function getInviteeList(): Promise<ApiResult<{ list: InviteeRow[] }>> {
  return fetchApi<{ list: InviteeRow[] }>('/api/invitations/invitees')
}

// ===================== 圈子发帖(community) =====================

/** 发帖响应 data(后端 createPost 落库后回传整行,消费方仅需 id) */
export async function submitCirclePost(
  circleId: string,
  input: { title: string; content: string; images?: string[] },
): Promise<ApiResult<{ post: { id: string } }>> {
  return fetchApi<{ post: { id: string } }>(
    `/api/circles/${encodeURIComponent(circleId)}/posts`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

// ===================== 资讯(news) =====================

/** 资讯分类行(GET /api/news/categories;后端仅下发启用分类) */
export interface NewsCategoryRow {
  id: string
  name: string
  sort: number
  status: number
}

/** 资讯文章行(与 web news/category/[id] PageClient 消费面同形) */
export interface NewsArticleRow {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  viewCount: number
  publishedAt?: string | null
  isPinned?: boolean
}

export async function getNewsCategories(): Promise<ApiResult<{ list: NewsCategoryRow[] }>> {
  return fetchApi<{ list: NewsCategoryRow[] }>('/api/news/categories')
}

export async function getNewsArticles(query: {
  page: number
  pageSize: number
  categoryId: string
}): Promise<ApiResult<PageData<NewsArticleRow>>> {
  return fetchApi<PageData<NewsArticleRow>>(`/api/news/articles${buildQs(query)}`)
}

// ===================== 搜索历史(search) =====================

/** 搜索历史行(GET /api/search/history data.list;与 web search/history 页同形) */
export interface SearchHistoryRow {
  id: string
  query: string
  resultsCount: number
  createdAt: string
}

export async function getSearchHistoryRows(
  query: { limit?: number } = {},
): Promise<ApiResult<{ list: SearchHistoryRow[] }>> {
  return fetchApi<{ list: SearchHistoryRow[] }>(`/api/search/history${buildQs(query)}`)
}

export async function deleteSearchHistoryRow(id: string): Promise<ApiResult<{ id: string }>> {
  return fetchApi<{ id: string }>(`/api/search/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function clearSearchHistoryAll(): Promise<ApiResult<{ deletedCount: number }>> {
  return fetchApi<{ deletedCount: number }>('/api/search/history', { method: 'DELETE' })
}

// ===================== 私信形状修正(private-letters 既有封装的 data 面) =====================

/**
 * 私信行精确形状。既有 `PrivateLetter` 类型登记的是 createTime(social-supplement 旧表位),
 * 而本路由实际查表是 relation-tables.ts 的 message_private_letter,时间列逐字为
 * createdAt —— 直接读旧类型拿不到,这里按后端 select() 整行投影收口。
 */
export interface LetterRow {
  id: number
  senderId: string
  receiverId: string
  content: string
  isRead: boolean
  status: string
  createdAt: string
}

function readStr(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** PrivateLetter(带索引签名)→ LetterRow 精确投影;后端时间列取不到时回落 createTime */
export function normalizeLetterRow(raw: PrivateLetter): LetterRow {
  const created = raw.createdAt
  return {
    id: raw.id,
    senderId: raw.senderId,
    receiverId: raw.receiverId,
    content: raw.content,
    isRead: raw.isRead,
    status: typeof raw.status === 'string' ? raw.status : 'normal',
    createdAt: typeof created === 'string' ? created : readStr(raw.createTime),
  }
}

/** 会话列表项(联表对方信息)→ 精确投影 */
export function normalizeLetterMemberRow(raw: PrivateLetterMember): {
  letter: LetterRow
  counterpartId: string
  counterpartName: string
} {
  return {
    letter: normalizeLetterRow(raw.letter),
    counterpartId: raw.counterpartId,
    counterpartName: readStr(raw.counterpartName),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
