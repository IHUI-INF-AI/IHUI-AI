/**
 * 消息模块 — 发布 / 订阅 / 状态查询。
 *
 * 端点(4 个):
 * - POST   /v1/messages(发布消息)
 * - POST   /v1/messages/subscribe(订阅频道)
 * - DELETE /v1/messages/subscribe/:id(取消订阅)
 * - GET    /v1/messages/:id/status(消息状态)
 */

import type { BaseClient } from './base.js'
import type {
  V1PublishMessageRequest,
  V1PublishMessageResponse,
  V1SubscribeMessageRequest,
  V1SubscribeMessageResponse,
  V1MessageStatusResponse,
} from '@ihui/types'

/** 取消订阅响应。 */
export interface V1UnsubscribeResponse {
  subscriptionId: string
  status: 'unsubscribed'
}

export interface MessagesModule {
  /** POST /v1/messages(发布消息)。 */
  publish(req: V1PublishMessageRequest): Promise<V1PublishMessageResponse>
  /** POST /v1/messages/subscribe(订阅频道)。 */
  subscribe(req: V1SubscribeMessageRequest): Promise<V1SubscribeMessageResponse>
  /** DELETE /v1/messages/subscribe/:id(取消订阅)。 */
  unsubscribe(subscriptionId: string): Promise<V1UnsubscribeResponse>
  /** GET /v1/messages/:id/status(消息状态)。 */
  getStatus(messageId: string): Promise<V1MessageStatusResponse>
}

export function createMessagesModule(client: BaseClient): MessagesModule {
  return {
    publish: (req) => client.request<V1PublishMessageResponse>('POST', '/messages', req),
    subscribe: (req) => client.request<V1SubscribeMessageResponse>('POST', '/messages/subscribe', req),
    unsubscribe: (subscriptionId) =>
      client.request<V1UnsubscribeResponse>(
        'DELETE',
        `/messages/subscribe/${encodeURIComponent(subscriptionId)}`,
      ),
    getStatus: (messageId) =>
      client.request<V1MessageStatusResponse>(
        'GET',
        `/messages/${encodeURIComponent(messageId)}/status`,
      ),
  }
}
