import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AgentRule, ListData, RuleParam, RuleForm } from './types'

export const PAGE_SIZE = 20

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchRules(page: number): Promise<ListData<AgentRule>> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  return api<ListData<AgentRule>>(`/api/agent-ext/rules/list?${qs.toString()}`)
}

export function fetchRuleParams(page: number): Promise<ListData<RuleParam>> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  return api<ListData<RuleParam>>(`/api/agent-ext/rule-params/list?${qs.toString()}`)
}

export const EMPTY_FORM: RuleForm = {
  agentId: '',
  ruleName: '',
  ruleCode: '',
  ruleType: 'text',
  priority: '0',
  status: true,
  description: '',
}

export function badgeCls(enabled: boolean) {
  return cn(
    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
    enabled
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
      : 'bg-muted text-muted-foreground',
  )
}

export function dotCls(enabled: boolean) {
  return cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-emerald-500' : 'bg-muted-foreground')
}

export const RULES_EXPORT_COLS = [
  { key: 'id', title: 'ID' },
  { key: 'agentId', title: 'Agent ID' },
  { key: 'ruleName', title: '名称' },
  { key: 'ruleCode', title: '编码' },
  { key: 'ruleType', title: '类型' },
  { key: 'priority', title: '优先级' },
  { key: 'status', title: '状态' },
] as const

export const PARAMS_EXPORT_COLS = [
  { key: 'id', title: 'ID' },
  { key: 'ruleId', title: 'Rule ID' },
  { key: 'name', title: '名称' },
  { key: 'paramKey', title: 'Key' },
  { key: 'paramValue', title: 'Value' },
  { key: 'paramType', title: '类型' },
] as const
