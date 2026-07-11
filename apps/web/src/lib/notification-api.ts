/**
 * 通知相关 API
 * 合并迁移自旧架构：message, notification, customer-service
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

/** 消息 */
export interface MessageItem {
  id: string
  fromUserId: string
  fromNickname: string
  fromAvatar?: string | null
  content: string
  isRead: boolean
  createdAt: string
  [key: string]: unknown
}

/** 通知 */
export interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
  link?: string
  extra?: Record<string, unknown>
  [key: string]: unknown
}

/** 客服会话 */
export interface CustomerServiceSession {
  id: string
  userId: string
  userNickname?: string
  userAvatar?: string
  agentId?: string
  agentName?: string
  status: 'pending' | 'active' | 'closed'
  lastMessage?: string
  lastMessageAt?: string
  createdAt: string
  [key: string]: unknown
}

/** 客服消息 */
export interface CustomerServiceMessage {
  id: string
  sessionId: string
  fromId: string
  fromType: 'user' | 'agent' | 'bot'
  content: string
  type?: 'text' | 'image' | 'file' | 'system'
  isRead: boolean
  createdAt: string
  [key: string]: unknown
}

/** 未读统计 */
export interface UnreadCount {
  message: number
  notification: number
  customerService: number
  total: number
  [key: string]: number
}

// ===================== message（消息） =====================

/** 获取消息列表 */
export async function getMessages(
  query: PageQuery = {},
): Promise<ApiResult<PageData<MessageItem>>> {
  return fetchApi<PageData<MessageItem>>(`/api/messages${buildQs(query)}`)
}

/** 获取消息详情 */
export async function getMessageDetail(id: string): Promise<ApiResult<MessageItem>> {
  return fetchApi<MessageItem>(`/api/messages/${id}`)
}

/** 发送消息 */
export async function sendMessage(input: {
  toUserId: string
  content: string
  type?: 'text' | 'image' | 'file'
}): Promise<ApiResult<MessageItem>> {
  return fetchApi<MessageItem>('/api/messages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 标记消息已读 */
export async function markMessageRead(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/messages/${id}/read`, { method: 'POST' })
}

/** 批量标记消息已读 */
export async function markAllMessagesRead(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/messages/read-all', { method: 'POST' })
}

/** 删除消息 */
export async function deleteMessage(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/messages/${id}`, { method: 'DELETE' })
}

// ===================== notification（通知） =====================

/** 获取通知列表 */
export async function getNotifications(
  query: PageQuery & { type?: string; isRead?: boolean } = {},
): Promise<ApiResult<PageData<NotificationItem>>> {
  return fetchApi<PageData<NotificationItem>>(`/api/notifications${buildQs(query)}`)
}

/** 获取通知详情 */
export async function getNotificationDetail(id: string): Promise<ApiResult<NotificationItem>> {
  return fetchApi<NotificationItem>(`/api/notifications/${id}`)
}

/** 创建通知（管理员） */
export async function createNotification(input: {
  type: string
  title: string
  content: string
  userIds?: string[]
  link?: string
}): Promise<ApiResult<NotificationItem>> {
  return fetchApi<NotificationItem>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 标记通知已读 */
export async function markNotificationRead(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' })
}

/** 批量标记通知已读 */
export async function markAllNotificationsRead(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' })
}

/** 删除通知 */
export async function deleteNotification(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' })
}

// ===================== customer-service（客服） =====================

/** 创建客服会话 */
export async function createCustomerServiceSession(input: {
  topic?: string
  category?: string
}): Promise<ApiResult<CustomerServiceSession>> {
  return fetchApi<CustomerServiceSession>('/api/customer-service/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取客服会话列表 */
export async function getCustomerServiceSessions(
  query: PageQuery & { status?: CustomerServiceSession['status'] } = {},
): Promise<ApiResult<PageData<CustomerServiceSession>>> {
  return fetchApi<PageData<CustomerServiceSession>>(
    `/api/customer-service/sessions${buildQs(query)}`,
  )
}

/** 获取客服会话详情 */
export async function getCustomerServiceSessionDetail(
  id: string,
): Promise<ApiResult<CustomerServiceSession>> {
  return fetchApi<CustomerServiceSession>(`/api/customer-service/sessions/${id}`)
}

/** 关闭客服会话 */
export async function closeCustomerServiceSession(
  id: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/customer-service/sessions/${id}/close`, {
    method: 'POST',
  })
}

/** 获取客服消息列表 */
export async function getCustomerServiceMessages(
  sessionId: string,
  query: PageQuery = {},
): Promise<ApiResult<PageData<CustomerServiceMessage>>> {
  return fetchApi<PageData<CustomerServiceMessage>>(
    `/api/customer-service/sessions/${sessionId}/messages${buildQs(query)}`,
  )
}

/** 发送客服消息 */
export async function sendCustomerServiceMessage(input: {
  sessionId: string
  content: string
  type?: 'text' | 'image' | 'file'
}): Promise<ApiResult<CustomerServiceMessage>> {
  return fetchApi<CustomerServiceMessage>('/api/customer-service/messages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取客服常见问题 */
export async function getCustomerServiceFaq(
  query: PageQuery & { category?: string } = {},
): Promise<
  ApiResult<PageData<{ id: string; question: string; answer: string; category?: string }>>
> {
  return fetchApi<PageData<{ id: string; question: string; answer: string; category?: string }>>(
    `/api/customer-service/faq${buildQs(query)}`,
  )
}

// ===================== 未读统计 =====================

/** 获取未读消息/通知数量 */
export async function getUnreadCount(): Promise<ApiResult<UnreadCount>> {
  return fetchApi<UnreadCount>('/api/notifications/unread-count')
}
