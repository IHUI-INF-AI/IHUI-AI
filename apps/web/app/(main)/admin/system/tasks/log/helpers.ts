import { fetchApi } from '@/lib/api'
import type { SearchState, SortState } from './types'

export const RESOURCE = '/api/admin/system/tasks/logs'
export const PAGE_SIZE = 15

export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'

export const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: '成功', cls: 'bg-emerald-500/10 text-emerald-600' },
  1: { label: '失败', cls: 'bg-red-500/10 text-red-600' },
}

export const EMPTY_SEARCH: SearchState = { jobName: '', jobGroup: '', status: '' }

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'jobName', title: '任务名称' },
  { key: 'jobGroup', title: '任务组' },
  { key: 'invokeTarget', title: '调用目标' },
  { key: 'jobMessage', title: '日志信息' },
  { key: 'status', title: '状态', formatter: (v: unknown) => STATUS_LABEL[Number(v)]?.label ?? '' },
  { key: 'startTime', title: '开始时间' },
  { key: 'stopTime', title: '停止时间' },
  { key: 'costTime', title: '耗时(ms)' },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function buildQuery(page: number, applied: SearchState, sort: SortState): string {
  const qs = new URLSearchParams()
  qs.set('page', String(page))
  qs.set('pageSize', String(PAGE_SIZE))
  if (applied.jobName) qs.set('jobName', applied.jobName)
  if (applied.jobGroup) qs.set('jobGroup', applied.jobGroup)
  if (applied.status) qs.set('status', applied.status)
  qs.set('orderByColumn', sort.col)
  qs.set('isAsc', sort.dir)
  return qs.toString()
}

export function buildExportUrl(applied: SearchState): string {
  const qs = new URLSearchParams({
    pageSize: '9999',
    jobName: applied.jobName,
    jobGroup: applied.jobGroup,
    status: applied.status,
  })
  return `${RESOURCE}?${qs.toString()}`
}
