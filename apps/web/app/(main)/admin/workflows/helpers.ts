import { fetchApi } from '@/lib/api'
import type { TriggerType, WfStatus, WorkflowItem, WorkflowForm } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchWorkflows(): Promise<WorkflowItem[]> {
  const data = await api<{ list: WorkflowItem[] }>('/api/workflows')
  return data?.list ?? []
}

export const STATUS_BADGE: Record<WfStatus, { cls: string; dot: string }> = {
  active: {
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    dot: 'bg-emerald-500',
  },
  draft: { cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  archived: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
}

export const TRIGGER_BADGE: Record<TriggerType, string> = {
  manual: 'bg-muted text-muted-foreground',
  schedule: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  event: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  webhook: 'bg-primary/10 text-primary',
}

export const TRIGGER_OPTIONS: TriggerType[] = ['manual', 'schedule', 'event', 'webhook']

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: WorkflowForm = {
  name: '',
  description: '',
  triggerType: 'manual',
  stepsText: '',
}

export function stepName(s: unknown): string {
  return typeof s === 'object' && s !== null && 'name' in s
    ? String((s as { name: unknown }).name)
    : JSON.stringify(s)
}

export function stepsToText(steps?: unknown[]): string {
  if (!Array.isArray(steps)) return ''
  return steps.map(stepName).join('\n')
}

export function textToSteps(text: string): { name: string }[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }))
}
