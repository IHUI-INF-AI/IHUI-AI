import { ref, onUnmounted } from 'vue'
import {
  createQwenWebSocket,
  createQwenOmniWebSocket,
  createZhipuWebSocket,
  createDeepSeekWebSocket,
  createDoubaoWebSocket,
  type ChatStreamEvent,
  type QwenWebSocketRequest,
} from '@/api/services/llmChat.service'
import { logger } from '@/utils/logger'
import type { ChatMessage } from '@/types/ai-platform.types'

export interface WebSocketMessageOptions {
  modelId?: string
  provider?: string
  messages: Array<{ role: string; content: string }>
  user_uuid?: string
  chat_id?: string
  onChunk?: (chunk: string) => void
  onComplete?: (response: WebSocketResponse) => void
  onError?: (error: Error) => void
  onProgress?: (progress: number, message?: string) => void
}

export interface WebSocketResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  metadata?: Record<string, unknown>
  progress?: number
  message?: string
}

export type WebSocketProvider = 'qwen' | 'zhipu' | 'deepseek' | 'doubao' | 'qwen-omni'

export function useAIChatWebSocket() {
  const currentWebSocket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const isStreaming = ref(false)
  const streamingMessageId = ref<string | null>(null)

  function createWebSocket(
    provider: WebSocketProvider,
    data: QwenWebSocketRequest,
    onMessage: (event: ChatStreamEvent) => void,
    onError?: (_error: Event) => void,
    onClose?: () => void
  ): WebSocket | null {
    switch (provider) {
      case 'qwen':
        return createQwenWebSocket(data, onMessage, onError, onClose)
      case 'qwen-omni':
        return createQwenOmniWebSocket(data, onMessage, onError, onClose)
      case 'zhipu':
        return createZhipuWebSocket(data, onMessage, onError, onClose)
      case 'deepseek':
        return createDeepSeekWebSocket(data, onMessage, onError, onClose)
      case 'doubao':
        return createDoubaoWebSocket(data, onMessage, onError, onClose)
      default:
        logger.warn(`[useAIChatWebSocket] Unknown WebSocket provider ${provider}`)
        return null
    }
  }

  function sendMessage(options: WebSocketMessageOptions): Promise<WebSocketResponse> {
    return new Promise((resolve, reject) => {
      const { provider = 'qwen', messages, onChunk, onComplete, onError, onProgress, user_uuid, chat_id } = options

      let accumulatedContent = ''
      const response: WebSocketResponse = {
        content: '',
        metadata: {},
      }

      const lastMessage = messages[messages.length - 1]
      const wsData: QwenWebSocketRequest = {
        user_uuid: user_uuid || '',
        query: lastMessage?.content || '',
        chat_id,
      }

      try {
        const ws = createWebSocket(
          provider as WebSocketProvider,
          wsData,
          (event: ChatStreamEvent) => {
            if (event.content) {
              accumulatedContent += event.content
              response.content = accumulatedContent
              onChunk?.(event.content)
            }
            if ((event as WebSocketResponse).usage) {
              response.usage = (event as WebSocketResponse).usage
            }
            if ((event as WebSocketResponse).metadata) {
              response.metadata = { ...response.metadata, ...(event as WebSocketResponse).metadata }
            }
            if ((event as WebSocketResponse).progress !== undefined) {
              onProgress?.((event as WebSocketResponse).progress!, (event as WebSocketResponse).message)
            }
            if (event.done) {
              isStreaming.value = false
              onComplete?.(response)
              resolve(response)
            }
            if (event.error) {
              isStreaming.value = false
              const error = new Error(event.error)
              onError?.(error)
              reject(error)
            }
          },
          (_event: Event) => {
            isStreaming.value = false
            isConnected.value = false
            const err = new Error('WebSocket连接错误')
            onError?.(err)
            reject(err)
          },
          () => {
            isStreaming.value = false
            isConnected.value = false
            currentWebSocket.value = null
            response.content = accumulatedContent
            onComplete?.(response)
            resolve(response)
          }
        )
        if (!ws) {
          reject(new Error(`无法创建WebSocket连接: ${provider}`))
          return
        }

        currentWebSocket.value = ws
        isStreaming.value = true
        isConnected.value = true
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        onError?.(err)
        reject(err)
      }
    })
  }

  function cancelRequest(): void {
    if (currentWebSocket.value) {
      currentWebSocket.value.close()
      currentWebSocket.value = null
      isStreaming.value = false
      isConnected.value = false
      logger.info('[useAIChatWebSocket] WebSocket request cancelled')
    }
  }

  function updateMessageFromChunk(
    message: ChatMessage,
    chunk: string,
    isComplete: boolean = false
  ): void {
    message.content += chunk
    if (isComplete) {
      message.isStreaming = false
      message.status = 'sent'
    }
  }

  onUnmounted(() => {
    cancelRequest()
  })

  return {
    currentWebSocket,
    isConnected,
    isStreaming,
    streamingMessageId,
    sendMessage,
    cancelRequest,
    updateMessageFromChunk,
  }
}

export default useAIChatWebSocket
