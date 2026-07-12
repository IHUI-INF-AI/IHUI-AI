import { fetchApi } from '@/lib/api'
import type { Rule, RuleForm } from './types'

export const PAGE_SIZE = 20

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: RuleForm = {
  name: '',
  code: '',
  channelId: '',
  point: '0',
  description: '',
  sort: '0',
  status: true,
}

export function ruleToForm(rule: Rule): RuleForm {
  return {
    name: rule.name,
    code: rule.code ?? '',
    channelId: rule.channelId ?? '',
    point: String(rule.point ?? 0),
    description: rule.description ?? '',
    sort: String(rule.sort),
    status: rule.status === 1,
  }
}
