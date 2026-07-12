import { fetchApi } from '@/lib/api'
import type { RefundStatus } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const REFUND_STATUS_CFG: Record<RefundStatus, { cls: string; dot: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  approved: {
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    dot: 'bg-emerald-500',
  },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
  processing: {
    cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500',
    dot: 'bg-purple-500',
  },
  completed: {
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    dot: 'bg-emerald-500',
  },
  failed: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
}

export const STATUS_TABS: { value: string; labelKey: 'all' | RefundStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'approved', labelKey: 'approved' },
  { value: 'rejected', labelKey: 'rejected' },
  { value: 'processing', labelKey: 'processing' },
  { value: 'completed', labelKey: 'completed' },
  { value: 'failed', labelKey: 'failed' },
]

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const inputClass =
  'h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
