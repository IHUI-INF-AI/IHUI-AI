import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ListData } from './types'

export const PAGE_SIZE = 20

export const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

export const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  paid: '已打款',
  failed: '失败',
}

export const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'paid', label: '已打款' },
]

export async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetchApi<T>(url)
    return r.success ? r.data : fallback
  } catch {
    return fallback
  }
}

export const fmtYuan = (n: number) => `¥${(n / 100).toFixed(2)}`

export const badgeCls = (s: string) =>
  cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    STATUS_CLS[s] ?? 'bg-muted text-muted-foreground',
  )

export const amountCls = (n: number) =>
  cn(
    'px-4 py-2.5 text-right font-medium',
    n >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500',
  )

export function fetchWithdrawals(page: number, status: string): Promise<ListData> {
  return safeFetch<ListData>(
    `/commission/withdrawals?page=${page}&pageSize=${PAGE_SIZE}${status !== 'all' ? `&status=${status}` : ''}`,
    { items: [], total: 0 },
  )
}
