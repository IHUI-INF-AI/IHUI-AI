import { fetchApi } from '@/lib/api'
import type { TriggerType, WfStatus, WorkflowForm } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const TRIGGER_BADGE: Record<TriggerType, string> = {
  manual: 'bg-muted text-muted-foreground',
  schedule: 'bg-amber-500/10 text-amber-600',
  event: 'bg-emerald-500/10 text-emerald-600',
  webhook: 'bg-primary/10 text-primary',
}

export const STATUS_DOT: Record<WfStatus, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-muted-foreground',
}

export const DEFAULT_STEPS = `[
  { "name": "step1", "type": "task", "action": "echo" }
]`

export const EMPTY_FORM: WorkflowForm = {
  name: '',
  description: '',
  triggerType: 'manual',
  steps: DEFAULT_STEPS,
}
