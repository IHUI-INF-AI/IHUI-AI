import { fetchApi } from '@/lib/api'
import type { RoleForm, Scope } from './types'

export const SCOPES: Scope[] = ['none', 'self', 'team', 'org', 'all']

/** i18n 静态映射表 — 用于消除 `t(`scopes.${s}`)` 动态拼接 */
export const SCOPES_KEY: Record<Scope, string> = {
  none: 'scopes.none',
  self: 'scopes.self',
  team: 'scopes.team',
  org: 'scopes.org',
  all: 'scopes.all',
}

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
