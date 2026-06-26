/**
 * 在线用户管理 API
 * 后端模型已存在: SysUser, SysLoginInfo(AdminLogininfor) (server/app/models/sys_models.py)
 *
 * 注意: 后端 audit 模块暂未提供在线用户接口, 本文件使用占位端点
 * /api/v1/system/audit/online/*, 待后端补充真实接口后替换。
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface OnlineListParams {
  current?: number
  size?: number
  keyword?: string
  [k: string]: unknown
}

export interface OnlineItem {
  /** 会话/Token ID */
  token_id: string
  /** 用户 ID */
  user_id: number | string
  /** 用户名 */
  user_name: string
  /** 登录 IP */
  ipaddr?: string
  /** 登录时间 */
  login_time?: string | null
  /** 浏览器 */
  browser?: string
  /** 操作系统 */
  os?: string
  /** 登录地点 */
  login_location?: string
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

export async function onlineList(params: OnlineListParams = {}): Promise<ApiResponse<{ records: OnlineItem[]; total: number }>> {
  const res = await http.get('/api/v1/system/audit/online/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      user_name: params.keyword || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: OnlineItem[]; total: number }>
}

/** 强制下线 */
export async function onlineForceLogout(tokenId: string): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/system/audit/online/${tokenId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 批量强制下线 */
export async function onlineBatchForceLogout(tokenIds: string[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete('/api/v1/system/audit/online/batch', { params: { tokens: tokenIds.join(',') } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const onlineApi = {
  onlineList,
  onlineForceLogout,
  onlineBatchForceLogout,
}

export default onlineApi
