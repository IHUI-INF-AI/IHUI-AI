/**
 * 大模型聊天服务
 * 整合所有后端接入的大模型聊天接口
 */
import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import { createAuthWebSocket } from '@/utils/websocket'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { t } from '@/utils/i18n'

// ========== 通用类型定义 ==========

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  name?: string
}

export interface ChatStreamEvent {
  type: 'delta' | 'done' | 'error'
  content?: string
  data?: string | Record<string, unknown>
  done?: boolean
  error?: string
}

export type StreamCallback = (event: ChatStreamEvent) => void

// ========== LLM Chat API ==========

export interface LLMChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  [key: string]: any
}

export interface LLMChatResponse {
  id: string
  model: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 通用LLM对话
 */
export async function chat(req: LLMChatRequest): Promise<ApiResponse<LLMChatResponse>> {
  try {
    const response = await request.post<LLMChatResponse>('/llm/chat', req)
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.chatFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * LLM流式对话
 */
export async function chatStream(
  data: LLMChatRequest,
  onEvent: StreamCallback
): Promise<void> {
  try {
    const response = await fetch(COZE_PATHS.chatStream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(StorageManager.getItem(STORAGE_KEYS.TOKEN) || '')}`,
      },
      body: JSON.stringify({
        ...data,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No reader available')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') {
            onEvent({ type: 'done' })
          } else {
            try {
              const json = JSON.parse(dataStr)
              onEvent({ type: 'delta', data: json })
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.chatStreamFailed'), error)
    onEvent({ type: 'error', data: String(error) })
  }
}

/**
 * 获取支持的模型列表
 */
export async function getModels(): Promise<ApiResponse<string[]>> {
  try {
    const response = await request.get<string[]>('/llm/models')
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.modelListFailed'), error)
    return { code: 500, success: false, message: String(error), data: [], timestamp: Date.now() }
  }
}

/**
 * 模型对话（快捷方法）
 */
export async function sendMessage(
  model: string,
  content: string
): Promise<ApiResponse<{ content: string }>> {
  try {
    const messages: ChatMessage[] = [{ role: 'user', content }]
    const result = await chat({ model, messages, stream: false })
    if (result.success && result.data) {
      return {
        code: 200,
        success: true,
        message: 'success',
        data: { content: result.data.choices[0]?.message?.content || '' },
        timestamp: Date.now(),
      }
    }
    return { code: 200, success: true, message: 'success', data: { content: '' }, timestamp: Date.now() }
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.sendMessageFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

// ========== WebSocket 类型定义 ==========

export interface QwenWebSocketRequest {
  user_uuid: string
  query: string
  chat_id?: string
  [key: string]: any
}

export interface CozeWebSocketRequest {
  conversation_id?: string
  bot_id?: string
  user_id?: string
  query: string
  stream?: boolean
  [key: string]: any
}

export interface CozeSSERequest {
  bot_id: string
  user_id?: string
  query: string
  stream?: boolean
}

export interface LuyalaChatRequest {
  model?: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export interface LuyalaChatResponse {
  id?: string
  model?: string
  choices?: Array<{
    message?: { role?: string; content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenRouterChatRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export interface OpenRouterChatResponse {
  id?: string
  model?: string
  choices?: Array<{
    message?: { role?: string; content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ========== WebSocket Creator 函数 ==========

function createWebSocketConnection(
  url: string,
  data: Record<string, unknown>,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  try {
    // JWT 鉴权: 通过 createAuthWebSocket 自动附加 token
    const ws = createAuthWebSocket(url)

    ws.onopen = () => {
      logger.debug('[llmChat] ' + t('common.errors.websocketConnectionOpened'))
      ws.send(JSON.stringify(data))
    }

    ws.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data)
        // 根据消息类型构造 ChatStreamEvent
        if (json.type === 'error' || json.error) {
          onEvent({ type: 'error', error: json.error || json.message || 'Unknown error', data: json })
        } else if (json.done || json.type === 'done') {
          onEvent({ type: 'done', done: true, data: json })
        } else {
          // delta 类型消息，content 在 json.content 或 json.delta.content
          const content = json.content || json.delta?.content || ''
          onEvent({ type: 'delta', content, data: json })
        }
      } catch {
        // 非JSON消息作为内容处理
        onEvent({ type: 'delta', content: event.data, data: event.data })
      }
    }

    ws.onerror = (error) => {
      logger.error('[llmChat] ' + t('common.errors.websocketError'), error)
      onError?.(error)
    }

    ws.onclose = () => {
      logger.debug('[llmChat] ' + t('common.errors.websocketConnectionClosed'))
      onClose?.()
    }

    return ws
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.websocketCreateFailed'), error)
    return null
  }
}

/**
 * 通义千问 WebSocket
 */
export function createQwenWebSocket(
  data: QwenWebSocketRequest,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  return createWebSocketConnection(COZE_PATHS.ws.qwen, data, onEvent, onError, onClose)
}

/**
 * 通义千问全模态 WebSocket
 */
export function createQwenOmniWebSocket(
  data: QwenWebSocketRequest,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  return createWebSocketConnection(COZE_PATHS.ws.chatomni, data, onEvent, onError, onClose)
}

/**
 * 智谱 AI WebSocket
 */
export function createZhipuWebSocket(
  data: QwenWebSocketRequest,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  return createWebSocketConnection(COZE_PATHS.ws.zhipu, data, onEvent, onError, onClose)
}

/**
 * DeepSeek WebSocket
 */
export function createDeepSeekWebSocket(
  data: QwenWebSocketRequest,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  return createWebSocketConnection(COZE_PATHS.ws.chatdeepseek, data, onEvent, onError, onClose)
}

/**
 * 豆包 WebSocket
 */
export function createDoubaoWebSocket(
  data: QwenWebSocketRequest,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  return createWebSocketConnection(COZE_PATHS.ws.doubao, data, onEvent, onError, onClose)
}

/**
 * Coze WebSocket
 */
export function createCozeWebSocket(
  data: CozeWebSocketRequest,
  onEvent: StreamCallback,
  onError?: (_error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  // Use the base chat WebSocket URL, clientId should be passed in data
  const chatUrl = `${COZE_PATHS.chat.replace('/chat', '/ws/chat')}`
  return createWebSocketConnection(chatUrl, data, onEvent, onError, onClose)
}

/**
 * Coze SSE 流式聊天
 */
export async function chatCozeSSE(
  data: CozeSSERequest,
  onEvent: StreamCallback
): Promise<void> {
  try {
    const response = await fetch(COZE_PATHS.chat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(StorageManager.getItem(STORAGE_KEYS.TOKEN) || '')}`,
      },
      body: JSON.stringify({ ...data, stream: true }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No reader available')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') {
            onEvent({ type: 'done', done: true })
          } else {
            try {
              const json = JSON.parse(dataStr)
              if (json.error) {
                onEvent({ type: 'error', error: json.error })
              } else {
                onEvent({ type: 'delta', content: json.content || json.delta?.content || '', data: json })
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.cozeSSEFailed'), error)
    onEvent({ type: 'error', error: String(error) })
  }
}

/**
 * 鹿呀啦聊天
 */
export async function chatLuyala(
  request: LuyalaChatRequest
): Promise<ApiResponse<LuyalaChatResponse>> {
  try {
    const response = await fetch(COZE_PATHS.luyala.chatCompletions, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(StorageManager.getItem(STORAGE_KEYS.TOKEN) || '')}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return { code: 200, success: true, message: 'success', data: data as LuyalaChatResponse, timestamp: Date.now() }
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.luyalaChatFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * OpenRouter 聊天
 */
export async function chatOpenRouter(
  request: OpenRouterChatRequest
): Promise<ApiResponse<OpenRouterChatResponse>> {
  try {
    const response = await fetch(COZE_PATHS.proxyOpenrouter.chatCompletions, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(StorageManager.getItem(STORAGE_KEYS.TOKEN) || '')}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return { code: 200, success: true, message: 'success', data: data as OpenRouterChatResponse, timestamp: Date.now() }
  } catch (error) {
    logger.error('[llmChat] ' + t('common.errors.openRouterChatFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}
