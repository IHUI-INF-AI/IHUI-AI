/**
 * 统一AI聊天服务层
 * 整合所有AI聊天相关的后端接口，提供统一的调用方式
 */
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS, TokenStorage } from '@/utils/storage'
import type { ApiResponse } from '@/types'
import { t } from '@/utils/i18n'

export type AIChatMode = 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'generation'
export type GenerationType = 'image' | 'video' | '3d' | 'vision' | 'audio' | 'auto'

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system'
  content: string
  name?: string
}

export interface UnifiedChatRequest {
  mode: AIChatMode
  model?: string
  messages: ChatMessageInput[]
  stream?: boolean
  sessionId?: string
  context?: Record<string, unknown>
  conversationId?: string
  userUuid?: string
  modelId?: string
  agentId?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  generationType?: GenerationType
}

export interface UnifiedChatResponse {
  id: string
  content: string
  status?: string
  metadata?: Record<string, unknown>
  processingTime?: number
  conversationId?: string
  generationResult?: Record<string, unknown>
  createTime?: string | number
  sessionId?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ========== UnifiedChatService 类 ==========

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onComplete?: (response: UnifiedChatResponse) => void
  onError?: (error: Error) => void
  onProgress?: (progress: number, message?: string) => void
}

class UnifiedChatServiceClass {
  private activeRequests = new Map<string, AbortController>()

  /**
   * 发送消息（流式）
   */
  async sendMessageStream(
    request: UnifiedChatRequest,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const controller = new AbortController()
    this.activeRequests.set(requestId, controller)

    try {
      const userUuid = getUserUuid()
      const url = getChatUrl(request.mode)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(TokenStorage.getToken() || '')}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          session_id: request.sessionId,
          context: request.context,
          user_uuid: userUuid,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      if (!reader) {
        throw new Error('No reader available')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done || controller.signal.aborted) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            if (dataStr === '[DONE]') {
              callbacks.onComplete?.({
                id: requestId,
                content: accumulatedContent,
                status: 'success',
              })
              break
            } else {
              try {
                const json = JSON.parse(dataStr)
                const content = json.content || json.delta?.content || ''
                if (content) {
                  accumulatedContent += content
                  callbacks.onChunk?.(content)
                }
                if (json.progress !== undefined) {
                  callbacks.onProgress?.(json.progress, json.message)
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('[unified-chat] ' + t('common.errors.requestCancelled'), requestId)
      } else {
        logger.error('[unified-chat] ' + t('common.errors.chatStreamFailed'), error)
        callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  /**
   * 发送消息（非流式）
   */
  async sendMessage(request: UnifiedChatRequest): Promise<ApiResponse<UnifiedChatResponse>> {
    return unifiedChat(request)
  }

  /**
   * 取消请求
   */
  cancelRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
      logger.debug('[unified-chat] ' + t('common.errors.requestCancelled'), requestId)
    }
  }
}

// 导出单例
export const unifiedChatService = new UnifiedChatServiceClass()

// 兼容性别名
export const sendUnifiedChatMessage = unifiedChatService.sendMessage.bind(unifiedChatService)

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
 * 统一聊天接口
 */
export async function unifiedChat(
  request: UnifiedChatRequest
): Promise<ApiResponse<UnifiedChatResponse>> {
  try {
    const userUuid = getUserUuid()
    logger.debug('[unified-chat] Sending unified chat request', { mode: request.mode, userUuid })

    // 根据mode路由到不同后端
    const url = getChatUrl(request.mode)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(TokenStorage.getToken() || '')}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: request.stream || false,
        session_id: request.sessionId,
        context: request.context,
        user_uuid: userUuid,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    if (request.stream) {
      // 流式响应由调用方处理
      return { code: 200, success: true, message: 'streaming', data: { id: '', content: '' }, timestamp: Date.now() }
    }

    const data = await response.json()
    return {
      code: 200,
      success: true,
      message: 'success',
      data: data as UnifiedChatResponse,
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('[unified-chat] ' + t('common.errors.unifiedChatFailed'), error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: undefined,
      timestamp: Date.now(),
    }
  }
}

function getChatUrl(mode: AIChatMode): string {
  switch (mode) {
    case 'agentic':
      return '/api/agentic/chat'
    case 'mcp':
      return '/api/mcp/chat'
    case 'hybrid':
      return '/api/hybrid/chat'
    case 'generation':
      return '/api/generation/chat'
    case 'agent':
      return '/api/agent/chat'
    default:
      return '/api/llm/chat'
  }
}

/**
 * 统一生成接口（文生图、视频等）
 */
export async function unifiedGeneration(
  type: GenerationType,
  prompt: string,
  options?: Record<string, unknown>
): Promise<ApiResponse<{ url: string; thumbnail?: string }>> {
  try {
    const response = await fetch('/api/generation/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(TokenStorage.getToken() || '')}`,
      },
      body: JSON.stringify({ type, prompt, ...options }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return {
      code: 200,
      success: true,
      message: 'success',
      data: data as { url: string; thumbnail?: string },
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('[unified-chat] ' + t('common.errors.generationFailed'), error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: undefined,
      timestamp: Date.now(),
    }
  }
}

/**
 * 轮询生成状态
 */
export async function pollGenerationResult(taskId: string): Promise<ApiResponse<{ status: string; result?: { url: string } }>> {
  try {
    const response = await fetch(`/api/generation/status/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${String(TokenStorage.getToken() || '')}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return {
      code: 200,
      success: true,
      message: 'success',
      data: data as { status: string; result?: { url: string } },
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('[unified-chat] ' + t('common.errors.pollingStatusFailed'), error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: undefined,
      timestamp: Date.now(),
    }
  }
}
