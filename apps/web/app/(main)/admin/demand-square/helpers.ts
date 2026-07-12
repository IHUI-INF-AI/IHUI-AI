import { fetchApi } from '@/lib/api'
import type { ExamineData } from './types'

export const PAGE_SIZE = 20
export const STATUS_OPTIONS = ['pending', 'approved', 'rejected']

export const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-destructive/10 text-destructive',
}

export const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchExamine(params: { page: number; status: string }): Promise<ExamineData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status !== 'all') qs.set('status', params.status)
  return api<ExamineData>(`/api/examine/list?${qs.toString()}`)
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'agentId', title: 'Agent ID' },
  { key: 'userId', title: '用户 ID' },
  { key: 'status', title: '状态' },
  { key: 'reason', title: '原因' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'updatedAt', title: '更新时间' },
]
