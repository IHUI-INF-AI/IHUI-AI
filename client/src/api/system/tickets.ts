/**
 * 服务工单API
 */
import { request } from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface Ticket {
  id: string
  title: string
  description: string
  category: 'technical' | 'billing' | 'feature' | 'other'
  status: 'pending' | 'processing' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  closedAt?: string
  userId: string
  replies: TicketReply[]
  attachments?: string[]
}

export interface TicketReply {
  id: string
  ticketId: string
  content: string
  userId: string
  isAdmin: boolean
  createdAt: string
  attachments?: string[]
}

export interface CreateTicketRequest {
  title: string
  description: string
  category: 'technical' | 'billing' | 'feature' | 'other'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  attachments?: string[]
}

export interface ReplyTicketRequest {
  content: string
  attachments?: string[]
}

// 后端响应格式：{ code, msg, data: { list: [], total: number } }
export interface TicketListResponse {
  list: Ticket[]
  total: number
}

/** 工单 API 前缀
 * 2026-06-24 修复: 对齐后端 /api/v1/customer_service/ticket (main.py L335)
 */
const TICKET_API = '/api/v1/customer_service/ticket'

/**
 * 获取工单列表
 * 后端路径: GET /api/zhs_api_ticket/list
 */
export async function getTickets(params?: {
  page?: number
  pageSize?: number
  status?: string
  category?: string
}): Promise<ApiResponse<TicketListResponse>> {
  return request.get(`${TICKET_API}/list`, { params })
}

/**
 * 获取工单详情
 * 后端路径: GET /api/zhs_api_ticket/{id}
 */
export async function getTicket(id: string): Promise<ApiResponse<Ticket>> {
  return request.get(`${TICKET_API}/${id}`)
}

/**
 * 创建工单
 * 后端路径: POST /api/zhs_api_ticket
 */
export async function createTicket(data: CreateTicketRequest): Promise<ApiResponse<Ticket>> {
  return request.post(TICKET_API, data)
}

/**
 * 回复工单
 * 后端路径: POST /api/zhs_api_ticket/{id}/replies
 */
export async function replyTicket(id: string, data: ReplyTicketRequest): Promise<ApiResponse<TicketReply>> {
  return request.post(`${TICKET_API}/${id}/replies`, data)
}

/**
 * 关闭工单
 * 后端路径: POST /api/zhs_api_ticket/{id}/close
 */
export async function closeTicket(id: string): Promise<ApiResponse<void>> {
  return request.post(`${TICKET_API}/${id}/close`)
}

/**
 * 重新打开工单
 * 后端路径: POST /api/zhs_api_ticket/{id}/reopen
 */
export async function reopenTicket(id: string): Promise<ApiResponse<void>> {
  return request.post(`${TICKET_API}/${id}/reopen`)
}

/**
 * 审核工单（管理员）
 * 后端路径: POST /zhs_api_ticket/{id}/audit
 */
export async function auditTicket(
  id: string,
  data: {
    action: 'approve' | 'reject'
    comment?: string
    assignTo?: string // 分配给某个客服
  }
): Promise<ApiResponse<Ticket>> {
  return request.post(`${TICKET_API}/${id}/audit`, data)
}

/**
 * 分配工单（管理员）
 * 后端路径: POST /zhs_api_ticket/{id}/assign
 */
export async function assignTicket(
  id: string,
  assignTo: string
): Promise<ApiResponse<Ticket>> {
  return request.post(`${TICKET_API}/${id}/assign`, { assignTo })
}
