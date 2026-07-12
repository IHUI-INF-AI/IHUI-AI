import { fetchApi } from '@/lib/api'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function formatDate(v?: string, locale: string = 'zh-CN'): string {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(d)
}

export const STATUS_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-destructive/10 text-destructive',
}
