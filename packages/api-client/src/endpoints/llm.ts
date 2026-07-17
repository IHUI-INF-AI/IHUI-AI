import { fetchApi } from '../client.js'

export interface LlmModel {
  id: string
  name: string
  provider: string
  context_length: number
  input_price: number
}

export interface FetchModelsResult {
  models: LlmModel[]
  default: string
  stub_mode: boolean
}

/** 获取可用模型列表 — GET /llm/models (代理到 AI-service) */
export async function fetchModels(): Promise<FetchModelsResult> {
  const res = await fetchApi<FetchModelsResult>('/llm/models', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取模型列表失败')
  }
  return res.data
}
