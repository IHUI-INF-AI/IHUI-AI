import { fetchApi } from '@/lib/api'
import type { ContactItem } from './types'

export const RESOURCE = '/api/admin/contact'
export const PERM = 'system:contact'
export const EMPTY: ContactItem = { id: '', introduction: '', corporateCulture: '' }
export const th = 'px-4 py-2.5 font-medium'

export const FIELDS: {
  key: keyof Pick<ContactItem, 'introduction' | 'corporateCulture'>
  label: string
}[] = [
  { key: 'introduction', label: 'fieldIntroduction' },
  { key: 'corporateCulture', label: 'fieldCorporateCulture' },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').slice(0, 50) || '-'
}
