import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { FieldDef, FormState, Item, SearchFieldDef } from './types'

export const RESOURCE = '/api/admin/auth-info'
export const PERM = 'auth:auth_info'
export const PAGE_SIZE = 10

export const FIELDS: FieldDef[] = [
  { key: 'userUuid', label: '用户UUID', required: true },
  { key: 'username', label: '用户名' },
  { key: 'phone', label: '手机号' },
  { key: 'certificate', label: '证件号', required: true },
  { key: 'email', label: '邮箱' },
  { key: 'country', label: '国家' },
  { key: 'province', label: '省份' },
  { key: 'city', label: '城市' },
]
export const SEARCH_FIELDS: SearchFieldDef[] = [
  { key: 'username', label: '用户名' },
  { key: 'phone', label: '手机号' },
  { key: 'certificate', label: '证件号' },
]
export const DATE_FIELDS: FieldDef[] = [{ key: 'createdAt', label: '创建时间' }]

export const ALL_KEYS = [...FIELDS.map((f) => f.key), ...DATE_FIELDS.map((d) => d.key)]
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

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function itemToForm(item: Item): FormState {
  const next: FormState = { ...EMPTY }
  for (const k of ALL_KEYS) next[k] = String(item[k] ?? '')
  return next
}

export function emptySearch(): FormState {
  return Object.fromEntries(SEARCH_FIELDS.map((f) => [f.key, '']))
}
