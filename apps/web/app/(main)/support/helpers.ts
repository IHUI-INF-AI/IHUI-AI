import { fetchApi } from '@/lib/api'
import type { TicketStatus, TicketPriority } from './types'

export const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: '待处理',
  open: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  rejected: '已驳回',
}

export const STATUS_BADGE: Record<TicketStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

export const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
