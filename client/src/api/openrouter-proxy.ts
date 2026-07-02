/**
 * OpenRouter 代理 API
 * 对接后端: app/api/v1/openrouter_proxy/openrouter_proxy.py
 * 路由前缀: /api/v1/openrouter-proxy
 *
 * 后端 chat/completion/embeddings 使用 Body(embed=True),
 * 即请求体为 JSON 对象, 字段名与后端一致 (snake_case)。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

/** OpenRouter 对话参数 */
export interface OpenRouterChatParams {
  messages: Array<{ role: string; content: string }>
  model: string
  temperature?: number
}

/** OpenRouter 文本补全参数 */
export interface OpenRouterCompletionParams {
  prompt: string
  model: string
  maxTokens?: number
}

/** OpenRouter Embedding 参数 */
export interface OpenRouterEmbeddingParams {
  inputText: string
  model: string
  apiKey?: string
}

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
// OpenRouter 代理
// ===========================================================================

/** OpenRouter 对话 (Body 传参) */
export async function openrouterChat(params: OpenRouterChatParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/openrouter-proxy/chat', {
    messages: params.messages,
    model: params.model,
    temperature: params.temperature,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** OpenRouter 文本补全 (Body 传参) */
export async function openrouterCompletion(params: OpenRouterCompletionParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/openrouter-proxy/completion', {
    prompt: params.prompt,
    model: params.model,
    max_tokens: params.maxTokens,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 可用模型列表 */
export async function openrouterModels(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/openrouter-proxy/models')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** OpenRouter Embedding (Body 传参, apiKey 走 Query) */
export async function openrouterEmbeddings(params: OpenRouterEmbeddingParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/openrouter-proxy/embeddings', {
    input_text: params.inputText,
    model: params.model,
  }, {
    params: { api_key: params.apiKey || undefined },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 账户额度 (apiKey 走 Query) */
export async function openrouterCredits(params: {
  apiKey: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/openrouter-proxy/credits', {
    params: { api_key: params.apiKey },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const openrouterProxyApi = {
  openrouterChat,
  openrouterCompletion,
  openrouterModels,
  openrouterEmbeddings,
  openrouterCredits,
}

export default openrouterProxyApi