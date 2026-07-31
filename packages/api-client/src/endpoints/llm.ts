import { fetchApi } from '../client'

/** 模型能力位(Phase C+D:后端 /llm/models 返回的 caps 字段,可选,旧端点无此字段时缺失) */
export interface LlmModelCaps {
  supports_stream_usage?: boolean
  supports_tools?: boolean
  supports_vision?: boolean
  supports_response_format?: boolean
  supports_temperature?: boolean
  default_timeout?: number
  max_context?: number
  protocol?: string
}

export interface LlmModel {
  id: string
  name: string
  provider: string
  context_length: number
  input_price: number
  /** 模型能力位(可选,后端 /llm/models 升级后返回) */
  caps?: LlmModelCaps
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

// ============= AI 网关 Dashboard API =============

export type ProviderStatus = 'configured' | 'not_configured' | 'local'
export type ProviderCategory = 'domestic' | 'international' | 'local' | 'credits'

export interface GatewayProvider {
  provider_code: string
  display_name: string
  status: ProviderStatus
  category: ProviderCategory
  free_quota: string
  default_base_url: string
  default_models: string[]
  is_in_cooldown: boolean
  consecutive_failures: number
}

export interface ProvidersHealthResult {
  providers: GatewayProvider[]
  summary: { total: number; configured: number; local: number; not_configured: number }
}

export type ComboStrategy = 'priority' | 'cheapest' | 'fusion'

export interface ComboChain {
  name: string
  strategy: ComboStrategy
  chain: string[]
  judge: string | null
  description: string
}

export interface ComboListResult {
  combos: ComboChain[]
}

export interface ComboCreateInput {
  name: string
  strategy: ComboStrategy
  chain: string[]
  judge?: string | null
  description?: string
}

export interface ComboCreateResult {
  ok: boolean
  combo: ComboChain
}

export interface ComboDeleteResult {
  ok: boolean
  name: string
}

export type CompactionStrategy = 'rtk' | 'caveman' | 'rtk_caveman'

export interface CompactionDemoInput {
  messages: Array<{ role: string; content: string }>
  strategy?: CompactionStrategy
  keep_recent?: number
}

export interface CompactionDemoResult {
  original_tokens: number
  compressed_tokens: number
  compression_ratio: number
  strategy: CompactionStrategy
  rtk_map_size: number
  compressed_messages: Array<{ role: string; content: string }>
  decompressed_messages: Array<{ role: string; content: string }>
}

/** 获取 Provider 健康状态 — GET /llm/providers/health */
export async function fetchProvidersHealth(): Promise<ProvidersHealthResult> {
  const res = await fetchApi<ProvidersHealthResult>('/llm/providers/health', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取 Provider 健康状态失败')
  }
  return res.data
}

/** 获取 Combo 链列表 — GET /llm/combos */
export async function fetchCombos(): Promise<ComboListResult> {
  const res = await fetchApi<ComboListResult>('/llm/combos', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取 Combo 链列表失败')
  }
  return res.data
}

/** 新建 Combo 链 — POST /llm/combos */
export async function createCombo(input: ComboCreateInput): Promise<ComboCreateResult> {
  const res = await fetchApi<ComboCreateResult>('/llm/combos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) {
    throw new Error(res.error || '创建 Combo 链失败')
  }
  return res.data
}

/** 删除 Combo 链 — DELETE /llm/combos/{name} */
export async function deleteCombo(name: string): Promise<ComboDeleteResult> {
  const res = await fetchApi<ComboDeleteResult>(`/llm/combos/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
  if (!res.success) {
    throw new Error(res.error || '删除 Combo 链失败')
  }
  return res.data
}

/** Token 压缩演示 — POST /llm/compaction/demo */
export async function demoCompaction(input: CompactionDemoInput): Promise<CompactionDemoResult> {
  const res = await fetchApi<CompactionDemoResult>('/llm/compaction/demo', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) {
    throw new Error(res.error || 'Token 压缩演示失败')
  }
  return res.data
}

// ============= Phase C+D:Provider 健康状态(模型选择器三态徽章)==============

/** Provider 健康状态(轻量版,新 schema,Phase C+D 模型选择器消费)
 *  与旧版 GatewayProvider(网关 Dashboard 用)字段不同,本类型聚焦三态徽章所需最小信息 */
export interface ProviderHealth {
  provider: string
  status: 'ok' | 'invalid_key' | 'unreachable'
  latency_ms: number
  model_count: number
  last_check?: string
}

/** 获取 Provider 健康状态(轻量版)— GET /llm/providers/health
 *  返回 ProviderHealth[](provider/status/latency_ms/model_count/last_check)
 *  与旧版 fetchProvidersHealth(返回 ProvidersHealthResult,网关 Dashboard 用)并存,互不影响。
 *  后端 /llm/providers/health 升级后返回 {code:0, data:{providers:[...]}},fetchApi 解析信封取 data.providers */
export async function fetchProvidersHealthLite(): Promise<ProviderHealth[]> {
  const res = await fetchApi<{ providers: ProviderHealth[] }>('/llm/providers/health', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取 Provider 健康状态失败')
  }
  return res.data?.providers ?? []
}
