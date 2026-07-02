/**
 * 用户评论日志 API
 * 对接后端: app/api/v1/user_comment_log/
 * 路由前缀: /api/v1/user-comment-log
 *
 * 后端列表响应为 { code, msg, data: [...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端 record 接口使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 评论日志 */
export interface CommentLog {
  id: number
  targetType: string
  targetId: string | number
  commentId: string | number
  action: string
  ip?: string
  userId?: string | number
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

/** 记录评论行为 (后端使用 Query 参数) */
export async function userCommentLogRecord(params: {
  targetType: string
  targetId: string | number
  commentId: string | number
  action: string
  ip?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/user-comment-log/record', null, {
    params: {
      target_type: params.targetType,
      target_id: params.targetId,
      comment_id: params.commentId,
      action: params.action,
      ip: params.ip || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 评论日志列表 */
export async function userCommentLogList(params: {
  page: number
  limit: number
  userId?: string | number
  targetType?: string
  action?: string
}): Promise<ApiResponse<PaginationResponse<CommentLog>>> {
  const res = await http.get('/api/v1/user-comment-log/list', {
    params: {
      page: params.page,
      limit: params.limit,
      user_id: params.userId || undefined,
      target_type: params.targetType || undefined,
      action: params.action || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<CommentLog>>
}

export const userCommentLogApi = {
  userCommentLogRecord,
  userCommentLogList,
}

export default userCommentLogApi
