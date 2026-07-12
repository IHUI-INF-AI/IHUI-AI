import { fetchApi } from '@/lib/api'
import type { OAuthApp, OAuthAppForm } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: OAuthAppForm = {
  name: '',
  redirectUris: '',
  scopes: '',
  ownerId: '',
}

export const STATUS_LABEL: Record<OAuthApp['status'], string> = {
  active: '正常',
  disabled: '已禁用',
  pending: '待审核',
}

export const STATUS_STYLE: Record<OAuthApp['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-600',
  disabled: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/10 text-amber-600',
}
