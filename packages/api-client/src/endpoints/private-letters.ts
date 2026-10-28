// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 私信相关 API(legacy /auth-api/private-letter 补开发,7 个端点)
 * 对应后端:apps/api/src/routes/private-letters.ts(prefix: /api/private-letters)
 * 数据表: t_private_letter;全部端点需登录,仅发送者/接收者可见自己的私信
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

// ===================== 类型定义 =====================

/** 私信记录(对应数据表 t_private_letter) */
export interface PrivateLetter {
  id: number
  senderId: string
  receiverId: string
  content: string
  isRead: boolean
  status: string
  createTime?: string | null
  [key: string]: unknown
}

/** 私信会员列表项(联表 users 返回对方信息) */
export interface PrivateLetterMember {
  letter: PrivateLetter
  counterpartId: string
  counterpartName: string | null
  [key: string]: unknown
}

/** 私信会员列表响应 */
export interface PrivateLetterMemberPage {
  list: PrivateLetterMember[]
  total: number
  page: number
  pageSize: number
}

/** 私信内容列表响应(/list 与 /new 共用) */
export interface PrivateLetterListPage {
  list: PrivateLetter[]
  currentUserId: string
  page: number
  pageSize: number
}

// ===================== 端点封装 =====================

/** 发送私信 — POST /api/private-letters */
export async function sendPrivateLetter(input: {
  receiverId: string
  content: string
}): Promise<ApiResult<PrivateLetter>> {
  return fetchApi<PrivateLetter>('/api/private-letters', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 删除私信(仅发送者或接收者可删自己的) — DELETE /api/private-letters */
export async function deletePrivateLetter(
  id: number,
): Promise<ApiResult<{ id: number; deleted: boolean }>> {
  return fetchApi<{ id: number; deleted: boolean }>('/api/private-letters', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

/** 获取私信详情(仅发送者或接收者可查) — GET /api/private-letters?id= */
export async function getPrivateLetterDetail(id: number): Promise<ApiResult<PrivateLetter>> {
  return fetchApi<PrivateLetter>(`/api/private-letters${buildQs({ id })}`)
}

/** 获取私信会员列表(与当前用户有过往来的会员,按最新时间倒序) — GET /api/private-letters/members */
export async function getPrivateLetterMembers(
  query: { page?: number; pageSize?: number; memberNameKeyword?: string } = {},
): Promise<ApiResult<PrivateLetterMemberPage>> {
  return fetchApi<PrivateLetterMemberPage>(`/api/private-letters/members${buildQs(query)}`)
}

/** 获取与某会员的最新一条私信 — GET /api/private-letters/member?memberId= */
export async function getPrivateLetterLatest(
  memberId: string,
): Promise<ApiResult<PrivateLetter | null>> {
  return fetchApi<PrivateLetter | null>(`/api/private-letters/member${buildQs({ memberId })}`)
}

/** 获取与某会员的私信内容列表(支持 id 游标分页) — GET /api/private-letters/list */
export async function getPrivateLetterList(query: {
  page?: number
  pageSize?: number
  senderId: string
  id?: number
}): Promise<ApiResult<PrivateLetterListPage>> {
  return fetchApi<PrivateLetterListPage>(`/api/private-letters/list${buildQs(query)}`)
}

/** 获取最新私信列表(每个 senderId 一条,支持 senderId 过滤 + id 游标) — GET /api/private-letters/new */
export async function getPrivateLetterNewList(
  query: { page?: number; pageSize?: number; senderId?: string; id?: number } = {},
): Promise<ApiResult<PrivateLetterListPage>> {
  return fetchApi<PrivateLetterListPage>(`/api/private-letters/new${buildQs(query)}`)
}

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
