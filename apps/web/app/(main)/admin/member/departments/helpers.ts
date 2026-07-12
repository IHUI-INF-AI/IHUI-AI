import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { Department, FormState } from './types'

export const PAGE_SIZE = 10
export const RESOURCE = '/api/admin/user-dept'
export const PERM = 'usercenter:user_dept'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'deptCode', label: '部门编码', required: true },
  { key: 'parentCode', label: '父级编码', required: true },
  { key: 'corporateId', label: '企业ID', required: true },
  { key: 'weight', label: '权重' },
  { key: 'creator', label: '创建人', required: true },
]

export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'deptCode', label: '部门编码' },
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

export function itemToForm(item: Department): FormState {
  const next: FormState = { ...EMPTY }
  for (const k of ALL_KEYS) next[k] = String(item[k] ?? '')
  return next
}
