import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { FormState, Item } from './types'

export const RESOURCE = '/api/admin/auth-tokens'
export const PERM = 'auth:auth_tokens'
export const PAGE_SIZE = 10

export const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'userUuid', label: '用户UUID', required: true },
  { key: 'token', label: 'Token', required: true },
  { key: 'refreshToken', label: '刷新Token', required: true },
  { key: 'tokenType', label: 'Token类型' },
]
export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'userUuid', label: '用户UUID' },
]
export const DATE_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'expiresAt', label: '过期时间', required: true },
  { key: 'refreshExpiresAt', label: '刷新过期时间', required: true },
  { key: 'createdAt', label: '创建时间' },
]
export const ALL_KEYS = [...FIELDS.map((f) => f.key), ...DATE_FIELDS.map((d) => d.key)]
export const LABELS: Record<string, string> = Object.fromEntries(
  [...FIELDS, ...DATE_FIELDS].map((f) => [f.key, f.label]),
)
export const EMPTY_FORM: FormState = Object.fromEntries(ALL_KEYS.map((k) => [k, '']))
export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...ALL_KEYS.map((k) => ({ key: k, title: LABELS[k] ?? '' })),
]
export const th = 'px-4 py-2.5 font-medium'
export const colCount = 1 + ALL_KEYS.length + 1

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function itemToForm(item: Item): FormState {
  const next: FormState = { ...EMPTY_FORM }
  for (const k of ALL_KEYS) next[k] = String(item[k] ?? '')
  return next
}

export function emptySearch(): FormState {
  return Object.fromEntries(SEARCH_FIELDS.map((f) => [f.key, '']))
}
