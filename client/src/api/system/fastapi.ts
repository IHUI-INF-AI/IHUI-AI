import { t } from '@/utils/i18n'

/**
 * FastAPI AI服务API接口
 * 统一的前端调用接口，连接到FastAPI后端服务
 */

import request from '@/utils/request'
import { createAuthWebSocket } from '@/utils/websocket'
import { logger } from '../../utils/logger'
import type { ApiResponse } from '@/types'

// FastAPI服务基础URL（通过Vite代理）
const FASTAPI_BASE_URL = '/api/v1'

/**
 * AI对话接口（兼容OpenAI格式）
 */
export interface ChatCompletionRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string
  temperature?: number
  max_tokens?: number
  user_uuid?: string
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 发送AI对话消息（FastAPI）
 */
export async function sendChatCompletion(
  data: ChatCompletionRequest
): Promise<ApiResponse<ChatCompletionResponse>> {
  try {
    const response = await request.post(`${FASTAPI_BASE_URL}/chat/completions`, data)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      code: 500,
      success: false,
      message: errorMessage || '对话失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 创建任务（使用Agentic AI Orchestrator）
 */
export interface CreateTaskRequest {
  user_uuid: string
  user_input: string
  context?: Record<string, unknown>
  priority?: number // 1=低, 2=普通, 3=高, 4=紧急
}

export interface TaskResponse {
  task_id: string
  status: string
  result?: unknown
  error?: string
}

export async function createTask(data: CreateTaskRequest): Promise<ApiResponse<TaskResponse>> {
  try {
    const response = await request.post(`${FASTAPI_BASE_URL}/tasks`, data)
    return {
      code: 200,
      success: true,
      message: t('api.fastapi.任务创建成功'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      code: 500,
      success: false,
      message: errorMessage || '创建任务失败',
      data: null as unknown as TaskResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.get(`${FASTAPI_BASE_URL}/tasks/${taskId}`)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '查询任务状态失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 执行Agent
 */
export interface ExecuteAgentRequest {
  agent_type: string
  user_uuid: string
  input_text: string
  context?: Record<string, unknown>
}

export async function executeAgent(data: ExecuteAgentRequest): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(`${FASTAPI_BASE_URL}/agents/execute`, data)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '执行Agent失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 搜索知识库
 */
export interface KnowledgeSearchRequest {
  query: string
  user_uuid?: string
  top_k?: number
  filters?: Record<string, unknown>
}

export async function searchKnowledge(data: KnowledgeSearchRequest): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(`${FASTAPI_BASE_URL}/knowledge/search`, data)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '搜索知识库失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 调用工具
 */
export interface CallToolRequest {
  tool_name: string
  params: Record<string, unknown>
  user_uuid?: string
}

export async function callTool(data: CallToolRequest): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(`${FASTAPI_BASE_URL}/tools/call`, data)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '调用工具失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取支持的模型列表
 */
export async function getModels(): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.get(`${FASTAPI_BASE_URL}/models`)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取模型列表失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取性能指标
 */
export async function getMetrics(): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.get(`${FASTAPI_BASE_URL}/metrics`)
    return {
      code: 200,
      success: true,
      message: 'success',
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取指标失败',
      data: null as unknown as ChatCompletionResponse,
      timestamp: Date.now(),
    }
  }
}

/**
 * WebSocket连接（实时对话）
 */
export function createWebSocketConnection(
  userUuid: string,
  onMessage: (data: unknown) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const wsUrl = `${protocol}//${host}/api/v1/ws/chat/${userUuid}`

  // JWT 鉴权: 通过 createAuthWebSocket 自动附加 token
  const ws = createAuthWebSocket(wsUrl)

  ws.onmessage = event => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (error) {
      logger.error('WebSocket message parsing failed:', error)
    }
  }

  if (onError) {
    ws.onerror = onError
  }

  if (onClose) {
    ws.onclose = onClose
  }

  return ws
}
