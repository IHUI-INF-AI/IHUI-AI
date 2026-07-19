/**
 * 监控管理 API
 * 对接后端 schedule.ts / admin-sys.ts(job/job_log/online) / admin-extended.ts(online-users),
 * 覆盖定时任务、任务日志、RuoYi 定时任务、在线用户模块 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型定义 =====================

export interface ScheduleTask {
  id: string
  name: string
  cronExpression: string
  description?: string | null
  targetService?: string | null
  targetMethod?: string | null
  parameters?: string | null
  priority?: number
  maxRetryCount?: number
  timeout?: number
  enabled: boolean
  createdAt: string
  updatedAt?: string
  lastRunAt?: string | null
  lastRunStatus?: string
  [key: string]: unknown
}

export interface ScheduleLog {
  id: string
  taskId: string
  status: string
  startTime?: string
  endTime?: string
  duration?: number
  result?: string | null
  errorMessage?: string | null
  createdAt: string
  [key: string]: unknown
}

export interface SysJob {
  jobId: number
  jobName: string
  jobGroup?: string
  invokeTarget: string
  cronExpression: string
  misfirePolicy?: string
  concurrent?: string
  status?: string
  remark?: string
  createTime?: string
  [key: string]: unknown
}

export interface SysJobLog {
  jobLogId?: number
  jobName?: string
  jobGroup?: string
  invokeTarget?: string
  jobMessage?: string
  status?: string
  createTime?: string
  [key: string]: unknown
}

export interface OnlineSession {
  tokenId: string
  userId: string
  username?: string
  nickname?: string
  avatar?: string | null
  roleId?: number
  loginAt: string
  expiresAt: string
  familyId?: string
  [key: string]: unknown
}

export interface OnlineUserRow {
  id: string
  username: string
  ip_address?: string
  login_at?: string
  last_active_at?: string
  device_info?: string
  location?: string
  status?: string
  [key: string]: unknown
}

// ===================== schedule/tasks（定时任- 公共只读=====================

export async function listScheduleTasks(
  query: PageQuery & { enabled?: boolean; name?: string } = {},
): Promise<ApiResult<PageData<ScheduleTask>>> {
  return fetchApi<PageData<ScheduleTask>>(`/api/schedule/tasks${buildQs(query)}`)
}

export async function getScheduleTask(id: string): Promise<ApiResult<{ task: ScheduleTask }>> {
  return fetchApi<{ task: ScheduleTask }>(`/api/schedule/tasks/${id}`)
}

export async function listScheduleLogs(
  query: PageQuery & { taskId?: string; status?: string } = {},
): Promise<ApiResult<PageData<ScheduleLog>>> {
  return fetchApi<PageData<ScheduleLog>>(`/api/schedule/logs${buildQs(query)}`)
}

export async function getScheduleLog(id: string): Promise<ApiResult<{ log: ScheduleLog }>> {
  return fetchApi<{ log: ScheduleLog }>(`/api/schedule/logs/${id}`)
}

// ===================== schedule（别名端- 创建/更新/删除/完成=====================

export async function addScheduleTask(
  body: Partial<ScheduleTask> & { name: string; cronExpression: string },
): Promise<ApiResult<{ task: ScheduleTask }>> {
  return fetchApi<{ task: ScheduleTask }>('/api/schedule', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateScheduleTask(
  id: string,
  body: Partial<ScheduleTask>,
): Promise<ApiResult<{ task: ScheduleTask }>> {
  return fetchApi<{ task: ScheduleTask }>(`/api/schedule/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delScheduleTask(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/api/schedule/${id}`, { method: 'DELETE' })
}

export async function completeScheduleTask(
  id: string,
): Promise<ApiResult<{ id: string; status: string }>> {
  return fetchApi<{ id: string; status: string }>(`/api/schedule/${id}/complete`, {
    method: 'POST',
  })
}

// ===================== admin/schedule/tasks（定时任- 管理员写操作=====================

export async function addAdminScheduleTask(
  body: Partial<ScheduleTask> & { name: string; cronExpression: string },
): Promise<ApiResult<{ task: ScheduleTask }>> {
  return fetchApi<{ task: ScheduleTask }>('/api/admin/schedule/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminScheduleTask(
  id: string,
  body: Partial<ScheduleTask>,
): Promise<ApiResult<{ task: ScheduleTask }>> {
  return fetchApi<{ task: ScheduleTask }>(`/api/admin/schedule/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAdminScheduleTask(
  id: string,
): Promise<ApiResult<{ id: string; deleted: boolean }>> {
  return fetchApi<{ id: string; deleted: boolean }>(`/api/admin/schedule/tasks/${id}`, {
    method: 'DELETE',
  })
}

export async function enableScheduleTask(
  id: string,
): Promise<ApiResult<{ id: string; enabled: boolean }>> {
  return fetchApi<{ id: string; enabled: boolean }>(`/api/admin/schedule/tasks/${id}/enable`, {
    method: 'PUT',
  })
}

export async function disableScheduleTask(
  id: string,
): Promise<ApiResult<{ id: string; enabled: boolean }>> {
  return fetchApi<{ id: string; enabled: boolean }>(`/api/admin/schedule/tasks/${id}/disable`, {
    method: 'PUT',
  })
}

export async function runScheduleTask(
  id: string,
): Promise<ApiResult<{ id: string; logId: string; status: string }>> {
  return fetchApi<{ id: string; logId: string; status: string }>(
    `/api/admin/schedule/tasks/${id}/run`,
    { method: 'PUT' },
  )
}

// ===================== admin/job（RuoYi 定时任务=====================

export async function listJobs(
  query: PageQuery & { jobName?: string; jobGroup?: string; status?: string } = {},
): Promise<ApiResult<PageData<SysJob>>> {
  return fetchApi<PageData<SysJob>>(`/api/admin/job/list${buildQs(query)}`)
}

export async function getJob(jobId: number | string): Promise<ApiResult<{ data: SysJob }>> {
  return fetchApi<{ data: SysJob }>(`/api/admin/job/${jobId}`)
}

export async function addJob(body: {
  jobName: string
  jobGroup?: string
  invokeTarget: string
  cronExpression: string
  misfirePolicy?: string
  concurrent?: string
  status?: string
  remark?: string
}): Promise<ApiResult<{ job: SysJob }>> {
  return fetchApi<{ job: SysJob }>('/api/admin/job', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateJob(
  body: Partial<SysJob> & { jobId: number },
): Promise<ApiResult<{ job: SysJob }>> {
  return fetchApi<{ job: SysJob }>('/api/admin/job', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function changeJobStatus(
  jobId: number,
  status: string,
): Promise<ApiResult<{ job: SysJob }>> {
  return fetchApi<{ job: SysJob }>('/api/admin/job/changeStatus', {
    method: 'PUT',
    body: JSON.stringify({ jobId, status }),
  })
}

export async function runJob(
  jobId: number,
  jobGroup?: string,
): Promise<ApiResult<{ jobId: number; message: string }>> {
  return fetchApi<{ jobId: number; message: string }>('/api/admin/job/run', {
    method: 'PUT',
    body: JSON.stringify({ jobId, jobGroup }),
  })
}

export async function delJobs(jobIds: string | number): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/job/${jobIds}`, { method: 'DELETE' })
}

// ===================== admin/job/log（RuoYi 任务日志=====================

export async function listJobLogs(
  query: PageQuery & { jobName?: string; jobGroup?: string; status?: string } = {},
): Promise<ApiResult<PageData<SysJobLog>>> {
  return fetchApi<PageData<SysJobLog>>(`/api/admin/job/log/list${buildQs(query)}`)
}

export async function cleanJobLogs(): Promise<ApiResult<Record<string, unknown>>> {
  return fetchApi<Record<string, unknown>>('/api/admin/job/log/clean', { method: 'DELETE' })
}

// ===================== admin/online（在线会- refresh_tokens=====================

export async function listOnlineSessions(): Promise<
  ApiResult<{ list: OnlineSession[]; total: number }>
> {
  return fetchApi<{ list: OnlineSession[]; total: number }>('/api/admin/online/list')
}

export async function forceLogoutSession(
  tokenId: string,
): Promise<ApiResult<{ tokenId: string; forced: boolean }>> {
  return fetchApi<{ tokenId: string; forced: boolean }>(`/api/admin/online/${tokenId}`, {
    method: 'DELETE',
  })
}

// ===================== admin/online-users（在线用- online_users 表） =====================

export async function listOnlineUsers(
  query: PageQuery & { keyword?: string } = {},
): Promise<ApiResult<PageData<OnlineUserRow>>> {
  return fetchApi<PageData<OnlineUserRow>>(`/api/admin/online-users${buildQs(query)}`)
}

export async function forceLogoutOnlineUser(
  id: string,
): Promise<ApiResult<{ id: string; username: string; status: string; message: string }>> {
  return fetchApi<{ id: string; username: string; status: string; message: string }>(
    `/api/admin/online-users/${id}/force-logout`,
    { method: 'POST' },
  )
}
