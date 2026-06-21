import { COZE_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import {
  withApiResponseHandler,
  normalizeApiResponse,
} from '@/utils/api-response'
import { logger } from '@/utils/logger'

export interface AIModel {
  id: string
  name: string
  provider: string
  description?: string
  capabilities: string[]
  pricing?: {
    currency?: string
    price?: number
    unit?: string
  }
  maxTokens?: number
  contextLength?: number
  status: 'active' | 'inactive' | 'deprecated'
  isAvailable: boolean
  createTime?: string
  updateTime?: string
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface AIChatSession {
  id: string
  title?: string
  modelId: string
  modelName: string
  messages: AIChatMessage[]
  createTime: string
  updateTime: string
}

export interface AIGenerationRequest {
  prompt: string
  modelId: string
  type: 'text' | 'image' | 'audio' | 'video' | 'code'
  parameters?: {
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
    width?: number
    height?: number
    steps?: number
    [key: string]: any
  }
}

export interface AIGenerationResponse {
  id: string
  type: string
  content: string
  url?: string
  modelId: string
  modelName: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  timestamp: string
}

export const getAIModels = withApiResponseHandler(
  async (params?: { provider?: string; status?: string }): Promise<ApiResponse<AIModel[]>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: [
          {
            id: 'gpt-4',
            name: 'GPT-4',
            provider: 'OpenAI',
            description: t('text.ai.最先进的大型语言'),
            capabilities: ['text', 'code', 'analysis'],
            pricing: { currency: 'USD', price: 0.03, unit: '1K tokens' },
            maxTokens: 8192,
            contextLength: 8192,
            status: 'active',
            isAvailable: true,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            provider: 'OpenAI',
            description: t('text.ai.快速且高效的模�?'),
            capabilities: ['text', 'code'],
            pricing: { currency: 'USD', price: 0.002, unit: '1K tokens' },
            maxTokens: 4096,
            contextLength: 4096,
            status: 'active',
            isAvailable: true,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          },
        ],
        timestamp: Date.now(),
      }
    }
    const response = await request.get<AIModel[]>(COZE_PATHS.ai.models, { params })
    return normalizeApiResponse(response)
  }
)

export const getAIModel = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AIModel>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          id,
          name: 'GPT-4',
          provider: 'OpenAI',
          description: t('text.ai.最先进的大型语言2'),
          capabilities: ['text', 'code', 'analysis'],
          pricing: { currency: 'USD', price: 0.03, unit: '1K tokens' },
          maxTokens: 8192,
          contextLength: 8192,
          status: 'active',
          isAvailable: true,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<AIModel>(COZE_PATHS.ai.modelById(id))
    return normalizeApiResponse(response)
  }
)

export const createChatSession = withApiResponseHandler(
  async (params: { modelId: string; title?: string }): Promise<ApiResponse<AIChatSession>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          id: `session-${Date.now()}`,
          title: params.title || 'New conversation',
          modelId: params.modelId,
          modelName: 'GPT-4',
          messages: [],
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.post<AIChatSession>(COZE_PATHS.ai.chatSessions, params)
    return normalizeApiResponse(response)
  }
)

export const getChatSessions = withApiResponseHandler(
  async (params?: PaginationParams): Promise<ApiResponse<PaginationResponse<AIChatSession>>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      const page = params?.page || 1
      const pageSize = params?.pageSize || 20
      const list: AIChatSession[] = Array.from({ length: pageSize }).map((_, i) => ({
        id: `session-${page}-${i + 1}`,
        title: `对话 ${i + 1}`,
        modelId: 'gpt-4',
        modelName: 'GPT-4',
        messages: [],
        createTime: new Date(Date.now() - i * 3600000).toISOString(),
        updateTime: new Date(Date.now() - i * 3600000).toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          list,
          pagination: {
            page,
            pageSize,
            total: 100,
            totalPages: Math.ceil(100 / pageSize),
          },
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<PaginationResponse<AIChatSession>>(
      COZE_PATHS.ai.chatSessions,
      { params }
    )
    return normalizeApiResponse(response)
  }
)

export const getChatSession = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<AIChatSession>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          id,
          title: t('text.ai.示例对话3'),
          modelId: 'gpt-4',
          modelName: 'GPT-4',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: t('text.ai.你好4'),
              timestamp: new Date().toISOString(),
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: t('text.ai.你好有什么可以帮5'),
              timestamp: new Date().toISOString(),
            },
          ],
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<AIChatSession>(COZE_PATHS.ai.chatSessionById(id))
    return normalizeApiResponse(response)
  }
)

export const deleteChatSession = withApiResponseHandler(
  async (id: string): Promise<ApiResponse<null>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: null,
        timestamp: Date.now(),
      }
    }
    const response = await request.delete<null>(COZE_PATHS.ai.chatSessionById(id))
    return normalizeApiResponse(response)
  }
)

export const generateContent = withApiResponseHandler(
  async (requestData: AIGenerationRequest): Promise<ApiResponse<AIGenerationResponse>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          id: `gen-${Date.now()}`,
          type: requestData.type,
          content: `这是生成�?{requestData.type}内容示例`,
          modelId: requestData.modelId,
          modelName: 'GPT-4',
          usage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
          },
          timestamp: new Date().toISOString(),
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.post<AIGenerationResponse>(
      COZE_PATHS.ai.generate,
      requestData
    )
    return normalizeApiResponse(response)
  }
)

export const streamGenerateContent = async (
  request: AIGenerationRequest,
  onChunk: (chunk: string) => void,
  onComplete?: (response: AIGenerationResponse) => void,
  onError?: (error: Error) => void
): Promise<void> => {
  try {
    // 开发环境下相对路径会打到本�?8888，很多环境没有配�?/ai/generate/stream 代理，导�?404
    // 联调模式 (dev): 默认走本地后端 http://127.0.0.1:8000，可通过 VITE_COZE_API_BASE 覆盖
    // 生产模式: 默认走相对路径, 由 nginx 代理转发到 Python 后端
    const baseUrl =
      ((import.meta as { env?: { VITE_COZE_API_BASE?: string; DEV?: boolean } }).env?.VITE_COZE_API_BASE as string | undefined) ||
      (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
    const url = `${baseUrl}${COZE_PATHS.ai.generateStream}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            if (onComplete) {
              onComplete({
                id: `gen-${Date.now()}`,
                type: request.type,
                content: '',
                modelId: request.modelId,
                modelName: 'GPT-4',
                timestamp: new Date().toISOString(),
              })
            }
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              onChunk(parsed.content)
            }
          } catch (e) {
            logger.error('Failed to parse SSE data:', e)
          }
        }
      }
    }
  } catch (error) {
    logger.error('AI streaming generation failed:', error)
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
    throw error
  }
}

export const getAIProviders = withApiResponseHandler(
  async (): Promise<ApiResponse<Array<{ id: string; name: string; status: string }>>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: [
          { id: 'openai', name: 'OpenAI', status: 'active' },
          { id: 'anthropic', name: 'Anthropic', status: 'active' },
          { id: 'google', name: 'Google', status: 'active' },
          { id: 'cohere', name: 'Cohere', status: 'inactive' },
        ],
        timestamp: Date.now(),
      }
    }
    const response = await request.get<Array<{ id: string; name: string; status: string }>>(
      COZE_PATHS.ai.providers
    )
    return normalizeApiResponse(response)
  }
)

export const getAIUsageStats = withApiResponseHandler(
  async (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<{ totalRequests: number; totalTokens: number; cost: number; byModel: Array<{ modelId: string; modelName: string; requests: number; tokens: number }> }>> => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return {
        code: 200,
        success: true,
        message: 'mock',
        data: {
          totalRequests: 1000,
          totalTokens: 500000,
          cost: 15.5,
          byModel: [
            { modelId: 'gpt-4', modelName: 'GPT-4', requests: 300, tokens: 150000 },
            { modelId: 'gpt-3.5-turbo', modelName: 'GPT-3.5 Turbo', requests: 700, tokens: 350000 },
          ],
        },
        timestamp: Date.now(),
      }
    }
    const response = await request.get<{ totalRequests: number; totalTokens: number; cost: number; byModel: Array<{ modelId: string; modelName: string; requests: number; tokens: number }> }>(
      COZE_PATHS.ai.usage,
      { params: params ? { start_date: params.startDate, end_date: params.endDate } : undefined }
    )
    return normalizeApiResponse(response)
  }
)
