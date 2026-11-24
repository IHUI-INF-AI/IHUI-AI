// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客服工单域端点(2026-10-26 Wave1 补屏立,support 域 web→RN 对齐):
 * 覆盖 apps/web/app/(main)/support(TicketList/NewTicketForm/TicketDetailDialog)取数,
 * 对应 apps/api /api/customer-service 路由;各端不得再端内裸 fetch。
 *
 * 信封 data 口径(对齐 web 组件调用点):
 * - GET    /customer-service/tickets             → {list,total}
 * - POST   /customer-service/tickets             → {ticket}  body {title,description,categoryId|null,priority}
 * - GET    /customer-service/categories          → {list}
 * - GET    /customer-service/tickets/:id         → {ticket,comments,rating|null}
 * - POST   /customer-service/tickets/:id/comments → body {content}
 * - POST   /customer-service/tickets/:id/rating   → body {rating,comment|null}
 *
 * 注:notification.ts 既有 customer-service 封装(createCustomerServiceSession 等)
 * 是 IM 会话形态(topic/category + PageData),与工单中心字段契约不同,故本文件另立。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 工单状态(对齐 web apps/web/app/(main)/support/types.ts TicketStatus)。 */
export type SupportTicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'

/** 工单优先级(对齐 web types.ts TicketPriority)。 */
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent'

/** 工单分类(对齐 web types.ts Category)。 */
export interface SupportCategory {
  id: string
  name: string
  slug: string
}

/** 工单主体(对齐 web types.ts Ticket)。 */
export interface SupportTicket {
  id: string
  ticketNo: string
  categoryId: string | null
  title: string
  description: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  source: string
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 工单沟通记录(对齐 web types.ts Comment)。 */
export interface SupportTicketComment {
  id: string
  ticketId: string
  userId: string
  content: string
  isAdmin: boolean
  attachments: unknown[]
  createdAt: string
}

/** 工单服务评价(对齐 web types.ts Rating)。 */
export interface SupportTicketRating {
  id: string
  rating: number
  comment: string | null
}

/** GET /customer-service/tickets 的信封 data。 */
export interface SupportTicketListData {
  list: SupportTicket[]
  total: number
}

/** GET /customer-service/categories 的信封 data。 */
export interface SupportCategoryListData {
  list: SupportCategory[]
}

/** GET /customer-service/tickets/:id 的信封 data。 */
export interface SupportTicketDetailData {
  ticket: SupportTicket
  comments: SupportTicketComment[]
  rating: SupportTicketRating | null
}

/** 获取我的工单列表(用户侧)。 */
export async function getSupportTickets(): Promise<ApiResult<SupportTicketListData>> {
  return fetchApi<SupportTicketListData>('/api/customer-service/tickets')
}

/** 获取工单分类列表(新建工单选分类用)。 */
export async function getSupportCategories(): Promise<ApiResult<SupportCategoryListData>> {
  return fetchApi<SupportCategoryListData>('/api/customer-service/categories')
}

/** 创建工单。 */
export async function createSupportTicket(input: {
  title: string
  description: string
  categoryId: string | null
  priority: SupportTicketPriority
}): Promise<ApiResult<{ ticket: SupportTicket }>> {
  return fetchApi<{ ticket: SupportTicket }>('/api/customer-service/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取工单详情(含沟通记录与既有评价)。 */
export async function getSupportTicketDetail(
  id: string,
): Promise<ApiResult<SupportTicketDetailData>> {
  return fetchApi<SupportTicketDetailData>(`/api/customer-service/tickets/${id}`)
}

/** 补充回复(用户追加沟通内容)。 */
export async function addSupportTicketComment(
  id: string,
  content: string,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/customer-service/tickets/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

/** 提交服务评价(仅 resolved/closed 且未评价时后端放行)。 */
export async function rateSupportTicket(
  id: string,
  rating: number,
  comment: string | null,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/customer-service/tickets/${id}/rating`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
