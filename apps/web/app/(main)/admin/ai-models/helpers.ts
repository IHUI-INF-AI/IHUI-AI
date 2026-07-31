import { fetchApi } from '@/lib/api'
import type { FormState, ModelRow } from './types'
export type { ModelRow, ListData, FormState, TestResult } from './types'

export const PAGE_SIZE = 10

export const EMPTY_FORM: FormState = {
  name: '',
  providerCode: '',
  baseUrl: '',
  apiFormat: 'openai_chat',
  modelIdForTest: '',
  apiKey: '',
  description: '',
  sortOrder: '0',
  enabled: true,
  ownerUuid: '',
  pointsMultiplier: 1,
}

export const API_FORMATS = [
  { value: 'openai_chat', label: 'OpenAI Chat' },
  { value: 'anthropic_messages', label: 'Anthropic Messages' },
  { value: 'openai_responses', label: 'OpenAI Responses' },
]

/** 积分消耗倍数档位(0=免费/1=经济/3=标准/10=高级/30=旗舰) */
export const POINTS_MULTIPLIERS = [
  { value: 0, label: '免费 (×0,不扣分)' },
  { value: 1, label: '经济 (×1)' },
  { value: 3, label: '标准 (×3)' },
  { value: 10, label: '高级 (×10)' },
  { value: 30, label: '旗舰 (×30)' },
] as const

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function rowToForm(item: ModelRow): FormState {
  return {
    name: item.name,
    providerCode: item.providerCode,
    baseUrl: item.baseUrl,
    apiFormat: item.apiFormat,
    modelIdForTest: item.modelIdForTest ?? '',
    apiKey: '',
    description: item.description ?? '',
    sortOrder: String(item.sortOrder),
    enabled: item.enabled,
    ownerUuid: item.ownerUuid ?? '',
    pointsMultiplier: item.pointsMultiplier ?? 1,
  }
}

export function formToBody(form: FormState) {
  return {
    name: form.name.trim(),
    providerCode: form.providerCode.trim(),
    baseUrl: form.baseUrl.trim(),
    apiFormat: form.apiFormat,
    modelIdForTest: form.modelIdForTest || undefined,
    apiKey: form.apiKey || undefined,
    description: form.description || undefined,
    sortOrder: Number(form.sortOrder) || 0,
    enabled: form.enabled,
    ownerUuid: form.ownerUuid || undefined,
    pointsMultiplier: form.pointsMultiplier,
  }
}
