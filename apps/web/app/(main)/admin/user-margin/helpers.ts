import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { Item, FormState } from './types'

export const RESOURCE = '/api/admin/auth-user-margin'
export const PERM = 'auth:authusermargin'
export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'userUuid', label: '用户UUID' },
  { key: 'tokenQuantity', label: 'Token总量' },
  { key: 'tokenFree', label: '免费Token' },
  { key: 'aument', label: '增量' },
  { key: 'field1', label: '扩展字段1' },
  { key: 'field2', label: '扩展字段2' },
  { key: 'field3', label: '扩展字段3' },
]
export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'userUuid', label: '用户UUID' },
  { key: 'field1', label: '扩展字段1' },
]
export const SEARCH_DATE_FIELDS: { key: string; label: string }[] = [
  { key: 'createdTime', label: '创建时间' },
]
export const DATE_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'createdTime', label: '创建时间' },
]
export const ALL_KEYS = [...FIELDS.map((f) => f.key), ...DATE_FIELDS.map((d) => d.key)]
export const ALL_SEARCH = [...SEARCH_FIELDS, ...SEARCH_DATE_FIELDS]
export const LABELS: Record<string, string> = Object.fromEntries(
  [...FIELDS, ...DATE_FIELDS].map((f) => [f.key, f.label]),
)
export const EMPTY: FormState = Object.fromEntries(ALL_KEYS.map((k) => [k, '']))
export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...ALL_KEYS.map((k) => ({ key: k, title: LABELS[k] ?? '' })),
]
export const th = 'px-4 py-2.5 font-medium'
export const colCount = 1 + ALL_KEYS.length + 1

export function itemToForm(item: Item): FormState {
  const next: FormState = { ...EMPTY }
  for (const k of ALL_KEYS) next[k] = String(item[k] ?? '')
  return next
}
