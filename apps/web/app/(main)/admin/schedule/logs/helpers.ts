import { listJobLogs, cleanJobLogs, type PageData } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import type { JobLog, JobLogFilter, JobLogSearch, JobLogStatus } from './types'

export const PAGE_SIZE = 10
export const PERM = 'monitor:job'

export const th = 'px-4 py-2.5 font-medium'

export const EMPTY_SEARCH: JobLogSearch = {
  jobName: '',
  jobGroup: '',
  status: 'all',
  startDate: '',
  endDate: '',
}

export function normalizeStatus(s?: string): JobLogStatus {
  if (!s) return 'running'
  const v = String(s).toLowerCase()
  if (v === '0' || v === 'success' || v === 'succeed') return 'success'
  if (v === '1' || v === 'fail' || v === 'error' || v === 'failed') return 'fail'
  return 'running'
}

export async function fetchJobLogs(
  filter: JobLogFilter,
): Promise<{ list: JobLog[]; total: number }> {
  const r = await listJobLogs({
    page: filter.page,
    pageSize: filter.pageSize,
    jobName: filter.jobName.trim() || undefined,
    jobGroup: filter.jobGroup.trim() || undefined,
    status: filter.status === 'all' ? undefined : filter.status,
    beginTime: filter.startDate || undefined,
    endTime: filter.endDate || undefined,
  })
  if (!r.success) throw new Error(r.error)
  const d = (r.data ?? { list: [], total: 0 }) as PageData<JobLog>
  return { list: d.list ?? [], total: d.total ?? 0 }
}

export async function clearJobLogs(): Promise<void> {
  const r = await cleanJobLogs()
  if (!r.success) throw new Error(r.error)
}

// DELETE /api/admin/job/log/:id — 单条任务日志删除
// 后端路由在 routes/admin-sys/job-log-routes.ts 注册(2026-07-25 P2 治理补齐)
export async function deleteJobLog(id: string | number): Promise<void> {
  const r = await fetchApi<{ id: number; deleted: boolean }>(
    `/api/admin/job/log/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!r.success) throw new Error(r.error)
}
