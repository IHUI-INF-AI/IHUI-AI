/**
 * 用户视频日志 API
 * 对接后端: app/api/v1/user_video_log/
 * 路由前缀: /api/v1/user-video-log
 *
 * 后端列表响应为 { code, msg, data: [...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端 record 接口使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 视频日志 */
export interface VideoLog {
  id: number
  videoId: string | number
  duration: number
  userId?: string | number
  createTime?: string | null
}

/** 视频日志统计 */
export interface VideoLogStats {
  totalViews?: number
  totalDuration?: number
  uniqueViewers?: number
}

// 统一构造 ApiResponse<{records, total}> 格式
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

/** 记录视频观看 (后端使用 Query 参数) */
export async function userVideoLogRecord(params: { videoId: string | number; duration: number }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/user-video-log/record', null, {
    params: {
      video_id: params.videoId,
      duration: params.duration,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 视频日志列表 */
export async function userVideoLogList(params: { page: number; limit: number }): Promise<ApiResponse<PaginationResponse<VideoLog>>> {
  const res = await http.get('/api/v1/user-video-log/list', {
    params: { page: params.page, limit: params.limit },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<VideoLog>>
}

/** 视频日志统计 */
export async function userVideoLogStats(): Promise<ApiResponse<VideoLogStats | null>> {
  const res = await http.get('/api/v1/user-video-log/stats')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<VideoLogStats | null>
}

export const userVideoLogApi = {
  userVideoLogRecord,
  userVideoLogList,
  userVideoLogStats,
}

export default userVideoLogApi
