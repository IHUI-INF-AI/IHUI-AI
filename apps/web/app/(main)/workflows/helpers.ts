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

/** i18n 静态映射表 — 用于消除 `t(\`triggers.${var}\`)` / `t(\`instanceStatus.${var}\`)` / `t(\`status.${var}\`)` / `t(\`detail.tab_${var}\`)` 动态拼接 */
export const TRIGGER_KEYS: Record<TriggerType, string> = {
  manual: 'triggers.manual',
  schedule: 'triggers.schedule',
  event: 'triggers.event',
  webhook: 'triggers.webhook',
}

export const INSTANCE_STATUS_KEYS: Record<string, string> = {
  pending: 'instanceStatus.pending',
  running: 'instanceStatus.running',
  completed: 'instanceStatus.completed',
  failed: 'instanceStatus.failed',
  cancelled: 'instanceStatus.cancelled',
}

export const WF_STATUS_KEYS: Record<WfStatus, string> = {
  active: 'status.active',
  inactive: 'status.inactive',
}

export const DETAIL_TAB_KEYS: Record<'instances' | 'definition', string> = {
  instances: 'detail.tab_instances',
  definition: 'detail.tab_definition',
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
