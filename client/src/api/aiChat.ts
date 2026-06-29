import request from '@/utils/request'
import { logger } from '../utils/logger'
import { StorageManager, STORAGE_KEYS, TokenStorage } from '@/utils/storage'
import type { ApiResponse } from '@/types'
import { DEVELOPER_PATHS, API_V1_PATHS, COZE_PATHS } from '@/config/backend-paths'

// AI对话消息请求
export interface AIChatRequest {
  content: string
  modelId: string
  sessionId?: string
  useAgentic?: boolean
  stream?: boolean
  context?: Record<string, unknown>
}

// AI对话消息响应
export interface AIChatResponse {
  answer?: string
  conversationId?: string
  messageId?: string
  citations?: Array<{
    title: string
    url: string
    snippet: string
  }>
  [key: string]: unknown
}

// 发送AI对话消息 - 使用FastAPI服务
export async function sendAIChatMessage(data: AIChatRequest): Promise<ApiResponse<AIChatResponse>> {
  try {
    // If using Agentic AI mode, use task creation endpoint    if (data.useAgentic) {
      const { createTask } = await import('./fastapi')
      const userUuid =
        (window as { userUuid?: string }).userUuid ||
        String(StorageManager.getItem(STORAGE_KEYS.USER_UUID) || '') ||
        'anonymous'

      const taskResponse = await createTask({
        user_uuid: userUuid,
        user_input: data.content,
        context: {
          sessionId: data.sessionId,
          modelId: data.modelId,
        },
        priority: 2, // 普通优先级
      })

      if (taskResponse.code === 200 && taskResponse.data) {
        return {
          code: 200,
          success: true,
          message: '任务创建成功',
          data: taskResponse.data as unknown as AIChatResponse,
          timestamp: Date.now(),
        }
      }

      // Agentic mode failed, fall back to normal mode
      logger.warn('[aiChat] Agentic mode failed, falling back to normal mode')

    // Normal mode
    const response = await request.post<AIChatResponse>(
      API_V1_PATHS.chat.process,
      {
        model: data.modelId,
        messages: [{ role: 'user', content: data.content }],
        session_id: data.sessionId,
        stream: data.stream || false,
      }
    )

    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[aiChat] Failed to send message:', error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: undefined,
      timestamp: Date.now(),
    }
  }
}

// 通用normalize
function normalizeApiResponse(response: unknown): ApiResponse<AIChatResponse> {
  const resp = response as { data?: { code?: number; success?: boolean; msg?: string; message?: string; data?: AIChatResponse } }
  if (resp?.data) {
    return {
      code: resp.data.code || 200,
      success: resp.data.success !== false,
      message: resp.data.msg || resp.data.message || 'success',
      data: resp.data.data || resp.data,
      timestamp: Date.now(),
    }
  }
  return {
    code: 200,
    success: true,
    message: 'success',
    data: response as AIChatResponse,
    timestamp: Date.now(),
  }
}

// 获取AI模型列表
export async function getAIChatModels(): Promise<ApiResponse<string[]>> {
  try {
    const response = await request.get<string[]>(DEVELOPER_PATHS.models.list)
    if (response?.data) {
      return {
        code: 200,
        success: true,
        message: 'success',
        data: Array.isArray(response.data) ? response.data : [],
        timestamp: Date.now(),
      }
    }
    return { code: 200, success: true, message: 'success', data: [], timestamp: Date.now() }
  } catch (error) {
    logger.error('[aiChat] Failed to fetch model list:', error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 会话历史 - 使用 COZE API 路径
export async function getAIChatHistory(sessionId: string): Promise<ApiResponse<AIChatResponse[]>> {
  try {
    const response = await request.get<AIChatResponse[]>(`${COZE_PATHS.userModelChat.byId(sessionId)}`)
    if (response?.data) {
      return {
        code: 200,
        success: true,
        message: 'success',
        data: Array.isArray(response.data) ? response.data : [response.data as AIChatResponse],
        timestamp: Date.now(),
      }
    }
    return { code: 200, success: true, message: 'success', data: [], timestamp: Date.now() }
  } catch (error) {
    logger.error('[aiChat] Failed to fetch session history:', error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 删除会话
export async function deleteAIChatSession(sessionId: string): Promise<ApiResponse<void>> {
  try {
    await request.delete(`${COZE_PATHS.userModelChat.byId(sessionId)}`)
    return { code: 200, success: true, message: 'success', data: undefined, timestamp: Date.now() }
  } catch (error) {
    logger.error('[aiChat] Failed to delete session:', error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: undefined,
      timestamp: Date.now(),
    }
  }
}

// 流式发送消息（兼容旧接口）
export async function sendAIChatMessageStream(
  data: AIChatRequest,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const userUuid =
      (window as { userUuid?: string }).userUuid ||
      String(StorageManager.getItem(STORAGE_KEYS.USER_UUID) || '') ||
      'anonymous'

    const response = await fetch(COZE_PATHS.chatStream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(TokenStorage.getToken() || '')}`,
      },
      body: JSON.stringify({
        user_uuid: userUuid,
        query: data.content,
        chat_id: data.sessionId,
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
            onComplete()
          } else {
            try {
              const json = JSON.parse(dataStr)
              const content = json.content || json.delta?.content || ''
              if (content) {
                onChunk(content)
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }
    onComplete()
  } catch (error) {
    logger.error('[aiChat] Streaming message failed:', error)
    onError(error instanceof Error ? error : new Error(String(error)))
  }
}

// 补充缺失的导出（�?COZE_PATHS 导入�?import { COZE_PATHS } from '@/config/backend-paths'
