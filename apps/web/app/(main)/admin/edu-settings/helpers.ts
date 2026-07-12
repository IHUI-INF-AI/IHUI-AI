import { fetchApi } from '@/lib/api'
import type { EduSetting, EduSettingForm, CfgType } from './types'

export const TYPES: CfgType[] = ['string', 'number', 'boolean', 'json']

export const EMPTY_FORM: EduSettingForm = {
  group: 'site',
  key: '',
  value: '',
  type: 'string',
  credentialsJson: '{}',
  isPublic: false,
  sort: 0,
  status: 1,
  description: '',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono'
export const th = 'px-4 py-2.5 font-medium'
export const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function normList(d: unknown): EduSetting[] {
  return Array.isArray(d) ? (d as EduSetting[]) : ((d as { list?: EduSetting[] })?.list ?? [])
}

export function parseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return {}
  }
}

export function eduSettingToForm(c: EduSetting): EduSettingForm {
  return {
    group: c.group,
    key: c.key,
    value: c.value ?? '',
    type: c.type,
    credentialsJson: JSON.stringify(c.credentials ?? {}, null, 2),
    isPublic: c.isPublic,
    sort: c.sort,
    status: c.status,
    description: c.description ?? '',
  }
}
