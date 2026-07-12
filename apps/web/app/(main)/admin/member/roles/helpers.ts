import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { Item, FormState } from './types'

export const PAGE_SIZE = 10
export const RESOURCE = '/api/admin/user-roles'
export const PERM = 'usercenter:user_roles'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'roleCode', label: '角色编码', required: true },
  { key: 'description', label: '描述' },
  { key: 'parentCode', label: '父级角色' },
  { key: 'deptCode', label: '所属部门' },
  { key: 'weight', label: '权重' },
]
export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'roleCode', label: '角色编码' },
  { key: 'description', label: '描述' },
  { key: 'deptCode', label: '所属部门' },
]
export const DATE_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'createdAt', label: '创建时间' },
]
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

export function itemToForm(item: Item): FormState {
  const next: FormState = { ...EMPTY }
  for (const k of ALL_KEYS) next[k] = String(item[k] ?? '')
  return next
}
