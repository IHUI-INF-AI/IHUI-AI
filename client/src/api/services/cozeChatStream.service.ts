/**
 * Coze流式聊天服务
 * 用于处理Coze平台的流式聊天响应（SSE）
 */

import { COZE_PATHS } from '@/config/backend-paths'
import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'

/**
 * 流式消息回调
 */
export type StreamChunkCallback = (chunk: {
  type: 'delta' | 'completed' | 'error'
  content?: string
  conversation_id?: string
  message_id?: string
  event?: string
  data?: any
}) => void

/**
 * Coze流式聊天请求
 */
export interface CozeStreamChatRequest {
  bot_id: string
  user_id: string
  query: string
  conversation_id?: string
  chat_history?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  additional_messages?: Array<{
    role: string
    content: string
    content_type?: string
  }>
}

/**
 * 流式聊天（SSE）
 */
export async function streamChat(
  data: CozeStreamChatRequest,
  onChunk: StreamChunkCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const host = window.location.host
    const sseUrl = `${protocol}//${host}${COZE_PATHS.chatStream}`

    // 构建请求体
    const requestBody = {
      bot_id: data.bot_id,
      user_id: data.user_id,
      query: data.query,
      conversation_id: data.conversation_id || '',
      stream: true,
      chat_history: data.chat_history || [],
      additional_messages: data.additional_messages,
    }

    // 使用EventSource或fetch实现SSE
    if (typeof EventSource !== 'undefined' && !data.chat_history) {
      // EventSource仅支持GET请求，如果使用POST需要fallback到fetch
      // 这里使用fetch实现SSE
      fetch(sseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          if (!reader) {
            throw new Error('无法读取响应流')
          }

          function readStream(): void {
            reader!
              .read()
              .then(({ done, value }) => {
                if (done) {
                  resolve()
                  return
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const eventData = JSON.parse(line.slice(6))
                      handleEvent(eventData)
                    } catch (error) {
                      logger.warn('Failed to parse SSE event:', error, line)
                    }
                  }
                }

                readStream()
              })
              .catch(reject)
          }

          function handleEvent(eventData: any): void {
            const event = eventData as {
              event?: string
              data?: {
                content?: string
                conversation_id?: string
                id?: string
                role?: string
                type?: string
              }
              error?: { message?: string }
            }

            // 处理不同类型的事件
            if (event.error) {
              onChunk({
                type: 'error',
                content: event.error.message || '未知错误',
              })
              reject(new Error(event.error.message || '流式聊天失败'))
              return
            }

            const eventType = event.event || ''
            const content = event.data?.content || ''

            // 增量消息
            if (
              eventType.includes('delta') ||
              eventType === 'conversation.message.delta' ||
              content
            ) {
              onChunk({
                type: 'delta',
                content,
                conversation_id: event.data?.conversation_id,
                message_id: event.data?.id,
                event: eventType,
                data: eventData,
              })
            }

            // 完成事件
            if (
              eventType.includes('completed') ||
              eventType === 'conversation.chat.completed' ||
              eventType === 'conversation.message.completed'
            ) {
              onChunk({
                type: 'completed',
                content: content || event.data?.content || '',
                conversation_id: event.data?.conversation_id,
                message_id: event.data?.id,
                event: eventType,
                data: eventData,
              })
              resolve()
            }
          }

          readStream()
        })
        .catch(reject)
    } else {
      // 使用fetch实现SSE（POST请求）
      fetch(sseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          if (!reader) {
            throw new Error('无法读取响应流')
          }

          function readStream(): void {
            reader!
              .read()
              .then(({ done, value }) => {
                if (done) {
                  resolve()
                  return
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const eventData = JSON.parse(line.slice(6))
                      handleEvent(eventData)
                    } catch (error) {
                      logger.warn('Failed to parse SSE event:', error, line)
                    }
                  }
                }

                readStream()
              })
              .catch(reject)
          }

          function handleEvent(eventData: any): void {
            const event = eventData as {
              event?: string
              data?: {
                content?: string
                conversation_id?: string
                id?: string
                role?: string
                type?: string
              }
              error?: { message?: string }
            }

            if (event.error) {
              onChunk({
                type: 'error',
                content: event.error.message || '未知错误',
              })
              reject(new Error(event.error.message || '流式聊天失败'))
              return
            }

            const eventType = event.event || ''
            const content = event.data?.content || ''

            if (
              eventType.includes('delta') ||
              eventType === 'conversation.message.delta' ||
              content
            ) {
              onChunk({
                type: 'delta',
                content,
                conversation_id: event.data?.conversation_id,
                message_id: event.data?.id,
                event: eventType,
                data: eventData,
              })
            }

            if (
              eventType.includes('completed') ||
              eventType === 'conversation.chat.completed' ||
              eventType === 'conversation.message.completed'
            ) {
              onChunk({
                type: 'completed',
                content: content || event.data?.content || '',
                conversation_id: event.data?.conversation_id,
                message_id: event.data?.id,
                event: eventType,
                data: eventData,
              })
              resolve()
            }
          }

          readStream()
        })
        .catch(reject)
    }
  })
}

/**
 * 非流式聊天（普通请求）
 */
export async function chat(data: CozeStreamChatRequest): Promise<ApiResponse<unknown>> {
  try {
    const response = await fetch(COZE_PATHS.chat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: data.bot_id,
        user_id: data.user_id,
        query: data.query,
        conversation_id: data.conversation_id || '',
        stream: false,
        chat_history: data.chat_history || [],
        additional_messages: data.additional_messages,
      }),
    })

    const result = await response.json()
    return {
      code: response.ok ? 200 : response.status,
      success: response.ok,
      message: response.ok ? 'success' : result.msg || result.message || '请求失败',
      data: result,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '聊天失败',
      data: null,
      timestamp: Date.now(),
    }
  }
}
