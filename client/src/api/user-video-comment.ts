/**
 * 用户视频评论 API
 * 对接后端: app/api/v1/user_video_comment/
 * 路由前缀: /api/v1/user-video-comment
 *
 * 后端列表响应为 { code, msg, data: [...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端新增评论接口使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 视频评论 */
export interface VideoComment {
  cid: number
  videoId: string | number
  pid?: number
  userId?: string | number
  content: string
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

/** 视频评论列表 */
export async function userVideoCommentList(params: {
  videoId: string | number
  page: number
  limit: number
}): Promise<ApiResponse<PaginationResponse<VideoComment>>> {
  const res = await http.get('/api/v1/user-video-comment/list', {
    params: {
      video_id: params.videoId,
      page: params.page,
      limit: params.limit,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<VideoComment>>
}

/** 新增视频评论 (后端使用 Query 参数, 空路径; content 为评论内容必填) */
export async function userVideoCommentAdd(params: {
  videoId: string | number
  content: string
  pid?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/user-video-comment', null, {
    params: {
      video_id: params.videoId,
      content: params.content,
      pid: params.pid ?? undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除视频评论 (cid 走路径参数) */
export async function userVideoCommentDelete(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/user-video-comment/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const userVideoCommentApi = {
  userVideoCommentList,
  userVideoCommentAdd,
  userVideoCommentDelete,
}

export default userVideoCommentApi
