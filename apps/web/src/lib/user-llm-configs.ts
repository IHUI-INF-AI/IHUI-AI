/**
 * 用户 LLM 配置 API 客户端
 *
 * 桥接 apps/web/src/components/chat/model-selector.tsx 与
 * apps/web/app/(main)/models/*(模型广场)等需要"查询/创建用户 LLM 配置"的客户端。
 *
 * 后端接口:
 *   - GET  /api/user/llm-configs                    列表
 *   - GET  /api/user/llm-configs/templates          平台模板(15+ 预置)
 *   - POST /api/user/llm-configs                    创建
 *   - PUT  /api/user/llm-configs/:id                更新
 *   - DELETE /api/user/llm-configs/:id              删除
 *   - POST /api/user/llm-configs/:id/test           测试已保存配置
 *   - POST /api/user/llm-configs/:id/fetch-models   拉取上游模型
 *   - POST /api/user/llm-configs/preview-test       临时测试(未保存)
 */

import { fetchApi } from './api'

// =============================================================================
// 类型定义(与 apps/web/app/(main)/settings/llm/types.ts 保持一致)
// =============================================================================

export type ApiFormat = 'openai_chat' | 'anthropic_messages' | 'openai_responses'

export interface PlatformTemplate {
  code: string
  name: string
  vendor: string
  description: string
  baseUrl: string
  apiFormat: ApiFormat
  defaultModelId: string
  defaultContextLength: number
  modelsListPath?: string
  isOfficial: boolean
  docsUrl?: string
  signupUrl?: string
}

export interface UserLlmConfig {
  id: number
  name: string
  providerCode: string
  isBuiltin: boolean
  baseUrl: string
  apiFormat: string
  modelIdForTest: string | null
  enabled: boolean
  description: string | null
  contextLength: number
  hasApiKey: boolean
  lastTestStatus: 'success' | 'failed' | null
  lastTestResponseMs: number | null
  lastTestedAt: string | null
  lastTestError: string | null
  createdAt: string
  updatedAt: string
}

export interface UpstreamModel {
  id: string
  owned_by?: string
  context_length?: number
}

export interface TestResult {
  status: 'success' | 'failed'
  responseMs?: number
  modelEcho?: string
  message?: string
}

export interface FetchModelsResult {
  total: number
  models: UpstreamModel[]
  message?: string
}

export interface FetchConfigsResult {
  list: UserLlmConfig[]
  total: number
}

export interface FetchTemplatesResult {
  templates: PlatformTemplate[]
}

/** 通用 API 包装:从 ApiResult 解出 data,失败抛错 */
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error || '请求失败')
  return r.data
}

// =============================================================================
// API 方法
// =============================================================================

/** 拉取当前用户的所有 LLM 配置(登录态下后端按 userId 过滤) */
export function fetchConfigs(): Promise<FetchConfigsResult> {
  return api<FetchConfigsResult>('/api/user/llm-configs')
}

/** 拉取所有平台模板(15+ 预置,无需登录) */
export function fetchTemplates(): Promise<FetchTemplatesResult> {
  return api<FetchTemplatesResult>('/api/user/llm-configs/templates')
}

export interface CreateConfigInput {
  templateCode: string
  name: string
  apiKey: string
  modelId: string
  contextLength: number
  description?: string
  baseUrlOverride?: string
}

/** 创建 LLM 配置(API Key 加密存储) */
export function createConfig(input: CreateConfigInput) {
  return api<{ id: number; created: boolean; name: string }>('/api/user/llm-configs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdateConfigInput {
  name?: string
  apiKey?: string
  modelId?: string
  contextLength?: number
  description?: string
  baseUrlOverride?: string
  enabled?: boolean
}

/** 更新 LLM 配置(API Key 留空则不更新) */
export function updateConfig(id: number, input: UpdateConfigInput) {
  return api<{ id: number; updated: boolean }>(`/api/user/llm-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 临时测试连通(表单未保存时也可用) */
export function previewTest(input: {
  templateCode: string
  apiKey: string
  modelId: string
  baseUrlOverride?: string
}) {
  return api<TestResult>('/api/user/llm-configs/preview-test', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 判定某个模型/厂商是否已被用户配置且启用。
 *
 * 匹配规则:user config 的 providerCode 命中 providerToTemplateCode(model.provider / model.id)。
 *  - 例如模型 'gpt-4o' 推断 vendor='openai' → templateCode='openai' → 命中 user_config.providerCode='openai'
 *
 * 用于 model-selector 徽章 + 模型广场页配置状态判断。
 */
export function isProviderConfigured(
  configs: UserLlmConfig[] | undefined,
  _modelId: string,
  _provider: string,
  templateCode: string | null,
): boolean {
  if (!configs?.length || !templateCode) return false
  return configs.some((c) => c.enabled && c.providerCode === templateCode)
}
