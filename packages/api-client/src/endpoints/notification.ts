// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知相关 API
 * 合并迁移自旧架构：message, notification, customer-service
 *
 * 类型定义已下沉到 @ihui/types/notification.ts(跨端唯一类型源),
 * 此处仅 re-export 保持向后兼容,各端统一从 @ihui/types 或 @ihui/api-client 导入。
 */
import type { ApiResult } from '@ihui/types'
import type {
  MessageItem,
  NotificationItem,
  CustomerServiceSession,
  CustomerServiceMessage,
  UnreadCount,
} from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型 re-export(向后兼容) =====================

export type {
  MessageItem,
  NotificationItem,
  CustomerServiceSession,
  CustomerServiceMessage,
  UnreadCount,
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
  return fetchApi<{ success: boolean }>(`/api/messages/${id}/read`, { method: 'PUT' })
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

// 创建通知(管理员) —— 2026-09-28 门 8 死调用清账:删除。
// POST /api/notifications 从未注册(后端通知由服务端事件产生,管理面在 /admin/notifications/*);
// 本仓零消费方(命中的 createNotification* 是后端同名 db 函数与 createNotificationClient,均非本函数)。

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
  return fetchApi<CustomerServiceSession>('/api/customer-service/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取客服会话列表 */
export async function getCustomerServiceSessions(
  query: PageQuery & { status?: CustomerServiceSession['status'] } = {},
): Promise<ApiResult<PageData<CustomerServiceSession>>> {
  return fetchApi<PageData<CustomerServiceSession>>(
    `/api/customer-service/tickets${buildQs(query)}`,
  )
}

/** 获取客服会话详情 */
export async function getCustomerServiceSessionDetail(
  id: string,
): Promise<ApiResult<CustomerServiceSession>> {
  return fetchApi<CustomerServiceSession>(`/api/customer-service/tickets/${id}`)
}

/** 关闭客服会话 —— 2026-09-28 门 8 死调用清账:删除。
 * POST /api/customer-service/tickets/:id/close 从未注册(后端关单面是 admin 侧
 * PUT /support/tickets/:id/status,admin-support-tickets.ts:106);本仓零消费方。 */

/** 获取客服消息列表 */
export async function getCustomerServiceMessages(
  sessionId: string,
  query: PageQuery = {},
): Promise<ApiResult<PageData<CustomerServiceMessage>>> {
  return fetchApi<PageData<CustomerServiceMessage>>(
    `/api/customer-service/tickets/${sessionId}/comments${buildQs(query)}`,
  )
}

/** 发送客服消息 */
export async function sendCustomerServiceMessage(input: {
  sessionId: string
  content: string
  type?: 'text' | 'image' | 'file'
}): Promise<ApiResult<CustomerServiceMessage>> {
  return fetchApi<CustomerServiceMessage>(
    `/api/customer-service/tickets/${input.sessionId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
