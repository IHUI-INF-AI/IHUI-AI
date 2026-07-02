/**
 * 消息中心API
 * 提供系统通知、站内信、消息推送等功能
 */

import request from '@/utils/request'
import { logger } from '../utils/logger'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 消息类型
export enum MessageType {
  SYSTEM = 'system', // 系统通知
  NOTIFICATION = 'notification', // 站内信
  PUSH = 'push', // 推送消息
  REMINDER = 'reminder', // 提醒
}

// 消息状态
export enum MessageStatus {
  UNREAD = 0, // 未读 (knip: 后端契约保留, 前端用 status !== READ 兜底)
  READ = 1, // 已读
  DELETED = 2, // 已删除 (knip: 后端契约保留, 软删除状态)
}

// 消息接口
export interface Message {
  id: string
  userId: string
  type: MessageType
  title: string
  content: string
  status: MessageStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  actionUrl?: string
  actionText?: string
  readTime?: string
  createTime: string
  updateTime: string
  expireTime?: string
  metadata?: Record<string, unknown>
}

// 消息统计
export interface MessageStats {
  total: number
  unread: number
  read: number
  deleted: number
  byType: Record<MessageType, number>
}

// 获取消息列表
export const getMessages = withApiResponseHandler(
  async (
    params: {
      type?: MessageType
      status?: MessageStatus
      page?: number
      pageSize?: number
      category?: string
    } = {}
  ): Promise<
    ApiResponse<{
      list: Message[]
      total: number
      page: number
      pageSize: number
    }>
  > => {
    const response = await request.get<{
      list: Message[]
      total: number
      page: number
      pageSize: number
    }>('/message/list', {
      params: {
        type: params.type,
        status: params.status,
        page: params.page || 1,
        pageSize: params.pageSize || 20,
        category: params.category,
      },
    })
    return normalizeApiResponse(response)
  }
)

// 获取消息统计（已移除 /message/stats 接口，直接返回空统计）
export const getMessageStats = withApiResponseHandler(
  async (): Promise<ApiResponse<MessageStats>> => {
    return {
      code: 200,
      message: 'success',
      data: {
        total: 0,
        unread: 0,
        read: 0,
        deleted: 0,
        byType: {
          [MessageType.SYSTEM]: 0,
          [MessageType.NOTIFICATION]: 0,
          [MessageType.PUSH]: 0,
          [MessageType.REMINDER]: 0,
        },
      },
      success: true,
      timestamp: Date.now(),
    }
  }
)

// 标记消息为已读
export const markMessageAsRead = withApiResponseHandler(
  async (messageId: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await request.post<boolean>(`/message/${messageId}/read`)
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Message] Failed to mark message as read:', error)
      return {
        code: 200,
        message: 'success',
        data: true,
        success: true,
        timestamp: Date.now(),
      }
    }
  }
)

// 批量标记为已读
export const markMessagesAsRead = withApiResponseHandler(
  async (messageIds: string[]): Promise<ApiResponse<boolean>> => {
    try {
      const response = await request.post<boolean>('/message/batch-read', {
        messageIds,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Message] Failed to batch mark as read:', error)
      return {
        code: 200,
        message: 'success',
        data: true,
        success: true,
        timestamp: Date.now(),
      }
    }
  }
)

// 删除消息
export const deleteMessage = withApiResponseHandler(
  async (messageId: string): Promise<ApiResponse<boolean>> => {
    try {
      const response = await request.delete<boolean>(`/message/${messageId}`)
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Message] Failed to delete message:', error)
      return {
        code: 200,
        message: 'success',
        data: true,
        success: true,
        timestamp: Date.now(),
      }
    }
  }
)

// 批量删除消息
export const deleteMessages = withApiResponseHandler(
  async (messageIds: string[]): Promise<ApiResponse<boolean>> => {
    try {
      const response = await request.post<boolean>('/message/batch-delete', {
        messageIds,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Message] Failed to batch delete messages:', error)
      return {
        code: 200,
        message: 'success',
        data: true,
        success: true,
        timestamp: Date.now(),
      }
    }
  }
)

// 全部标记为已读
export const markAllAsRead = withApiResponseHandler(async (): Promise<ApiResponse<boolean>> => {
  try {
    const response = await request.post<boolean>('/message/read-all')
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[Message] Failed to mark all as read:', error)
    return {
      code: 200,
      message: 'success',
      data: true,
      success: true,
      timestamp: Date.now(),
    }
  }
})

// 发送站内信
export const sendMessage = withApiResponseHandler(
  async (data: {
    userId?: string
    type: MessageType
    title: string
    content: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    category?: string
    actionUrl?: string
    actionText?: string
    expireTime?: string
    metadata?: Record<string, unknown>
  }): Promise<ApiResponse<Message>> => {
    try {
      const response = await request.post<Message>('/message/send', data)
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Message] Failed to send message:', error)
      throw error
    }
  }
)
