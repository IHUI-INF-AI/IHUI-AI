import { fetchApi } from '@/lib/api'
import type { AgentsData, AgentForm } from './types'

export const PAGE_SIZE = 20
export const STATUS_OPTIONS = ['pending', 'published', 'rejected', 'offline']

export const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-destructive/10 text-destructive',
  offline: 'bg-muted text-muted-foreground',
}

export const EMPTY_FORM: AgentForm = {
  name: '',
  description: '',
  avatar: '',
  cover: '',
  categoryId: '',
  status: 'pending',
  price: '0',
  isFree: true,
  sort: '0',
  remark: '',
}

export const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
export const selectClassLg =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchAgents(params: {
  page: number
  keyword: string
  status: string
}): Promise<AgentsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.status !== 'all') qs.set('status', params.status)
  return api<AgentsData>(`/api/agents/list?${qs.toString()}`)
}
