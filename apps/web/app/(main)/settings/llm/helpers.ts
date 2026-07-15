import { fetchApi } from '@/lib/api'
import type {
  FormState,
  UserLlmConfig,
  PlatformTemplate,
  FetchModelsResult,
  TestResult,
} from './types'
export type {
  FormState,
  UserLlmConfig,
  PlatformTemplate,
  FetchModelsResult,
  TestResult,
} from './types'
export { EMPTY_FORM } from './types'

/** 通用 API 包装:从 ApiResult 解出 data,失败抛错 */
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 列表响应 */
export interface ListData {
  list: UserLlmConfig[]
  total: number
}

/** 模板响应 */
export interface TemplatesData {
  templates: PlatformTemplate[]
}

/** 用户配置 → 表单 */
export function configToForm(c: UserLlmConfig, templateCode: string): FormState {
  return {
    id: c.id,
    templateCode,
    name: c.name,
    apiKey: '',
    modelId: c.modelIdForTest ?? '',
    contextLength: String(c.contextLength),
    description: c.description ?? '',
    baseUrlOverride: c.baseUrl ?? '',
    enabled: c.enabled,
  }
}

/** 模板 → 表单默认值 */
export function templateToForm(t: PlatformTemplate): FormState {
  return {
    id: null,
    templateCode: t.code,
    name: t.name,
    apiKey: '',
    modelId: t.defaultModelId,
    contextLength: String(t.defaultContextLength),
    description: '',
    baseUrlOverride: '',
    enabled: true,
  }
}

/** 表单 → 提交体 */
export function formToCreateBody(f: FormState) {
  return {
    templateCode: f.templateCode,
    name: f.name.trim(),
    apiKey: f.apiKey,
    modelId: f.modelId.trim(),
    contextLength: Number(f.contextLength) || 32000,
    description: f.description.trim() || undefined,
    baseUrlOverride: f.baseUrlOverride.trim() || undefined,
  }
}

/** 表单 → 更新体(API Key 留空则不更新) */
export function formToUpdateBody(f: FormState) {
  const body: Record<string, unknown> = {
    name: f.name.trim(),
    modelId: f.modelId.trim(),
    contextLength: Number(f.contextLength) || 32000,
    description: f.description.trim() || undefined,
    baseUrlOverride: f.baseUrlOverride.trim() || undefined,
    enabled: f.enabled,
  }
  if (f.apiKey.trim()) body.apiKey = f.apiKey
  return body
}

/** 测试连通(对已保存的配置) */
export function testConfig(id: number) {
  return api<TestResult>(`/api/user/llm-configs/${id}/test`, { method: 'POST' })
}

/** 拉取上游模型列表 */
export function fetchUpstreamModels(id: number) {
  return api<FetchModelsResult>(`/api/user/llm-configs/${id}/fetch-models`, { method: 'POST' })
}

/** 预览测试(表单未保存时也可用) */
export function previewTest(body: {
  templateCode: string
  apiKey: string
  modelId: string
  baseUrlOverride?: string
}) {
  return api<TestResult>(`/api/user/llm-configs/preview-test`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 拉取所有平台模板 */
export function fetchTemplates() {
  return api<TemplatesData>(`/api/user/llm-configs/templates`)
}

/** 拉取当前用户的所有配置 */
export function fetchConfigs() {
  return api<ListData>(`/api/user/llm-configs`)
}

/** 创建配置 */
export function createConfig(f: FormState) {
  return api<{ id: number; created: boolean; name: string }>(`/api/user/llm-configs`, {
    method: 'POST',
    body: JSON.stringify(formToCreateBody(f)),
  })
}

/** 更新配置 */
export function updateConfig(id: number, f: FormState) {
  return api<{ id: number; updated: boolean }>(`/api/user/llm-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(formToUpdateBody(f)),
  })
}

/** 切换启用 */
export function toggleConfig(id: number, enabled: boolean) {
  return api(`/api/user/llm-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })
}

/** 删除配置 */
export function deleteConfig(id: number) {
  return api<{ id: number; deleted: boolean }>(`/api/user/llm-configs/${id}`, { method: 'DELETE' })
}

/** API Key 遮罩显示(后端不返回明文 key,仅依据 hasApiKey 显示) */
export function maskKey(hasKey: boolean): string {
  return hasKey ? '已配置(加密存储)' : '—'
}

/** 时间格式化(本地化短时间) */
export function formatTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}
