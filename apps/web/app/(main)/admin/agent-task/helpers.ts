import { fetchApi } from '@/lib/api'
import type { AgentTask, AgentTaskForm } from './types'

export const PAGE_SIZE = 10

export const STATUS_MAP: Record<number, string> = {
  0: '待审批',
  1: '已拒绝',
  2: '已审批',
  3: '沟通中',
  4: '开发中',
  5: '交付中',
  6: '已完成',
}

export const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600',
  1: 'bg-red-500/10 text-red-600',
  2: 'bg-emerald-500/10 text-emerald-600',
  3: 'bg-blue-500/10 text-blue-600',
  4: 'bg-purple-500/10 text-purple-600',
  5: 'bg-cyan-500/10 text-cyan-600',
  6: 'bg-muted text-muted-foreground',
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: AgentTaskForm = {
  title: '',
  context: '',
  lowestPrice: '',
  peakPrice: '',
  cycle: '',
  cycleUnit: '',
  closingTime: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: '需求标题' },
  { key: 'context', title: '需求描述' },
  { key: 'createdName', title: '发布者' },
  { key: 'closingTime', title: '截止时间' },
  { key: 'cycle', title: '项目周期' },
  { key: 'lowestPrice', title: '最低价' },
  { key: 'peakPrice', title: '最高价' },
  { key: 'status', title: '状态', formatter: (v: unknown) => STATUS_MAP[v as number] ?? '-' },
  { key: 'createdAt', title: '创建时间' },
]

export function agentTaskToForm(item: AgentTask): AgentTaskForm {
  return {
    title: item.title ?? '',
    context: item.context ?? '',
    lowestPrice: item.lowestPrice ?? '',
    peakPrice: item.peakPrice ?? '',
    cycle: item.cycle ?? '',
    cycleUnit: item.cycleUnit ?? '',
    closingTime: item.closingTime ?? '',
  }
}
