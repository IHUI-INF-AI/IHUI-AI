import { fetchApi } from '@/lib/api'
import type { NotificationLogSearch } from './types'

export const PAGE_SIZE = 10
export const RESOURCE = '/api/notifications/logs'
export const th = 'px-4 py-2.5 font-medium'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_SEARCH: NotificationLogSearch = {
  channel: 'all',
  status: 'all',
  startDate: '',
  endDate: '',
}

export function buildQueryParams(
  search: NotificationLogSearch,
  page: number,
  pageSize: number,
): Record<string, string> {
  const p: Record<string, string> = { page: String(page), pageSize: String(pageSize) }
  if (search.channel && search.channel !== 'all') p.channel = search.channel
  if (search.status && search.status !== 'all') p.status = search.status
  if (search.startDate.trim()) p.startDate = search.startDate.trim()
  if (search.endDate.trim()) p.endDate = search.endDate.trim()
  return p
}

export function maskUserId(id?: string): string {
  if (!id) return '-'
  if (id.length <= 8) return `${id.slice(0, 2)}***`
  return `${id.slice(0, 4)}***${id.slice(-4)}`
}

export const STATUS_BADGE: Record<string, string> = {
  sent: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
  pending: 'bg-amber-500/10 text-amber-600',
}
