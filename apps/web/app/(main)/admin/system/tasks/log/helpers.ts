import { fetchApi } from '@/lib/api'
import { type ExportColumn } from '@/lib/export-utils'
import type { SearchState, SortState } from './types'

export const RESOURCE = '/api/admin/system/tasks/logs'
export const PAGE_SIZE = 15

export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'

/** Maps status number to { label: i18n key, cls: css class } */
export const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: 'tasksLog.status.success', cls: 'bg-emerald-500/10 text-emerald-600' },
  1: { label: 'tasksLog.status.failed', cls: 'bg-red-500/10 text-red-600' },
}

export const EMPTY_SEARCH: SearchState = { jobName: '', jobGroup: '', status: '' }

/** i18n key prefix: admin.system */
export function getExportColumns(t: (key: string) => string): ExportColumn[] {
  return [
    { key: 'id', title: t('tasksLog.table.id') },
    { key: 'jobName', title: t('tasksLog.table.jobName') },
    { key: 'jobGroup', title: t('tasksLog.table.jobGroup') },
    { key: 'invokeTarget', title: t('tasksLog.table.invokeTarget') },
    { key: 'jobMessage', title: t('tasksLog.table.jobMessage') },
    {
      key: 'status',
      title: t('tasksLog.table.status'),
      formatter: (v: unknown) => t(STATUS_LABEL[Number(v)]?.label ?? ''),
    },
    { key: 'startTime', title: t('tasksLog.table.startTime') },
    { key: 'stopTime', title: t('tasksLog.export.stopTime') },
    { key: 'costTime', title: t('tasksLog.export.costTime') },
  ]
}

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
