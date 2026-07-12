import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { FormState } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const PAGE_SIZE = 10

export const th = 'px-4 py-2.5 font-medium'

export interface FieldConfig {
  key: string
  label: string
  required?: boolean
}

export interface VipCrudConfig {
  resource: string
  perm: string
  fields: FieldConfig[]
  searchFields: { key: string; label: string }[]
  dateFields: { key: string; label: string }[]
  allKeys: string[]
  labels: Record<string, string>
  empty: FormState
  exportColumns: ExportColumn[]
  exportName: string
  exportMode: 'api' | 'list'
  enabled?: boolean
}

export const LEVEL_RESOURCE = '/api/admin/auth-vip-level'
export const LEVEL_PERM = 'ai:vip_level'
export const LEVEL_FIELDS: FieldConfig[] = [
  { key: 'title', label: '标题', required: true },
  { key: 'level', label: '等级', required: true },
  { key: 'remark', label: '备注', required: true },
  { key: 'progress', label: '进度', required: true },
  { key: 'model1', label: '模型1', required: true },
  { key: 'model2', label: '模型2', required: true },
  { key: 'creator', label: '创建人' },
]
export const LEVEL_SEARCH: { key: string; label: string }[] = [
  { key: 'title', label: '标题' },
  { key: 'level', label: '等级' },
  { key: 'progress', label: '进度' },
  { key: 'model1', label: '模型1' },
]
export const LEVEL_DATE_FIELDS: { key: string; label: string }[] = [
  { key: 'createdTime', label: '创建时间' },
]
export const LEVEL_ALL_KEYS = [
  ...LEVEL_FIELDS.map((f) => f.key),
  ...LEVEL_DATE_FIELDS.map((d) => d.key),
]
export const LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  [...LEVEL_FIELDS, ...LEVEL_DATE_FIELDS].map((f) => [f.key, f.label]),
)
export const LEVEL_EMPTY: FormState = Object.fromEntries(LEVEL_ALL_KEYS.map((k) => [k, '']))
export const LEVEL_EXPORT: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...LEVEL_ALL_KEYS.map((k) => ({ key: k, title: LEVEL_LABELS[k] ?? '' })),
]

export const USER_RESOURCE = '/api/admin/user-vip'
export const USER_PERM = 'ai:user_vip'
export const USER_FIELDS: FieldConfig[] = [
  { key: 'userId', label: '用户ID' },
  { key: 'openId', label: 'openId', required: true },
  { key: 'vipId', label: 'VIP ID', required: true },
  { key: 'progress', label: '进度', required: true },
  { key: 'creator', label: '创建人' },
]
export const USER_SEARCH: { key: string; label: string }[] = [
  { key: 'userId', label: '用户ID' },
  { key: 'openId', label: 'openId' },
  { key: 'vipId', label: 'VIP ID' },
  { key: 'progress', label: '进度' },
]
export const USER_DATE_FIELDS: { key: string; label: string }[] = [
  { key: 'createdTime', label: '创建时间' },
]
export const USER_ALL_KEYS = [
  ...USER_FIELDS.map((f) => f.key),
  ...USER_DATE_FIELDS.map((d) => d.key),
]
export const USER_LABELS: Record<string, string> = Object.fromEntries(
  [...USER_FIELDS, ...USER_DATE_FIELDS].map((f) => [f.key, f.label]),
)
export const USER_EMPTY: FormState = Object.fromEntries(USER_ALL_KEYS.map((k) => [k, '']))
export const USER_EXPORT: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...USER_ALL_KEYS.map((k) => ({ key: k, title: USER_LABELS[k] ?? '' })),
]
