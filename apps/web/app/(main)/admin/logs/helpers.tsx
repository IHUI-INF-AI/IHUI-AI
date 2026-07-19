import * as React from 'react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export const PAGE_SIZE = 20
export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const STATS_DAYS_OPTS = [1, 7, 30]
export const CLEANUP_DAYS_OPTS = [7, 30, 90, 180]
export const inputClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function statusClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
  if (code >= 300 && code < 400) return 'bg-blue-500/10 text-blue-600 dark:text-blue-500'
  if (code >= 400 && code < 500) return 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
  if (code >= 500) return 'bg-red-500/10 text-red-600 dark:text-red-500'
  return 'bg-muted text-muted-foreground'
}

export function methodClass(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    case 'POST':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'DELETE':
      return 'bg-red-500/10 text-red-600 dark:text-red-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex justify-center rounded px-1.5 py-0.5 font-mono text-xs font-medium',
        cls,
      )}
    >
      {children}
    </span>
  )
}

export function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
