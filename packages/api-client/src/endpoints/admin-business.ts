/**
 * Admin 后台业务管理 API(2026-07-28 立)
 *
 * 补全 admin 端点:覆盖 articles / news / members / live / resources /
 * customer-service / invoices-titles / orders-refunds / shop-withdrawals 9 大模块,
 * 使用 @ihui/types 共享类型契约(与 apps/web/app/(main)/admin 下各 types.ts 对齐).
 *
 * 与 admin.ts(adminGetUsers/adminGetOrders 基础版)、admin-member.ts(member/users 路径)、
 * admin-content.ts(AdminRow 宽松类型)互补:本文件提供精确类型化的端点封装。
 */
import type {
  AdminArticle,
  AdminArticlesData,
  AdminCategory,
  AdminCompaniesData,
  AdminImportResult,
  AdminMember,
  AdminMemberLevel,
  AdminMemberStatistics,
  AdminMembersData,
  AdminResource,
  AdminResourcesData,
  CsAgent,
  CsCategory,
  CsSessionsData,
  CsStats,
  CsTicket,
  EduInvoiceApplication,
  EduOrder,
  EduRefund,
  InvoiceTitle,
  InvoiceTitlesData,
  LiveChannel,
  LiveChannelsData,
  LiveLecturer,
  LiveStatistics,
  NewsArticle,
  NewsArticlesData,
  NewsInformation,
  NewsInfoData,
  OrderStatus,
  RefundStatus,
  WithdrawalFlowItem,
  WithdrawalItem,
} from '@ihui/types'
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData, type PageQuery } from '../utils'

// ===================== articles(文章管理) =====================

export interface AdminArticleQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: 'all' | 'draft' | 'published'
}

export async function listAdminArticles(
  query: AdminArticleQuery = {},
): Promise<ApiResult<AdminArticlesData>> {
  return fetchApi<AdminArticlesData>(`/api/admin/articles${buildQs(query)}`)
}

export async function getAdminArticle(id: string): Promise<ApiResult<AdminArticle>> {
  return fetchApi<AdminArticle>(`/api/admin/articles/${id}`)
}

export async function createAdminArticle(body: {
  title: string
  authorName?: string
  summary?: string
  content?: string
  published?: boolean
}): Promise<ApiResult<AdminArticle>> {
  return fetchApi<AdminArticle>('/api/admin/articles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminArticle(
  id: string,
  body: Partial<Pick<AdminArticle, 'title' | 'authorName' | 'summary' | 'content' | 'status'>>,
): Promise<ApiResult<AdminArticle>> {
  return fetchApi<AdminArticle>(`/api/admin/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminArticle(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/articles/${id}`, { method: 'DELETE' })
}

// ===================== news(资讯管理) =====================

export interface AdminNewsArticleQuery {
  page?: number
  pageSize?: number
  search?: string
  categoryId?: string
  status?: string
}

export async function listAdminNewsArticles(
  query: AdminNewsArticleQuery = {},
): Promise<ApiResult<NewsArticlesData>> {
  return fetchApi<NewsArticlesData>(`/api/admin/news/articles${buildQs(query)}`)
}

export async function getAdminNewsArticle(id: string): Promise<ApiResult<NewsArticle>> {
  return fetchApi<NewsArticle>(`/api/admin/news/articles/${id}`)
}

export async function createAdminNewsArticle(body: Record<string, unknown>): Promise<ApiResult<NewsArticle>> {
  return fetchApi<NewsArticle>('/api/admin/news/articles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminNewsArticle(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<NewsArticle>> {
  return fetchApi<NewsArticle>(`/api/admin/news/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminNewsArticle(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/news/articles/${id}`, { method: 'DELETE' })
}

export async function listAdminNewsCategories(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AdminCategory>>> {
  return fetchApi<PageData<AdminCategory>>(`/api/admin/news/categories${buildQs(query)}`)
}

export async function listAdminNewsInformation(
  query: PageQuery = {},
): Promise<ApiResult<NewsInfoData>> {
  return fetchApi<NewsInfoData>(`/api/admin/news/information${buildQs(query)}`)
}

export async function createAdminNewsInformation(
  body: Partial<NewsInformation>,
): Promise<ApiResult<NewsInformation>> {
  return fetchApi<NewsInformation>('/api/admin/news/information', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminNewsInformation(
  id: string,
  body: Partial<NewsInformation>,
): Promise<ApiResult<NewsInformation>> {
  return fetchApi<NewsInformation>(`/api/admin/news/information/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminNewsInformation(
  id: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/news/information/${id}`, { method: 'DELETE' })
}

// ===================== members(会员管理 - /api/admin/members 路径) =====================

export interface AdminMemberQuery {
  page?: number
  pageSize?: number
  username?: string
  mobile?: string
}

export async function listAdminMembers(
  query: AdminMemberQuery = {},
): Promise<ApiResult<AdminMembersData>> {
  return fetchApi<AdminMembersData>(`/api/admin/members${buildQs(query)}`)
}

export async function getAdminMember(id: string): Promise<ApiResult<AdminMember>> {
  return fetchApi<AdminMember>(`/api/admin/members/${id}`)
}

export async function createAdminMember(body: Record<string, unknown>): Promise<ApiResult<AdminMember>> {
  return fetchApi<AdminMember>('/api/admin/members', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminMember(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminMember>> {
  return fetchApi<AdminMember>(`/api/admin/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminMember(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/members/${id}`, { method: 'DELETE' })
}

export async function getAdminMemberStatistics(): Promise<ApiResult<AdminMemberStatistics>> {
  return fetchApi<AdminMemberStatistics>('/api/admin/members/statistics')
}

export async function listAdminMemberLevels(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AdminMemberLevel>>> {
  return fetchApi<PageData<AdminMemberLevel>>(`/api/admin/members/levels${buildQs(query)}`)
}

export async function listAdminCompanies(
  query: PageQuery = {},
): Promise<ApiResult<AdminCompaniesData>> {
  return fetchApi<AdminCompaniesData>(`/api/admin/members/companies${buildQs(query)}`)
}

export async function batchImportAdminMembers(
  file: File,
): Promise<ApiResult<AdminImportResult>> {
  const form = new FormData()
  form.append('file', file)
  return fetchApi<AdminImportResult>('/api/admin/members/batch-import', {
    method: 'POST',
    body: form,
  })
}

// ===================== live(直播管理) =====================

export interface AdminLiveChannelQuery {
  page?: number
  pageSize?: number
  search?: string
  categoryId?: string
  lecturerId?: string
}

export async function listAdminLiveChannels(
  query: AdminLiveChannelQuery = {},
): Promise<ApiResult<LiveChannelsData>> {
  return fetchApi<LiveChannelsData>(`/api/admin/live/channels${buildQs(query)}`)
}

export async function getAdminLiveChannel(id: string): Promise<ApiResult<LiveChannel>> {
  return fetchApi<LiveChannel>(`/api/admin/live/channels/${id}`)
}

export async function createAdminLiveChannel(body: Record<string, unknown>): Promise<ApiResult<LiveChannel>> {
  return fetchApi<LiveChannel>('/api/admin/live/channels', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminLiveChannel(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<LiveChannel>> {
  return fetchApi<LiveChannel>(`/api/admin/live/channels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminLiveChannel(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/live/channels/${id}`, { method: 'DELETE' })
}

export async function listAdminLiveCategories(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AdminCategory>>> {
  return fetchApi<PageData<AdminCategory>>(`/api/admin/live/categories${buildQs(query)}`)
}

export async function listAdminLiveLecturers(
  query: PageQuery = {},
): Promise<ApiResult<PageData<LiveLecturer>>> {
  return fetchApi<PageData<LiveLecturer>>(`/api/admin/live/lecturers${buildQs(query)}`)
}

export async function getAdminLiveStatistics(): Promise<ApiResult<LiveStatistics>> {
  return fetchApi<LiveStatistics>('/api/admin/live/statistics')
}

// ===================== resources(资源管理) =====================

export interface AdminResourceQuery {
  page?: number
  pageSize?: number
  search?: string
  categoryId?: string
}

export async function listAdminResources(
  query: AdminResourceQuery = {},
): Promise<ApiResult<AdminResourcesData>> {
  return fetchApi<AdminResourcesData>(`/api/admin/resources${buildQs(query)}`)
}

export async function getAdminResource(id: string): Promise<ApiResult<AdminResource>> {
  return fetchApi<AdminResource>(`/api/admin/resources/${id}`)
}

export async function createAdminResource(body: Record<string, unknown>): Promise<ApiResult<AdminResource>> {
  return fetchApi<AdminResource>('/api/admin/resources', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminResource(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminResource>> {
  return fetchApi<AdminResource>(`/api/admin/resources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminResource(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/resources/${id}`, { method: 'DELETE' })
}

export async function listAdminResourceCategories(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AdminCategory>>> {
  return fetchApi<PageData<AdminCategory>>(`/api/admin/resources/categories${buildQs(query)}`)
}

// ===================== customer-service(客服管理) =====================

export interface AdminTicketQuery {
  page?: number
  pageSize?: number
  status?: string
  priority?: string
  categoryId?: string
  assigneeId?: string
}

export async function listAdminTickets(
  query: AdminTicketQuery = {},
): Promise<ApiResult<PageData<CsTicket>>> {
  return fetchApi<PageData<CsTicket>>(`/api/admin/customer-service/tickets${buildQs(query)}`)
}

export async function getAdminTicket(id: string): Promise<ApiResult<CsTicket>> {
  return fetchApi<CsTicket>(`/api/admin/customer-service/tickets/${id}`)
}

export async function updateAdminTicket(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<CsTicket>> {
  return fetchApi<CsTicket>(`/api/admin/customer-service/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function listAdminCsCategories(
  query: PageQuery = {},
): Promise<ApiResult<PageData<CsCategory>>> {
  return fetchApi<PageData<CsCategory>>(`/api/admin/customer-service/categories${buildQs(query)}`)
}

export async function listAdminCsAgents(
  query: PageQuery = {},
): Promise<ApiResult<PageData<CsAgent>>> {
  return fetchApi<PageData<CsAgent>>(`/api/admin/customer-service/agents${buildQs(query)}`)
}

export async function getAdminCsStats(): Promise<ApiResult<CsStats>> {
  return fetchApi<CsStats>('/api/admin/customer-service/stats')
}

export async function listAdminCsSessions(
  query: PageQuery = {},
): Promise<ApiResult<CsSessionsData>> {
  return fetchApi<CsSessionsData>(`/api/admin/customer-service/sessions${buildQs(query)}`)
}

// ===================== invoices/titles(发票抬头管理) =====================

export async function listAdminInvoiceTitles(
  query: PageQuery = {},
): Promise<ApiResult<InvoiceTitlesData>> {
  return fetchApi<InvoiceTitlesData>(`/api/admin/invoices/titles${buildQs(query)}`)
}

export async function createAdminInvoiceTitle(
  body: Omit<InvoiceTitle, 'id' | 'createdAt'>,
): Promise<ApiResult<InvoiceTitle>> {
  return fetchApi<InvoiceTitle>('/api/admin/invoices/titles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminInvoiceTitle(
  id: string,
  body: Partial<Omit<InvoiceTitle, 'id' | 'createdAt'>>,
): Promise<ApiResult<InvoiceTitle>> {
  return fetchApi<InvoiceTitle>(`/api/admin/invoices/titles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteAdminInvoiceTitle(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/admin/invoices/titles/${id}`, { method: 'DELETE' })
}

// ===================== orders/refunds(订单与退款管理) =====================

export interface AdminOrderQueryV2 {
  page?: number
  pageSize?: number
  status?: OrderStatus
  orderType?: string
  search?: string
}

export async function listAdminOrdersV2(
  query: AdminOrderQueryV2 = {},
): Promise<ApiResult<PageData<EduOrder>>> {
  return fetchApi<PageData<EduOrder>>(`/api/admin/orders${buildQs(query)}`)
}

export async function getAdminOrderDetail(id: string): Promise<ApiResult<EduOrder>> {
  return fetchApi<EduOrder>(`/api/admin/orders/${id}`)
}

export interface AdminRefundQuery {
  page?: number
  pageSize?: number
  status?: RefundStatus
  orderType?: string
  search?: string
}

export async function listAdminRefunds(
  query: AdminRefundQuery = {},
): Promise<ApiResult<PageData<EduRefund>>> {
  return fetchApi<PageData<EduRefund>>(`/api/admin/refunds${buildQs(query)}`)
}

export async function getAdminRefundDetail(
  id: string,
): Promise<ApiResult<{ refund: EduRefund; order: EduOrder | null; auditRecords: unknown[] }>> {
  return fetchApi<{ refund: EduRefund; order: EduOrder | null; auditRecords: unknown[] }>(
    `/api/admin/refunds/${id}`,
  )
}

export async function auditAdminRefund(
  id: string,
  body: { action: 'approve' | 'reject'; reason?: string },
): Promise<ApiResult<EduRefund>> {
  return fetchApi<EduRefund>(`/api/admin/refunds/${id}/audit`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listAdminInvoiceApplications(
  query: PageQuery = {},
): Promise<ApiResult<PageData<EduInvoiceApplication>>> {
  return fetchApi<PageData<EduInvoiceApplication>>(`/api/admin/invoices/applications${buildQs(query)}`)
}

// ===================== shop/withdrawals(提现管理) =====================

export interface AdminWithdrawalQuery {
  page?: number
  pageSize?: number
  status?: string
  channel?: string
  search?: string
}

export async function listAdminWithdrawals(
  query: AdminWithdrawalQuery = {},
): Promise<ApiResult<PageData<WithdrawalItem>>> {
  return fetchApi<PageData<WithdrawalItem>>(`/api/admin/shop/withdrawals${buildQs(query)}`)
}

export async function getAdminWithdrawalDetail(id: string): Promise<ApiResult<WithdrawalItem>> {
  return fetchApi<WithdrawalItem>(`/api/admin/shop/withdrawals/${id}`)
}

export async function approveAdminWithdrawal(
  id: string,
  body?: Record<string, unknown>,
): Promise<ApiResult<WithdrawalItem>> {
  return fetchApi<WithdrawalItem>(`/api/admin/shop/withdrawals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  })
}

export async function rejectAdminWithdrawal(
  id: string,
  reason?: string,
): Promise<ApiResult<WithdrawalItem>> {
  return fetchApi<WithdrawalItem>(`/api/admin/shop/withdrawals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || '审核未通过' }),
  })
}

export async function listAdminWithdrawalFlows(
  query: PageQuery = {},
): Promise<ApiResult<PageData<WithdrawalFlowItem>>> {
  return fetchApi<PageData<WithdrawalFlowItem>>(`/api/admin/shop/withdrawal-flow${buildQs(query)}`)
}
