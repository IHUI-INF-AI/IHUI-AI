import { fetchApi } from '@/lib/api'
import type { PaperForm } from './types'

export const EMPTY_FORM: PaperForm = { paperTitle: '', paperUrl: '' }

export const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-destructive/10 text-destructive',
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function statusKey(status: number): string {
  if (status === 1) return 'statusApproved'
  if (status === 2) return 'statusRejected'
  return 'statusPending'
}
