/**
 * 定时任务日志管理 API
 * 对接后端: app/api/v1/admin_panel.py (job_log_router)
 * 路由前缀: /api/v1/job/log
 *
 * 后端模型已存在: SysJobLog(AdminJobLog) (server/app/models/sys_models.py)
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface JobLogListParams {
  current?: number
  size?: number
  keyword?: string
  jobGroup?: string
  status?: string
  [k: string]: unknown
}

export interface AdminJobLog {
  /** 任务日志ID */
  jobLogId: number
  /** 任务名称 */
  jobName: string
  /** 任务组名 */
  jobGroup?: string
  /** 调用目标字符串 */
  invokeTarget?: string
  /** 日志信息 */
  jobMessage?: string
  /** 执行状态 (0=成功 1=失败) */
  status: string
  /** 创建时间 */
  createTime?: string | null
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

/** 任务执行日志列表 (分页) */
export async function jobLogList(params: JobLogListParams = {}): Promise<ApiResponse<{ records: AdminJobLog[]; total: number }>> {
  const res = await http.get('/api/v1/job/log/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      jobName: params.keyword || undefined,
      jobGroup: params.jobGroup || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: AdminJobLog[]; total: number }>
}

/** 任务日志详情 */
export async function jobLogDetail(jobLogId: number): Promise<ApiResponse<AdminJobLog | null>> {
  const res = await http.get(`/api/v1/job/log/${jobLogId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminJobLog | null>
}

/** 删除任务日志 (批量, 逗号分隔) */
export async function jobLogDelete(jobLogIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/job/log/${jobLogIds.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 清空所有任务日志 */
export async function jobLogClean(): Promise<ApiResponse<unknown>> {
  const res = await http.delete('/api/v1/job/log/clean')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 导出任务日志 (返回文件流) */
export async function jobLogExport(params: JobLogListParams = {}): Promise<Blob> {
  const res = await http.get('/api/v1/job/log/export', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      jobName: params.keyword || undefined,
      jobGroup: params.jobGroup || undefined,
      status: params.status || undefined,
    },
    responseType: 'blob',
  })
  return res as unknown as Blob
}

export const adminJobLogApi = {
  jobLogList,
  jobLogDetail,
  jobLogDelete,
  jobLogClean,
  jobLogExport,
}

export default adminJobLogApi
