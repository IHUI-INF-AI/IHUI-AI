import { CUSTOMER_SERVICE_PATHS } from '@/config/backend-paths'

/**
 * 客服系统API
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 客服消息
export interface CustomerServiceMessage {
  id: string
  type: 'text' | 'image' | 'file' | 'system'
  content: string
  senderId: string
  senderName: string
  senderAvatar?: string
  receiverId?: string
  receiverName?: string
  files?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>
  status: 'sending' | 'sent' | 'read' | 'failed'
  createTime: string
  readTime?: string
}

// 工单
export interface Ticket {
  id: string
  title: string
  description: string
  type: 'technical' | 'billing' | 'account' | 'feature' | 'bug' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'processing' | 'resolved' | 'closed'
  userId: string
  userName: string
  userEmail?: string
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>
  replies?: TicketReply[]
  rating?: TicketRating
  createTime: string
  updateTime: string
  resolveTime?: string
}

// 工单回复
export interface TicketReply {
  id: string
  ticketId: string
  content: string
  senderId: string
  senderName: string
  senderType: 'user' | 'staff'
  senderAvatar?: string
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>
  createTime: string
}

// 工单评价
export interface TicketRating {
  id: string
  ticketId: string
  rating: number // 1-5
  comment?: string
  createTime: string
}

// 常见问题
export interface FAQ {
  id: string
  category: string
  question: string
  answer: string
  order: number
}

// 获取客服消息历史
export interface GetMessagesParams extends PaginationParams {
  conversationId?: string
  startTime?: string
  endTime?: string
}

export interface MessageListResponse {
  list: CustomerServiceMessage[]
  total: number
  conversationId?: string
}

/**
 * 获取客服消息历史
 */
export const getCustomerServiceMessages = withApiResponseHandler(
  async (params?: GetMessagesParams): Promise<ApiResponse<MessageListResponse>> => {
    const response = await request.get<MessageListResponse>(CUSTOMER_SERVICE_PATHS.messages, {
      params,
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 发送客服消息
 */
export const sendCustomerServiceMessage = withApiResponseHandler(
  async (data: {
    content: string
    type?: 'text' | 'image' | 'file'
    files?: File[]
    conversationId?: string
  }): Promise<ApiResponse<CustomerServiceMessage>> => {
    const formData = new FormData()
    formData.append('content', data.content)
    if (data.type) {
      formData.append('type', data.type)
    }
    if (data.conversationId) {
      formData.append('conversationId', data.conversationId)
    }
    if (data.files && data.files.length > 0) {
      data.files.forEach((file, index) => {
        formData.append(`files[${index}]`, file)
      })
    }

    const response = await request.post<CustomerServiceMessage>(
      CUSTOMER_SERVICE_PATHS.messages,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return normalizeApiResponse(response)
  }
)

/**
 * 标记消息为已读
 */
export const markMessagesAsRead = withApiResponseHandler(
  async (messageIds: string[]): Promise<ApiResponse<void>> => {
    const response = await request.post<void>(CUSTOMER_SERVICE_PATHS.messagesRead, {
      messageIds,
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 获取工单列表
 */
export interface GetTicketsParams extends PaginationParams {
  status?: Ticket['status']
  type?: Ticket['type']
  priority?: Ticket['priority']
  startTime?: string
  endTime?: string
}

export interface TicketListResponse {
  list: Ticket[]
  total: number
}

export const getTickets = withApiResponseHandler(
  async (params?: GetTicketsParams): Promise<ApiResponse<TicketListResponse>> => {
    const response = await request.get<TicketListResponse>(CUSTOMER_SERVICE_PATHS.tickets, {
      params,
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 创建工单
 */
export const createTicket = withApiResponseHandler(
  async (data: {
    title: string
    description: string
    type: Ticket['type']
    priority?: Ticket['priority']
    attachments?: File[]
  }): Promise<ApiResponse<Ticket>> => {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('description', data.description)
    formData.append('type', data.type)
    if (data.priority) {
      formData.append('priority', data.priority)
    }
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file)
      })
    }

    const response = await request.post<Ticket>(CUSTOMER_SERVICE_PATHS.tickets, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return normalizeApiResponse(response)
  }
)

/**
 * 获取工单详情
 */
export const getTicket = withApiResponseHandler(
  async (ticketId: string): Promise<ApiResponse<Ticket>> => {
    const response = await request.get<Ticket>(CUSTOMER_SERVICE_PATHS.ticketById(ticketId))
    return normalizeApiResponse(response)
  }
)

/**
 * 回复工单
 */
export const replyTicket = withApiResponseHandler(
  async (
    ticketId: string,
    data: {
      content: string
      attachments?: File[]
    }
  ): Promise<ApiResponse<TicketReply>> => {
    const formData = new FormData()
    formData.append('content', data.content)
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file)
      })
    }

    const response = await request.post<TicketReply>(
      CUSTOMER_SERVICE_PATHS.ticketReplies(ticketId),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return normalizeApiResponse(response)
  }
)

/**
 * 评价工单
 */
export const rateTicket = withApiResponseHandler(
  async (
    ticketId: string,
    data: {
      rating: number
      comment?: string
    }
  ): Promise<ApiResponse<TicketRating>> => {
    const response = await request.post<TicketRating>(
      CUSTOMER_SERVICE_PATHS.ticketRate(ticketId),
      data
    )
    return normalizeApiResponse(response)
  }
)

/**
 * 关闭工单
 */
export const closeTicket = withApiResponseHandler(
  async (ticketId: string): Promise<ApiResponse<void>> => {
    const response = await request.post<void>(CUSTOMER_SERVICE_PATHS.ticketClose(ticketId))
    return normalizeApiResponse(response)
  }
)

/**
 * 获取常见问题
 */
export interface GetFAQsParams {
  category?: string
}

export interface FAQListResponse {
  list: FAQ[]
  categories: string[]
}

export const getFAQs = withApiResponseHandler(
  async (params?: GetFAQsParams): Promise<ApiResponse<FAQListResponse>> => {
    const response = await request.get<FAQListResponse>(CUSTOMER_SERVICE_PATHS.faqs, {
      params,
    })
    return normalizeApiResponse(response)
  }
)
