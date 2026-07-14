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
}

export const API_FORMATS = [
  { value: 'openai_chat', label: 'OpenAI Chat' },
  { value: 'anthropic_messages', label: 'Anthropic Messages' },
  { value: 'openai_responses', label: 'OpenAI Responses' },
]

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
  }
}
