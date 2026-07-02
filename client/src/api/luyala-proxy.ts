/**
 * 露雅拉代理 API
 * 对接后端: app/api/v1/luyala_proxy/luyala_proxy.py
 * 路由前缀: /api/v1/luyala-proxy
 *
 * 后端 chat/completion/embeddings 使用 Body(embed=True),
 * 即请求体为 JSON 对象, 字段名与后端一致 (snake_case)。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

/** 露雅拉对话参数 */
export interface LuyalaChatParams {
  messages: Array<{ role: string; content: string }>
  model: string
  temperature?: number
}

/** 露雅拉文本补全参数 */
export interface LuyalaCompletionParams {
  prompt: string
  model: string
  maxTokens?: number
}

/** 露雅拉 Embedding 参数 */
export interface LuyalaEmbeddingParams {
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
// 露雅拉代理
// ===========================================================================

/** 露雅拉对话 (Body 传参) */
export async function luyalaChat(params: LuyalaChatParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/luyala-proxy/chat', {
    messages: params.messages,
    model: params.model,
    temperature: params.temperature,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 露雅拉文本补全 (Body 传参) */
export async function luyalaCompletion(params: LuyalaCompletionParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/luyala-proxy/completion', {
    prompt: params.prompt,
    model: params.model,
    max_tokens: params.maxTokens,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 露雅拉 Embedding (Body 传参, apiKey 走 Query) */
export async function luyalaEmbeddings(params: LuyalaEmbeddingParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/luyala-proxy/embeddings', {
    input_text: params.inputText,
    model: params.model,
  }, {
    params: { api_key: params.apiKey || undefined },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 可用模型列表 */
export async function luyalaModels(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/luyala-proxy/models')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const luyalaProxyApi = {
  luyalaChat,
  luyalaCompletion,
  luyalaEmbeddings,
  luyalaModels,
}

export default luyalaProxyApi