import { fetchApi } from '@/lib/api'
import type { AgentRule, AgentRuleForm } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: AgentRuleForm = {
  agentId: '',
  ruleName: '',
  ruleCode: '',
  ruleType: 'filter',
  priority: '0',
  status: true,
  description: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'agentId', title: 'AgentID' },
  { key: 'ruleName', title: '规则名称' },
  { key: 'ruleCode', title: '规则编码' },
  { key: 'ruleType', title: '规则类型' },
  { key: 'priority', title: '优先级' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '禁用') },
  { key: 'description', title: '描述' },
]

export function agentRuleToForm(item: AgentRule): AgentRuleForm {
  return {
    agentId: item.agentId,
    ruleName: item.ruleName,
    ruleCode: item.ruleCode,
    ruleType: item.ruleType || 'filter',
    priority: String(item.priority),
    status: item.status === 1,
    description: item.description ?? '',
  }
}
