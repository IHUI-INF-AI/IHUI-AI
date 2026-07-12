import { fetchApi } from '@/lib/api'
import type { InstStatus, LogLevel } from './types'

export async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const STATUS_BADGE: Record<InstStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: 'text-muted-foreground',
  info: 'text-primary',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
}

export const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
