/**
 * 签到体系 API (签到/签到记录)
 * 对接后端: app/api/v1/checkin/checkin.py
 * 路由前缀: /api/v1/checkin
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface CheckinListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  memberId?: string
  type?: string
  [k: string]: unknown
}

/** 签到 */
export interface Checkin {
  cid: number
  continuousNum: number
  memberId?: string
  createTime?: string | null
}

/** 签到记录 */
export interface CheckinRecord {
  rid: number
  type: string
  memberId?: string
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
// 签到
// ===========================================================================

/** 签到列表 */
export async function checkinList(params: CheckinListParams = {}): Promise<ApiResponse<PaginationResponse<Checkin>>> {
  const res = await http.get('/api/v1/checkin/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      memberId: params.memberId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<Checkin>>
}

/** 签到详情 (cid 走路径参数) */
export async function checkinDetail(cid: number): Promise<ApiResponse<Checkin | null>> {
  const res = await http.get(`/api/v1/checkin/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Checkin | null>
}

/** 创建签到 (memberId 由后端 Depends 注入,前端可选传) */
export async function checkinCreate(params: {
  continuousNum: number
  memberId?: string
}): Promise<ApiResponse<Checkin>> {
  const res = await http.post('/api/v1/checkin', null, {
    params: {
      continuousNum: params.continuousNum,
      memberId: params.memberId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Checkin>
}

/** 修改签到 (cid 走路径参数,其余走 Query) */
export async function checkinUpdate(cid: number, params: { continuousNum?: number }): Promise<ApiResponse<Checkin>> {
  const res = await http.put(`/api/v1/checkin/${cid}`, null, {
    params: {
      continuousNum: params.continuousNum,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Checkin>
}

/** 删除签到 (cid 走路径参数) */
export async function checkinDelete(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/checkin/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}
// ===========================================================================
// 签到记录
// ===========================================================================

/** 签到记录列表 */
export async function checkinRecordList(params: CheckinListParams = {}): Promise<ApiResponse<PaginationResponse<CheckinRecord>>> {
  const res = await http.get('/api/v1/checkin/record/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      memberId: params.memberId || undefined,
      type: params.type || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<CheckinRecord>>
}

/** 签到记录详情 (rid 走路径参数) */
export async function checkinRecordDetail(rid: number): Promise<ApiResponse<CheckinRecord | null>> {
  const res = await http.get(`/api/v1/checkin/record/${rid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<CheckinRecord | null>
}

/** 创建签到记录 */
export async function checkinRecordCreate(params: { type: string }): Promise<ApiResponse<CheckinRecord>> {
  const res = await http.post('/api/v1/checkin/record', null, {
    params: {
      type: params.type,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<CheckinRecord>
}

/** 修改签到记录 (rid 走路径参数,其余走 Query) */
export async function checkinRecordUpdate(rid: number, params: { type?: string }): Promise<ApiResponse<CheckinRecord>> {
  const res = await http.put(`/api/v1/checkin/record/${rid}`, null, {
    params: {
      type: params.type || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<CheckinRecord>
}

/** 删除签到记录 (rid 走路径参数) */
export async function checkinRecordDelete(rid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/checkin/record/${rid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const checkinApi = {
  checkinList,
  checkinDetail,
  checkinCreate,
  checkinUpdate,
  checkinDelete,
  checkinRecordList,
  checkinRecordDetail,
  checkinRecordCreate,
  checkinRecordUpdate,
  checkinRecordDelete,
}

export default checkinApi