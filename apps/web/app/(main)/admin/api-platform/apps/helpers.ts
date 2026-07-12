import { fetchApi } from '@/lib/api'
import type { ApiAppForm } from './types'

export const RESOURCE = '/api/admin/api-platform/apps'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: ApiAppForm = { name: '', permissions: '' }

export function copyText(text: string) {
  navigator.clipboard?.writeText(text)
}
