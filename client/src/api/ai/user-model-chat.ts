/**
 * 用户模型对话 API (对话/图像生成/模型列表)
 * 对接后端: app/api/v1/user_model_chat.py
 * 路由前缀: /api/v1/user-model-chat
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

/** 对话消息 */
export interface ChatMessage {
  /** 角色: system/user/assistant */
  role: string
  /** 消息内容 */
  content: string
}

/** 对话参数 (Body embed) */
export interface ChatParams {
  /** 模型名称 */
  model: string
  /** 消息列表 */
  messages: ChatMessage[]
  /** 温度 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 是否流式 */
  stream?: boolean
  /** API Key */
  apiKey?: string
  /** API Base URL */
  apiBase?: string
}

/** 图像生成参数 (Body embed) */
export interface ImageParams {
  /** 模型名称 */
  model: string
  /** 提示词 */
  prompt: string
  /** 图像尺寸 */
  size?: string
  /** 生成数量 */
  n?: number
  /** API Key */
  apiKey?: string
  /** API Base URL */
  apiBase?: string
}

// 统一构造 ApiResponse 格式
function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 用户模型对话
// ===========================================================================

/** 用户模型对话 (Body embed) */
export async function userModelChat(params: ChatParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/user-model-chat/chat', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 用户模型图像生成 (Body embed) */
export async function userModelImage(params: ImageParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/user-model-chat/image', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 用户模型列表 */
export async function userModelListModels(): Promise<ApiResponse<unknown[]>> {
  const res = await http.get('/api/v1/user-model-chat/list')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<unknown[]>
}

export const userModelChatApi = {
  userModelChat,
  userModelImage,
  userModelListModels,
}

export default userModelChatApi