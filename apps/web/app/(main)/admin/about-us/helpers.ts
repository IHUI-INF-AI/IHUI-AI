import { fetchApi } from '@/lib/api'
import type { AboutUsItem } from './types'

export const RESOURCE = '/api/admin/about-us'
export const PERM = 'system:us'
export const PAGE_SIZE = 10

export const EMPTY: AboutUsItem = {
  id: '',
  network: '',
  phone: '',
  socialMedia: '',
  experience: '',
  description: '',
}

export const SEARCH_KEYS = ['network', 'phone', 'socialMedia', 'experience'] as const

export const FIELDS: { key: keyof AboutUsItem; label: string; type?: 'textarea' }[] = [
  { key: 'network', label: 'fieldNetwork' },
  { key: 'phone', label: 'fieldPhone' },
  { key: 'socialMedia', label: 'fieldSocialMedia' },
  { key: 'experience', label: 'fieldExperience' },
  { key: 'description', label: 'fieldDescription', type: 'textarea' },
]

export const COLS: { key: keyof AboutUsItem; label: string }[] = [
  { key: 'id', label: 'colId' },
  ...FIELDS.map((f) => ({ key: f.key, label: f.label })),
]

export const TH_CLASS = 'px-4 py-2.5 font-medium'
export const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
