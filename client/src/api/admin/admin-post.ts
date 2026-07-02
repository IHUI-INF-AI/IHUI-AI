/**
 * 岗位管理 API
 * 对接后端: app/api/v1/admin_panel.py (post_router, prefix=/post)
 * 路由前缀: /api/v1/post
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface PostListParams {
  current?: number
  size?: number
  keyword?: string
  postCode?: string
  postName?: string
  status?: string
  [k: string]: unknown
}

export interface AdminPost {
  /** 岗位 ID */
  postId: number
  /** 岗位编码 */
  postCode: string
  /** 岗位名称 */
  postName: string
  /** 显示顺序 */
  postSort: number
  /** 状态 (0=正常 1=停用) */
  status: string
  /** 备注 */
  remark?: string
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

// ===========================================================================
// 岗位 CRUD
// ===========================================================================

/** 岗位列表 (分页) */
export async function postList(params: PostListParams = {}): Promise<ApiResponse<{ records: AdminPost[]; total: number }>> {
  const res = await http.get('/api/v1/post/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      postCode: params.postCode || undefined,
      postName: params.postName || params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: AdminPost[]; total: number }>
}

/** 岗位详情 */
export async function postDetail(postId: number): Promise<ApiResponse<AdminPost | null>> {
  const res = await http.get(`/api/v1/post/${postId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminPost | null>
}

/** 新增岗位 */
export async function postCreate(payload: Partial<AdminPost>): Promise<ApiResponse<AdminPost>> {
  const res = await http.post('/api/v1/post', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminPost>
}

/** 修改岗位 */
export async function postUpdate(payload: Partial<AdminPost> & { postId: number }): Promise<ApiResponse<AdminPost>> {
  const res = await http.put('/api/v1/post', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminPost>
}

/** 删除岗位 (批量, 逗号分隔) */
export async function postDelete(postIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/post/${postIds.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 全部岗位 (下拉选择用, 不分页) */
export async function postListAll(): Promise<ApiResponse<AdminPost[]>> {
  const res = await http.get('/api/v1/post/optionselect')
  const body = (res as any).data || {}
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<AdminPost[]>
}

export const adminPostApi = {
  postList,
  postDetail,
  postCreate,
  postUpdate,
  postDelete,
  postListAll,
}

export default adminPostApi
