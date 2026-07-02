/**
 * 用户 Agent 图片交互 API
 * 对接后端: app/api/v1/user_agent_image/user_agent_image.py
 * 路由前缀: /api/v1/user-agent-image
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 用户图片交互记录 */
export interface UserAgentImage {
  iid: number
  imageUrl: string
  imageType: string
  agentId?: string | null
  userId?: string | null
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
// 图片交互
// ===========================================================================

/** 记录图片交互 (后端使用 Query 参数) */
export async function userAgentImageCreate(params: {
  imageUrl: string
  imageType: string
  agentId?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/user-agent-image', null, {
    params: {
      image_url: params.imageUrl,
      image_type: params.imageType,
      agent_id: params.agentId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 图片交互列表 */
export async function userAgentImageList(params: {
  page?: number
  limit?: number
  imageType?: string
}): Promise<ApiResponse<PaginationResponse<UserAgentImage>>> {
  const res = await http.get('/api/v1/user-agent-image/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      image_type: params.imageType || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<UserAgentImage>>
}

/** 图片详情 */
export async function userAgentImageDetail(iid: number): Promise<ApiResponse<UserAgentImage | null>> {
  const res = await http.get(`/api/v1/user-agent-image/${iid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<UserAgentImage | null>
}

/** 删除图片记录 */
export async function userAgentImageDelete(iid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/user-agent-image/${iid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const userAgentImageApi = {
  userAgentImageCreate,
  userAgentImageList,
  userAgentImageDetail,
  userAgentImageDelete,
}

export default userAgentImageApi