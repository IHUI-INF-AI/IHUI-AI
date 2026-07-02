/**
 * 视频预读 API
 * 对接后端: app/api/v1/video_preload/video_preload.py
 * 路由前缀: /api/v1/video-preload
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 视频预读记录 */
export interface VideoPreload {
  pid: number
  videoId: number
  startTime: number
  endTime: number
  status: number
  createTime?: string | null
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

// ===========================================================================
// 视频预读
// ===========================================================================

/** 创建预读任务 (后端使用 Query 参数) */
export async function videoPreloadCreate(params: {
  videoId: number
  startTime: number
  endTime: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/video-preload', null, {
    params: {
      video_id: params.videoId,
      start_time: params.startTime,
      end_time: params.endTime,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 预读任务列表 */
export async function videoPreloadList(params: {
  page?: number
  limit?: number
  videoId?: number
}): Promise<ApiResponse<PaginationResponse<VideoPreload>>> {
  const res = await http.get('/api/v1/video-preload/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      video_id: params.videoId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<VideoPreload>>
}

/** 标记预读完成 */
export async function videoPreloadMarkComplete(pid: number): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/video-preload/${pid}/complete`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除预读任务 */
export async function videoPreloadDelete(pid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/video-preload/${pid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const videoPreloadApi = {
  videoPreloadCreate,
  videoPreloadList,
  videoPreloadMarkComplete,
  videoPreloadDelete,
}

export default videoPreloadApi