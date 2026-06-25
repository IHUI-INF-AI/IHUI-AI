/**
 * 聊天管理API
 * 对应后端路由：/api/mobile/chat
 */

import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'

// 对话信息接口
export interface Conversation {
  id: string
  title?: string
  type?: string
  createdAt?: string
  updatedAt?: string
  messages?: ChatMessage[]
}

// 聊天消息接口
export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
}

// 聊天会话响应
export interface ChatSessionResponse {
  conversationId?: string
  messages?: ChatMessage[]
}

/**
 * 获取用户UUID
 */
function getUserUuid(): string {
  if (typeof window !== 'undefined') {
    return (
      (window as { userUuid?: string }).userUuid ||
      String(StorageManager.getItem(STORAGE_KEYS.USER_UUID) || '') ||
      `user-${Date.now()}`
    )
  }
  return `user-${Date.now()}`
}

/**
 * 发送聊天消息
 * @param data 聊天请求数据
 * @returns API响应
 */
export async function sendMessage(data: {
  botId?: string
  query: string
  conversationId?: string
  chatHistory?: ChatMessage[]
  stream?: boolean
  context?: Record<string, unknown>
}): Promise<ApiResponse<ChatSessionResponse>> {
  try {
    const { streamChat } = await import('../services/cozeChatStream.service')

    const userUuid = getUserUuid()

    await streamChat(
      {
        bot_id: data.botId || 'default',
        user_id: userUuid,
        query: data.query,
        conversation_id: data.conversationId,
        chat_history: data.chatHistory,
      },
      chunk => {
        if (chunk.type === 'error') {
          logger.error('[chat] Streaming chat error:', chunk.data)
        }
      }
    )

    return {
      code: 200,
      success: true,
      message: '发送成功',
      data: {
        conversationId: data.conversationId,
        messages: [],
      },
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('[chat] Failed to send message:', error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: undefined,
      timestamp: Date.now(),
    }
  }
}
