import { t } from '@/utils/i18n'

/**
 * AI模型代理API
 * 对应后端路由：/cozeZhsApi/ai
 */

import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import { logger } from '../utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// AI模型信息
export interface AIModel {
  id: string
  name: string
  provider: string
  description?: string
  maxTokens?: number
  supportsStreaming?: boolean
}

// AI模型列表响应
export interface AIModelListResponse {
  models: AIModel[]
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// AI聊天完成请求
export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  user_uuid?: string
  chat_id?: string
  temperature?: number
  max_tokens?: number
}

// AI聊天完成响应
export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// 流式事件类型
export type StreamEventType = 'start' | 'chunk' | 'completed' | 'error'

// 流式事件数据
export interface StreamEvent {
  event: StreamEventType
  model?: string
  content?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason?: string
  message?: string
}

// 获取支持的模型列表
export const getSupportedModels = withApiResponseHandler(
  async (): Promise<ApiResponse<AIModelListResponse>> => {
    const response = await request.get<AIModelListResponse>(COZE_PATHS.ai.models)
    return normalizeApiResponse(response)
  }
)

// 调用AI模型（非流式）
export const chatCompletions = withApiResponseHandler(
  async (data: ChatCompletionRequest): Promise<ApiResponse<ChatCompletionResponse>> => {
    const response = await request.post<ChatCompletionResponse>(
      COZE_PATHS.ai.chatCompletions,
      data
    )
    return normalizeApiResponse(response)
  }
)

// 流式调用AI模型（SSE）
export const chatCompletionsStream = async (
  data: ChatCompletionRequest,
  onEvent: (_event: StreamEvent) => void
): Promise<void> => {
  try {
    const response = await fetch(COZE_PATHS.ai.chatCompletionsStream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(StorageManager.getItem(STORAGE_KEYS.TOKEN) || '')}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error(t('error.ai_proxy.无法读取响应流'))
    }

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData: StreamEvent = JSON.parse(line.substring(6))
            onEvent(eventData)
          } catch (error) {
            logger.error('Failed to parse SSE event:', error)
          }
        }
      }
    }
  } catch (error) {
    logger.error('Streaming call failed:', error)
    onEvent({
      event: 'error',
      message: error instanceof Error ? error.message : t('api.ai_proxy.未知错误'),
    })
    throw error
  }
}
