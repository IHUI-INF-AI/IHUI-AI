import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { FieldDef, FormState, Item, SearchFieldDef } from './types'

export const RESOURCE = '/api/admin/auth-sms-temp'
export const PERM = 'auth:auth_sms_temp'
export const PAGE_SIZE = 10

export const FIELDS: FieldDef[] = [
  { key: 'tempCode', label: '模板编码' },
  { key: 'smsCode', label: '短信编码' },
  { key: 'sourcePlatform', label: '来源平台' },
  { key: 'remark', label: '备注' },
  { key: 'status', label: '状态' },
  { key: 'signName', label: '签名名称' },
  { key: 'field1', label: '扩展字段1' },
  { key: 'field2', label: '扩展字段2' },
  { key: 'creator', label: '创建人' },
]
export const SEARCH_FIELDS: SearchFieldDef[] = [
  { key: 'tempCode', label: '模板编码' },
  { key: 'smsCode', label: '短信编码' },
  { key: 'sourcePlatform', label: '来源平台' },
  { key: 'signName', label: '签名名称' },
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
