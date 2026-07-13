import { fetchApi } from '@/lib/api'
import type { Category, CfgType, Config, ConfigForm } from './types'

export const CATEGORIES: Category[] = [
  'general',
  'mail',
  'storage',
  'security',
  'payment',
  'ai',
  'system',
]
export const TYPES: CfgType[] = ['string', 'number', 'boolean', 'json']

export const EMPTY_FORM: ConfigForm = {
  key: '',
  value: '',
  type: 'string',
  category: 'general',
  isPublic: false,
  description: '',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const th = 'px-4 py-2.5 font-medium'
export const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function normList(d: unknown): Config[] {
  return Array.isArray(d) ? (d as Config[]) : ((d as { list?: Config[] })?.list ?? [])
}

export function configToForm(c: Config): ConfigForm {
  return {
    key: c.key,
    value: c.value,
    type: c.type,
    category: c.category,
    isPublic: c.isPublic,
    description: c.description ?? '',
  }
}
