import { fetchApi } from '@/lib/api'
import type { RoleForm, Scope } from './types'

export const SCOPES: Scope[] = ['none', 'self', 'team', 'org', 'all']

export const inputClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY: RoleForm = {
  name: '',
  displayName: '',
  description: '',
  scope: 'self',
}
