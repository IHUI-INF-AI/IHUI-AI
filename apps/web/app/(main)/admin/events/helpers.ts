import { fetchApi } from '@/lib/api'
import type { EventType, Level, SystemEvent, EventForm } from './types'

export const TYPES: EventType[] = [
  'startup',
  'shutdown',
  'error',
  'warning',
  'maintenance',
  'deploy',
]
export const LEVELS: Level[] = ['info', 'warn', 'error']

export const LEVEL_BADGE: Record<Level, string> = {
  info: 'bg-muted text-muted-foreground',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  error: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

export const TYPE_DOT: Record<EventType, string> = {
  startup: 'bg-emerald-500',
  shutdown: 'bg-muted-foreground',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  maintenance: 'bg-orange-500',
  deploy: 'bg-primary',
}

/**
 * 事件类型 i18n key 静态映射表:types.${type} — 用于消除 `t(\`types.${var}\`)` 动态拼接
 */
export const TYPE_KEY: Record<string, string> = Object.fromEntries(
  TYPES.map((tp) => [tp, `types.${tp}`]),
)

/**
 * 事件级别 i18n key 静态映射表:levels.${level} — 用于消除 `t(\`levels.${var}\`)` 动态拼接
 */
export const LEVEL_KEY: Record<string, string> = Object.fromEntries(
  LEVELS.map((lv) => [lv, `levels.${lv}`]),
)

export const EMPTY_FORM: EventForm = {
  type: 'maintenance',
  level: 'info',
  message: '',
  data: '',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function normList(d: unknown): SystemEvent[] {
  return Array.isArray(d) ? (d as SystemEvent[]) : ((d as { list?: SystemEvent[] })?.list ?? [])
}

export function eventToForm(ev: SystemEvent): EventForm {
  return {
    type: ev.type,
    level: ev.level,
    message: ev.message,
    data: ev.data ? JSON.stringify(ev.data, null, 2) : '',
  }
}
