/**
 * 实名认证 API
 * 对接后端: app/api/v1/auth_identity/auth_identity.py
 * 路由前缀: /api/v1/auth-identity
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 submit/audit 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface AuthIdentityListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  [k: string]: unknown
}

/** 实名认证 */
export interface AuthIdentity {
  aid: number
  realName: string
  idCard: string // 脱敏
  phone?: string
  idCardFront?: string
  idCardBack?: string
  type?: string
  status: string
  remark?: string
  expireDays?: number
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
// 实名认证
// ===========================================================================

/** 提交实名认证 */
export async function authIdentitySubmit(params: {
  realName: string
  idCard: string
  phone?: string
  idCardFront?: string
  idCardBack?: string
  type?: string
}): Promise<ApiResponse<AuthIdentity>> {
  const res = await http.post('/api/v1/auth-identity', null, {
    params: {
      realName: params.realName,
      idCard: params.idCard,
      phone: params.phone || undefined,
      idCardFront: params.idCardFront || undefined,
      idCardBack: params.idCardBack || undefined,
      type: params.type || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AuthIdentity>
}

/** 我的实名认证 */
export async function authIdentityMy(): Promise<ApiResponse<AuthIdentity | null>> {
  const res = await http.get('/api/v1/auth-identity/my')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AuthIdentity | null>
}

/** 实名认证列表 */
export async function authIdentityList(params: AuthIdentityListParams = {}): Promise<ApiResponse<PaginationResponse<AuthIdentity>>> {
  const res = await http.get('/api/v1/auth-identity/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AuthIdentity>>
}

/** 审核实名认证 (aid 走路径参数,其余走 Query) */
export async function authIdentityAudit(aid: number, params: { status: string; remark?: string; expireDays?: number }): Promise<ApiResponse<AuthIdentity>> {
  const res = await http.put(`/api/v1/auth-identity/${aid}`, null, {
    params: {
      status: params.status,
      remark: params.remark || undefined,
      expireDays: params.expireDays,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AuthIdentity>
}

export const authIdentityApi = {
  authIdentitySubmit,
  authIdentityMy,
  authIdentityList,
  authIdentityAudit,
}

export default authIdentityApi