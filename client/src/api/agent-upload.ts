/**
 * Agent 上传记录 API
 * 对接后端: app/api/v1/agent_upload.py
 * 路由前缀: /api/v1/agent-upload
 *
 * 后端列表响应为 { code, msg, data:[...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** Agent 上传记录 */
export interface AgentUpload {
  uid: number
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  mimeType?: string
  ext?: string
  agentId?: number
  agentName?: string
  bizType?: string
  createTime?: string | null
}

/** 上传记录入参 (后端使用 Query 参数) */
export interface AgentUploadRecordParams {
  fileName: string
  fileUrl: string
  fileType?: string
  fileSize?: number
  mimeType?: string
  ext?: string
  agentId?: number
  agentName?: string
  bizType?: string
}

/** 上传记录列表查询参数 */
export interface AgentUploadListParams {
  page: number
  limit: number
  agentId?: number
  bizType?: string
  fileType?: string
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
// Agent 上传记录
// ===========================================================================

/** 记录 Agent 上传 (后端使用 Query 参数, POST 空路径) */
export async function agentUploadRecord(params: AgentUploadRecordParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/agent-upload', null, {
    params: {
      file_name: params.fileName,
      file_url: params.fileUrl,
      file_type: params.fileType || undefined,
      file_size: params.fileSize,
      mime_type: params.mimeType || undefined,
      ext: params.ext || undefined,
      agent_id: params.agentId,
      agent_name: params.agentName || undefined,
      biz_type: params.bizType || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** Agent 上传记录列表 */
export async function agentUploadList(params: AgentUploadListParams): Promise<ApiResponse<PaginationResponse<AgentUpload>>> {
  const res = await http.get('/api/v1/agent-upload/list', {
    params: {
      page: params.page,
      limit: params.limit,
      agent_id: params.agentId,
      biz_type: params.bizType || undefined,
      file_type: params.fileType || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AgentUpload>>
}

/** 删除 Agent 上传记录 (Path 指定 uid) */
export async function agentUploadDelete(uid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/agent-upload/${uid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const agentUploadApi = {
  agentUploadRecord,
  agentUploadList,
  agentUploadDelete,
}

export default agentUploadApi