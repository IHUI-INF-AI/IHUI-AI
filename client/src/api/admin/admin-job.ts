/**
 * 定时任务管理 API
 * 后端模型已存在: SysJob(AdminJob), SysJobLog(AdminJobLog) (server/app/models/sys_models.py)
 *
 * 注意: 后端 audit 模块暂未提供定时任务接口, 本文件使用占位端点
 * /api/v1/system/audit/job/*, 待后端补充真实接口后替换。
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface JobListParams {
  current?: number
  size?: number
  keyword?: string
  jobGroup?: string
  status?: string
  [k: string]: unknown
}

export interface JobItem {
  job_id: number
  job_name: string
  job_group: string
  invoke_target: string
  cron_expression: string
  misfire_policy: string
  concurrent: string
  status: string
  create_time?: string | null
  next_time?: string | null
}

export interface JobLogItem {
  job_log_id: number
  job_name: string
  job_group?: string
  invoke_target?: string
  job_message?: string
  status: string
  exception_info?: string
  create_time?: string | null
  cost_time?: number
}

function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 定时任务
// ===========================================================================

export async function jobList(params: JobListParams = {}): Promise<ApiResponse<{ records: JobItem[]; total: number }>> {
  const res = await http.get('/api/v1/system/audit/job/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      job_name: params.keyword || undefined,
      job_group: params.jobGroup || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: JobItem[]; total: number }>
}

export async function jobCreate(payload: Partial<JobItem>): Promise<ApiResponse<JobItem>> {
  const res = await http.post('/api/v1/system/audit/job', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<JobItem>
}

export async function jobUpdate(payload: Partial<JobItem> & { job_id: number }): Promise<ApiResponse<JobItem>> {
  const res = await http.put('/api/v1/system/audit/job', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<JobItem>
}

export async function jobDelete(ids: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/system/audit/job/${ids.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 改变任务状态 (0=正常 1=暂停) */
export async function jobChangeStatus(jobId: number, status: string): Promise<ApiResponse<unknown>> {
  const res = await http.put('/api/v1/system/audit/job/change-status', { job_id: jobId, status })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 立即执行一次 */
export async function jobRunOnce(jobId: number): Promise<ApiResponse<unknown>> {
  const res = await http.post(`/api/v1/system/audit/job/run/${jobId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 定时任务日志
// ===========================================================================

export async function jobLogList(params: JobListParams = {}): Promise<ApiResponse<{ records: JobLogItem[]; total: number }>> {
  const res = await http.get('/api/v1/system/audit/job/log/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      job_name: params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: JobLogItem[]; total: number }>
}

export async function jobLogClean(days = 90): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/system/audit/job/log/clean', null, { params: { days } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const jobApi = {
  jobList,
  jobCreate,
  jobUpdate,
  jobDelete,
  jobChangeStatus,
  jobRunOnce,
  jobLogList,
  jobLogClean,
}

export default jobApi
