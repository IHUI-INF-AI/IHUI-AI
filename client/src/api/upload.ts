/**
 * 文件上传 API (分片上传 / 文件 CRUD / 分享)
 * 对接后端: app/api/v1/upload (含 init/chunk/complete/single/files/share 等)
 * 路由前缀: /api/v1/upload
 *
 * 后端列表响应为 { code, msg, data:[...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 分片上传初始化参数 (Body) */
export interface UploadInit {
  uploadId: string
  fileId: string
  fileName: string
  fileSize: number
  totalChunks: number
  userId?: string
}

/** 上传文件信息 */
export interface UploadFile {
  fileId: string
  fileName: string
  fileSize: number
  userId: string
  createTime?: string | null
}

/** 分享信息 */
export interface ShareInfo {
  shareId: string
  fileId: string
  password?: string
  maxDownloads?: number
  expiresIn?: number
  createTime?: string | null
}

/** 创建分享入参 (Body) */
export interface CreateShareParams {
  fileId: string
  password?: string
  maxDownloads?: number
  expiresIn?: number
}

/** 文件列表查询参数 */
export interface UploadListFilesParams {
  userId?: string
  limit?: number
  offset?: number
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
// 分片上传
// ===========================================================================

/** 初始化分片上传 (Body) */
export async function uploadInit(data: UploadInit): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/upload/init', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 上传分片 (Form + File, formData 含 uploadId/chunkIndex/chunk 文件) */
export async function uploadChunk(formData: FormData): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/upload/chunk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 确认分片上传 (Form) */
export async function uploadConfirmChunk(formData: FormData): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/upload/chunk/confirm', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 完成分片上传 (Form) */
export async function uploadComplete(formData: FormData): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/upload/complete', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 单文件直传 (File) */
export async function uploadSingle(formData: FormData): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/upload/single', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}
// ===========================================================================
// 文件 CRUD
// ===========================================================================

/** 文件列表 (Query) */
export async function uploadListFiles(params: UploadListFilesParams = {}): Promise<ApiResponse<PaginationResponse<UploadFile>>> {
  const res = await http.get('/api/v1/upload/files', {
    params: {
      user_id: params.userId || undefined,
      limit: params.limit,
      offset: params.offset,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<UploadFile>>
}

/** 获取文件 (返回二进制流/Blob) */
export async function uploadGetFile(fileId: string): Promise<Blob> {
  const res = await http.get(`/api/v1/upload/file/${fileId}`, {
    responseType: 'blob',
  })
  return res as unknown as Blob
}

/** 删除文件 (Path 指定 fileId) */
export async function uploadDeleteFile(fileId: string): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/upload/file/${fileId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 分享功能
// ===========================================================================

/** 创建分享 (Body) */
export async function uploadCreateShare(data: CreateShareParams): Promise<ApiResponse<ShareInfo>> {
  const res = await http.post('/api/v1/upload/share', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ShareInfo>
}

/** 获取分享信息 (Path 指定 shareId) */
export async function uploadGetShareInfo(shareId: string): Promise<ApiResponse<ShareInfo>> {
  const res = await http.get(`/api/v1/upload/share/${shareId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ShareInfo>
}

/** 下载分享文件 (Path 指定 shareId, Form 传参如密码等) */
export async function uploadDownloadSharedFile(shareId: string, formData: FormData): Promise<Blob> {
  const res = await http.post(`/api/v1/upload/share/${shareId}/download`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  })
  return res as unknown as Blob
}

/** 删除分享 (Path 指定 shareId) */
export async function uploadDeleteShare(shareId: string): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/upload/share/${shareId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 分享列表 (Query) */
export async function uploadListShares(params: { userId?: string } = {}): Promise<ApiResponse<ShareInfo[]>> {
  const res = await http.get('/api/v1/upload/shares', {
    params: {
      user_id: params.userId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ShareInfo[]>
}

export const uploadApi = {
  uploadInit,
  uploadChunk,
  uploadConfirmChunk,
  uploadComplete,
  uploadSingle,
  uploadListFiles,
  uploadGetFile,
  uploadDeleteFile,
  uploadCreateShare,
  uploadGetShareInfo,
  uploadDownloadSharedFile,
  uploadDeleteShare,
  uploadListShares,
}

export default uploadApi