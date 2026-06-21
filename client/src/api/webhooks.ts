import { DEVELOPER_PATHS } from '@/config/backend-paths'

/**
 * Webhook管理API
 */

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

// Webhook配置接口
export interface WebhookConfig {
  id?: string
  name: string
  url: string
  description?: string
  events: string[]
  secret?: string
  enabled: boolean
  timeout?: number
  retryCount?: number
  retryInterval?: number
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5'
  headers?: Record<string, string>
  filters?: Record<string, unknown>
  hasSecret?: boolean
  createTime?: string
  updateTime?: string
}

// Webhook事件日志接口
export interface WebhookEvent {
  id: string
  eventId: string
  eventType: string
  resourceType: string
  resourceId: string
  payload: any
  status: 'pending' | 'delivered' | 'failed'
  responseStatus?: number
  responseBody?: string
  errorMessage?: string
  retryCount: number
  nextRetryAt?: string
  deliveredAt?: string
  createdAt: string
}

// Webhook订阅接口
export interface WebhookSubscription {
  id: string
  eventType: string
  resourceType?: string
  filters?: Record<string, unknown>
  enabled: boolean
}

// Webhook表单接口
export interface WebhookForm {
  name: string
  url: string
  description?: string
  events: string[]
  secret?: string
  enabled: boolean
  timeout?: number
  retryCount?: number
  retryInterval?: number
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5'
  headers?: Record<string, string>
  filters?: Record<string, unknown>
}

// 获取Webhook列表
export async function getWebhooks(
  params?: PaginationParams & {
    enabled?: boolean
    search?: string
  }
): Promise<ApiResponse<PaginationResponse<WebhookConfig>>> {
  return request.get(DEVELOPER_PATHS.webhooks.list, { params })
}

// 获取Webhook详情
export async function getWebhook(
  id: string
): Promise<ApiResponse<WebhookConfig & { subscriptions: WebhookSubscription[] }>> {
  return request.get(DEVELOPER_PATHS.webhooks.byId(id))
}

// 创建Webhook
export async function createWebhook(
  data: WebhookForm
): Promise<ApiResponse<{ id: string; secret: string }>> {
  return request.post(DEVELOPER_PATHS.webhooks.list, data)
}

// 更新Webhook
export async function updateWebhook(
  id: string,
  data: Partial<WebhookForm>
): Promise<ApiResponse<void>> {
  return request.put(DEVELOPER_PATHS.webhooks.byId(id), data)
}

// 删除Webhook
export async function deleteWebhook(id: string): Promise<ApiResponse<void>> {
  return request.delete(DEVELOPER_PATHS.webhooks.byId(id))
}

// 测试Webhook
export async function testWebhook(
  id: string,
  payload?: any
): Promise<
  ApiResponse<{
    success: boolean
    statusCode?: number
    responseBody?: string
    error?: string
  }>
> {
  return request.post(DEVELOPER_PATHS.webhooks.test(id), { payload })
}

// 获取Webhook事件日志
export async function getWebhookEvents(
  id: string,
  params?: PaginationParams & {
    status?: string
  }
): Promise<ApiResponse<PaginationResponse<WebhookEvent>>> {
  return request.get(DEVELOPER_PATHS.webhooks.events(id), { params })
}

// 获取所有可用的事件类型
export async function getWebhookEventTypes(): Promise<
  ApiResponse<{
    events: string[]
    resourceTypes: string[]
  }>
> {
  return request.get(DEVELOPER_PATHS.webhooks.eventTypes)
}

// 获取Webhook统计信息
export interface WebhookStats {
  overview: {
    total: number
    enabled: number
    disabled: number
  }
  events: {
    total: number
    delivered: number
    failed: number
    pending: number
    successRate: string
  }
  dailyStats: Array<{
    date: string
    total: number
    delivered: number
    failed: number
    successRate: string
  }>
  topWebhooks: Array<{
    id: string
    name: string
    eventCount: number
    successCount: number
    failedCount: number
    successRate: string
  }>
}

export async function getWebhookStats(): Promise<ApiResponse<WebhookStats>> {
  return request.get(DEVELOPER_PATHS.webhooks.stats)
}

// 批量操作Webhook
export async function batchWebhookOperation(
  action: 'enable' | 'disable' | 'delete',
  ids: string[]
): Promise<ApiResponse<{ affectedRows: number }>> {
  return request.post(DEVELOPER_PATHS.webhooks.batch, { action, ids })
}

// Webhook事件类型常量
export const WebhookEventTypes = {
  // 模型相关
  MODEL_CREATED: 'model.created',
  MODEL_UPDATED: 'model.updated',
  MODEL_DELETED: 'model.deleted',
  MODEL_ENABLED: 'model.enabled',
  MODEL_DISABLED: 'model.disabled',

  // 工作流相关
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_DELETED: 'workflow.deleted',
  WORKFLOW_EXECUTED: 'workflow.executed',
  WORKFLOW_FAILED: 'workflow.failed',

  // 智能体相关
  AGENT_CREATED: 'agent.created',
  AGENT_UPDATED: 'agent.updated',
  AGENT_DELETED: 'agent.deleted',
  AGENT_PUBLISHED: 'agent.published',
  AGENT_UNPUBLISHED: 'agent.unpublished',

  // API网关相关
  GATEWAY_CREATED: 'gateway.created',
  GATEWAY_UPDATED: 'gateway.updated',
  GATEWAY_DELETED: 'gateway.deleted',
  GATEWAY_ENABLED: 'gateway.enabled',
  GATEWAY_DISABLED: 'gateway.disabled',

  // SDK相关
  SDK_CREATED: 'sdk.created',
  SDK_UPDATED: 'sdk.updated',
  SDK_DELETED: 'sdk.deleted',
  SDK_DOWNLOADED: 'sdk.downloaded',

  // 统计相关
  STATISTICS_UPDATED: 'statistics.updated',
  CALL_COMPLETED: 'call.completed',
  CALL_FAILED: 'call.failed',

  // 订单相关
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_REFUNDED: 'order.refunded',
  ORDER_CANCELLED: 'order.cancelled',

  // 用户相关
  USER_REGISTERED: 'user.registered',
  USER_UPDATED: 'user.updated',
  USER_VIP_ACTIVATED: 'user.vip_activated',
  USER_VIP_EXPIRED: 'user.vip.expired',

  // 消息相关
  MESSAGE_CREATED: 'message.created',
  MESSAGE_READ: 'message.read',

  // 社区相关
  POST_CREATED: 'post.created',
  POST_UPDATED: 'post.updated',
  POST_DELETED: 'post.deleted',
  COMMENT_CREATED: 'comment.created',

  // 课程相关
  COURSE_CREATED: 'course.created',
  COURSE_UPDATED: 'course.updated',
  COURSE_ENROLLED: 'course.enrolled',

  // 插件相关
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
  PLUGIN_UPDATED: 'plugin.updated',
} as const

// 资源类型常量
export const ResourceTypes = {
  MODEL: 'model',
  WORKFLOW: 'workflow',
  AGENT: 'agent',
  GATEWAY: 'gateway',
  SDK: 'sdk',
  ORDER: 'order',
  USER: 'user',
  MESSAGE: 'message',
  POST: 'post',
  COMMENT: 'comment',
  COURSE: 'course',
  PLUGIN: 'plugin',
  STATISTICS: 'statistics',
} as const
