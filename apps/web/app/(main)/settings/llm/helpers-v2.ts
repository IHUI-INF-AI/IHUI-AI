/**
 * v2 API helpers(2026-07-22 立,1:N provider-model + group 数据模型)
 *
 * 端点前缀:/api/v2/user(后端 server.ts 注册的 prefix)
 */
import { fetchApi } from '@/lib/api'
import type { PlatformTemplate, TestResult, UpstreamModel } from './types'
import type {
  UserLlmProvider,
  UserLlmModel,
  ProviderFormState,
  ModelFormState,
  ProviderListData,
  GroupListData,
} from './types-v2'

export type {
  UserLlmProvider,
  UserLlmModel,
  ProviderFormState,
  ModelFormState,
  ProviderListData,
  GroupListData,
  TestResult,
  UpstreamModel,
} from './types-v2'

export { EMPTY_PROVIDER_FORM, EMPTY_MODEL_FORM } from './types-v2'

const BASE = '/api/v2/user'

/** 通用 API 包装 */
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

interface TemplatesResponse {
  templates: PlatformTemplate[]
}

// =============================================================================
// D. 模板
// =============================================================================

export function fetchTemplatesV2() {
  return api<TemplatesResponse>(`${BASE}/llm-providers/templates`)
}

// =============================================================================
// A. Provider 列表/详情/CRUD
// =============================================================================

export function fetchProvidersV2() {
  return api<ProviderListData>(`${BASE}/llm-providers`)
}

export function fetchProviderV2(id: number) {
  return api<UserLlmProvider>(`${BASE}/llm-providers/${id}`)
}

export function createProviderV2(f: ProviderFormState) {
  return api<{ id: number; created: boolean; name: string }>(`${BASE}/llm-providers`, {
    method: 'POST',
    body: JSON.stringify(providerFormToBody(f)),
  })
}

export function updateProviderV2(id: number, f: ProviderFormState) {
  return api<{ id: number; updated: boolean }>(`${BASE}/llm-providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(providerFormToUpdateBody(f)),
  })
}

export function deleteProviderV2(id: number) {
  return api<{ id: number; deleted: boolean }>(`${BASE}/llm-providers/${id}`, { method: 'DELETE' })
}

export function toggleProviderV2(id: number, enabled: boolean) {
  return api<{ id: number; enabled: boolean }>(`${BASE}/llm-providers/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export function testProviderV2(id: number) {
  return api<TestResult>(`${BASE}/llm-providers/${id}/test`, { method: 'POST' })
}

export function fetchUpstreamModelsV2(id: number) {
  return api<{ total: number; models: UpstreamModel[]; message?: string }>(
    `${BASE}/llm-providers/${id}/fetch-models`,
    { method: 'POST' },
  )
}

// =============================================================================
// B. Model CRUD(子表)
// =============================================================================

export function fetchModelsV2(providerId: number) {
  return api<{ list: UserLlmModel[]; total: number }>(`${BASE}/llm-providers/${providerId}/models`)
}

export function createModelV2(providerId: number, f: ModelFormState) {
  return api<{ id: number; created: boolean; modelId: string }>(
    `${BASE}/llm-providers/${providerId}/models`,
    { method: 'POST', body: JSON.stringify(modelFormToBody(f)) },
  )
}

export function updateModelV2(providerId: number, modelId: number, f: ModelFormState) {
  return api<{ id: number; updated: boolean }>(
    `${BASE}/llm-providers/${providerId}/models/${modelId}`,
    { method: 'PUT', body: JSON.stringify(modelFormToUpdateBody(f)) },
  )
}

export function deleteModelV2(providerId: number, modelId: number) {
  return api<{ id: number; deleted: boolean }>(
    `${BASE}/llm-providers/${providerId}/models/${modelId}`,
    { method: 'DELETE' },
  )
}

export function testModelV2(providerId: number, modelId: number) {
  return api<TestResult>(`${BASE}/llm-providers/${providerId}/models/${modelId}/test`, {
    method: 'POST',
  })
}

// =============================================================================
// C. Group CRUD
// =============================================================================

export function fetchGroupsV2() {
  return api<GroupListData>(`${BASE}/llm-groups`)
}

export function createGroupV2(label: string, sortOrder = 0) {
  return api<{ id: number; created: boolean; label: string }>(`${BASE}/llm-groups`, {
    method: 'POST',
    body: JSON.stringify({ label, sortOrder }),
  })
}

export function updateGroupV2(id: number, label: string) {
  return api<{ id: number; updated: boolean }>(`${BASE}/llm-groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ label }),
  })
}

export function deleteGroupV2(id: number) {
  return api<{ id: number; deleted: boolean }>(`${BASE}/llm-groups/${id}`, { method: 'DELETE' })
}

// =============================================================================
// Form → Body 转换
// =============================================================================

function providerFormToBody(f: ProviderFormState) {
  return {
    providerCode: f.providerCode,
    name: f.name.trim(),
    apiKey: f.apiKey,
    apiFormat: f.apiFormat,
    baseUrlOverride: f.baseUrlOverride.trim() || undefined,
    providerGroup: f.providerGroup.trim() || 'default',
    groupLabel: f.groupLabel.trim() || undefined,
    description: f.description.trim() || undefined,
    sortOrder: 0,
  }
}

function providerFormToUpdateBody(f: ProviderFormState) {
  const body: Record<string, unknown> = {
    name: f.name.trim(),
    apiFormat: f.apiFormat,
    baseUrlOverride: f.baseUrlOverride.trim() || undefined,
    providerGroup: f.providerGroup.trim() || 'default',
    groupLabel: f.groupLabel.trim() || undefined,
    description: f.description.trim() || undefined,
    enabled: f.enabled,
  }
  if (f.apiKey.trim()) body.apiKey = f.apiKey
  return body
}

/**
 * model 表单 → API body
 * 2026-07-22 升级:把结构化 params 合并为 defaultParams jsonb
 */
function modelFormToBody(f: ModelFormState) {
  return {
    modelId: f.modelId.trim(),
    displayName: f.displayName.trim() || undefined,
    contextLength: f.contextLength,
    inputPricePer1k: f.inputPricePer1k || '0',
    outputPricePer1k: f.outputPricePer1k || '0',
    defaultParams: buildDefaultParams(f),
    enabled: f.enabled,
    isDefault: f.isDefault,
    sortOrder: f.sortOrder,
  }
}

function modelFormToUpdateBody(f: ModelFormState) {
  return {
    displayName: f.displayName.trim() || undefined,
    contextLength: f.contextLength,
    inputPricePer1k: f.inputPricePer1k || '0',
    outputPricePer1k: f.outputPricePer1k || '0',
    defaultParams: buildDefaultParams(f),
    enabled: f.enabled,
    isDefault: f.isDefault,
    sortOrder: f.sortOrder,
  }
}

/**
 * 把表单的 params(结构化) + advancedJson(高级 JSON) 合并成最终的 defaultParams jsonb
 * 优先级:advancedJson 非空时,以 advancedJson 为主(允许高级用户直接覆盖)
 */
function buildDefaultParams(f: ModelFormState): Record<string, unknown> {
  const trimmed = f.advancedJson.trim()
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      /* JSON 解析失败 → 降级为结构化字段 */
    }
  }
  // 仅保留有意义的字段(去除空字符串 / undefined)
  const out: Record<string, unknown> = {}
  const p = f.params
  if (typeof p.temperature === 'number') out.temperature = p.temperature
  if (typeof p.maxTokens === 'number' && p.maxTokens > 0) out.max_tokens = p.maxTokens
  if (typeof p.topP === 'number') out.top_p = p.topP
  if (typeof p.frequencyPenalty === 'number' && p.frequencyPenalty !== 0)
    out.frequency_penalty = p.frequencyPenalty
  if (typeof p.presencePenalty === 'number' && p.presencePenalty !== 0)
    out.presence_penalty = p.presencePenalty
  if (p.systemPrompt && p.systemPrompt.trim()) out.system = p.systemPrompt.trim()
  if (p.stop && p.stop.length > 0) out.stop = p.stop
  if (p.responseFormat && p.responseFormat !== 'text') out.response_format = { type: p.responseFormat }
  if (p.extra && Object.keys(p.extra).length > 0) Object.assign(out, p.extra)
  return out
}

/** 模板/已有 provider → 表单 */
export function providerToForm(p: UserLlmProvider, templateCode: string): ProviderFormState {
  return {
    id: p.id,
    providerCode: templateCode,
    name: p.name,
    apiKey: '',
    baseUrlOverride: p.baseUrl,
    apiFormat: p.apiFormat,
    providerGroup: p.providerGroup ?? 'default',
    groupLabel: p.groupLabel ?? '',
    description: p.description ?? '',
    enabled: p.enabled,
  }
}

/** model → 表单(2026-07-22 升级:把 defaultParams jsonb 解析成结构化字段) */
export function modelToForm(m: UserLlmModel): ModelFormState {
  const p = m.defaultParams ?? {}
  // 兼容:数据库存的可能是 { temperature, max_tokens, top_p, system } 等 key
  return {
    id: m.id,
    modelId: m.modelId,
    displayName: m.displayName ?? '',
    contextLength: m.contextLength,
    inputPricePer1k: m.inputPricePer1k,
    outputPricePer1k: m.outputPricePer1k,
    params: {
      temperature: typeof p.temperature === 'number' ? p.temperature : 0.7,
      maxTokens: typeof p.max_tokens === 'number' ? p.max_tokens : 4096,
      topP: typeof p.top_p === 'number' ? p.top_p : 1,
      frequencyPenalty: typeof p.frequency_penalty === 'number' ? p.frequency_penalty : 0,
      presencePenalty: typeof p.presence_penalty === 'number' ? p.presence_penalty : 0,
      systemPrompt: typeof p.system === 'string' ? p.system : '',
      stop: Array.isArray(p.stop) ? (p.stop as string[]) : undefined,
      responseFormat:
        p.response_format && typeof p.response_format === 'object' && 'type' in p.response_format
          ? ((p.response_format as { type: string }).type as 'text' | 'json_object')
          : undefined,
    },
    advancedJson: Object.keys(p).length > 0 ? JSON.stringify(p, null, 2) : '',
    enabled: m.enabled,
    isDefault: m.isDefault,
    sortOrder: m.sortOrder,
  }
}
