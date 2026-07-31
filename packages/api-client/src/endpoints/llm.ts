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

export type ProviderStatus = 'ok' | 'invalid_key' | 'unreachable'
export type ProviderCategory = 'domestic' | 'international' | 'local' | 'credits'

export interface GatewayProvider {
  // 新 schema(健康状态,后端 /llm/providers/health 返回)
  provider: string
  status: ProviderStatus
  latency_ms: number
  model_count: number
  last_check?: string
  // 旧 schema(配置状态,后端补返回,可选)
  display_name?: string
  category?: ProviderCategory
  free_quota?: string
  default_base_url?: string
  default_models?: string[]
  is_in_cooldown?: boolean
  consecutive_failures?: number
}

export interface ProvidersHealthResult {
  providers: GatewayProvider[]
  summary: {
    total: number
    ok: number
    invalid_key: number
    unreachable: number
    configured?: number
    local?: number
    not_configured?: number
  }
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
  const res = await fetchApi<{ providers: ProviderHealth[] }>('/llm/providers/health', {
    method: 'GET',
  })
  if (!res.success) {
    throw new Error(res.error || '获取 Provider 健康状态失败')
  }
  return res.data?.providers ?? []
}

// ============= Provider 余额与健康状态(2026-07-31 立,Admin 端 Provider 健康面板)==============
// 用户规则:账户没钱 / key 失效 / 接不通的 provider 不应进模型列表;管理端需可视化 + 跳转充值按钮

/** Provider 健康状态(与 ai-service ModelAvailabilityService.ProviderHealthStatus 对齐) */
export type ProviderAvailabilityStatus =
  'healthy' | 'degraded' | 'down' | 'not_configured' | 'local' | 'zero_cost' | 'pending'

/** Provider 错误类型(细化 DOWN 原因,决定是否显示"去充值"按钮) */
export type ProviderErrorType =
  | 'none'
  | 'payment_required' // 402 余额不足/账户没钱(需充值)
  | 'forbidden' // 403 无权限/key 失效
  | 'rate_limited' // 429 限流(仍可用,只是慢)
  | 'timeout' // 请求超时
  | 'network_error' // 网络错误(连不上)
  | 'invalid_key' // 401 key 无效
  | 'unknown'

/** 单个 Provider 的可用性信息(后端 /llm/providers/availability 返回) */
export interface ProviderAvailabilityItem {
  provider_code: string
  status: ProviderAvailabilityStatus
  latency_ms: number
  last_check: number
  error: string
  error_type: ProviderErrorType
  /** 账户余额(若 provider 支持余额查询);null 表示未查询 */
  balance: number | null
  /** 余额货币单位(如 "USD" / "CNY") */
  balance_currency: string | null
  /** 充值/billing 页面 URL(管理端"去充值"按钮跳转用) */
  recharge_url: string
}

/** /llm/providers/availability 响应(信封内 data 字段结构) */
export interface ProviderAvailabilityResult {
  providers: ProviderAvailabilityItem[]
  summary: {
    total: number
    healthy: number
    degraded: number
    down: number
    local: number
    zero_cost: number
  }
}

/** 获取 Provider 余额与健康状态 — GET /llm/providers/availability
 *  用于 Admin 端"Provider 余额健康"页面:展示每个 provider 的状态/余额/错误,并提供"去充值"按钮。
 *  账户没钱的 provider(error_type=payment_required 或 balance<=0)在 /llm/models 已被过滤,不显示给终端用户。 */
export async function fetchProvidersAvailability(): Promise<ProviderAvailabilityResult> {
  const res = await fetchApi<ProviderAvailabilityResult>('/llm/providers/availability', {
    method: 'GET',
  })
  if (!res.success) {
    throw new Error(res.error || '获取 Provider 可用性失败')
  }
  return res.data
}

// ============= 模型自动同步(ModelSyncService)=============

/** 单个 provider 的同步结果 */
export interface ModelSyncResult {
  provider_code: string
  success: boolean
  total_models: number
  new_models: number
  removed_models: number
  error: string
  latency_ms: number
  /** F4.1:本次同步新增的模型 id 列表(后端 F2.2 dry_run 返回,或从 history 端点获取) */
  new_model_ids?: string[]
  /** F4.1:本次同步下架的模型 id 列表 */
  removed_model_ids?: string[]
  /** F3.4:模型分类标签 */
  tags?: string[]
}

/** F4.4:单条同步历史记录(GET /llm/models/sync/history 返回) */
export interface ModelSyncHistoryRecord {
  id: number
  provider_code: string
  sync_started_at: string
  sync_finished_at: string
  success: boolean
  total_models: number
  new_models: number
  removed_models: number
  error: string
  latency_ms: number
  sync_type: 'full' | 'single' | 'dry_run'
}

/** 模型同步状态 */
export interface ModelSyncStatus {
  last_sync_at: string
  last_sync_duration_ms: number
  total_providers: number
  total_new_models: number
  total_removed_models: number
  is_syncing: boolean
  results: ModelSyncResult[]
}

/** 触发模型自动同步 — POST /llm/models/sync
 *  返回同步状态(含每个 provider 的结果)。
 *  - options.provider:仅同步指定 provider(单 provider 同步,F4.2)
 *  - options.dry_run:true 时只预览不实际落库,返回的 results 含 new_model_ids/removed_model_ids(F4.3) */
export async function triggerModelSync(options?: {
  provider?: string
  dry_run?: boolean
}): Promise<ModelSyncStatus> {
  const params = new URLSearchParams()
  if (options?.provider) params.set('provider', options.provider)
  if (options?.dry_run) params.set('dry_run', 'true')
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetchApi<ModelSyncStatus>(`/llm/models/sync${query}`, { method: 'POST' })
  if (!res.success) {
    throw new Error(res.error || '触发模型同步失败')
  }
  return res.data
}

/** 查询模型同步状态 — GET /llm/models/sync/status */
export async function fetchModelSyncStatus(): Promise<ModelSyncStatus> {
  const res = await fetchApi<ModelSyncStatus>('/llm/models/sync/status', { method: 'GET' })
  if (!res.success) {
    throw new Error(res.error || '获取模型同步状态失败')
  }
  return res.data
}

/** F4.4:查询同步历史 — GET /llm/models/sync/history?limit=N
 *  返回最近 N 次同步记录(按 sync_started_at DESC)。 */
export async function fetchModelSyncHistory(
  limit: number = 10,
): Promise<ModelSyncHistoryRecord[]> {
  const res = await fetchApi<ModelSyncHistoryRecord[]>(
    `/llm/models/sync/history?limit=${limit}`,
    { method: 'GET' },
  )
  if (!res.success) {
    throw new Error(res.error || '获取同步历史失败')
  }
  return res.data ?? []
}
