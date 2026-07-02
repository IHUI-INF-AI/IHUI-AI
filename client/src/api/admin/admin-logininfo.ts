/**
 * 登录日志管理 API
 * 对接后端: app/api/v1/admin_panel.py (logininfo_router)
 * 路由前缀: /api/v1/logininfor
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface LoginInfoListParams {
  current?: number
  size?: number
  keyword?: string
  userName?: string
  status?: string
  [k: string]: unknown
}

export interface AdminLoginInfo {
  /** 访问ID */
  infoId: number
  /** 用户账号 */
  userName: string
  /** 登录IP地址 */
  ipaddr?: string
  /** 登录地点 */
  loginLocation?: string
  /** 浏览器类型 */
  browser?: string
  /** 操作系统 */
  os?: string
  /** 状态 (0=成功 其他=失败) */
  status: string
  /** 提示消息 */
  msg?: string
  /** 登录时间 */
  loginTime?: string | null
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

/** 登录日志列表 (分页) */
export async function loginInfoList(params: LoginInfoListParams = {}): Promise<ApiResponse<{ records: AdminLoginInfo[]; total: number }>> {
  const res = await http.get('/api/v1/logininfor/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      userName: params.keyword || params.userName || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: AdminLoginInfo[]; total: number }>
}

/** 删除登录日志 (批量, 逗号分隔) */
export async function loginInfoDelete(ids: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/logininfor/${ids.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 解锁用户账号 (按用户名, 对应后端 PUT /logininfor/unlock/{userName}) */
export async function loginInfoUnlock(userName: string): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/logininfor/unlock/${userName}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 清空所有登录日志 */
export async function loginInfoClean(): Promise<ApiResponse<unknown>> {
  const res = await http.delete('/api/v1/logininfor/clean')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 导出登录日志 (返回文件流) */
export async function loginInfoExport(params: LoginInfoListParams = {}): Promise<Blob> {
  const res = await http.get('/api/v1/logininfor/export', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      userName: params.keyword || params.userName || undefined,
      status: params.status || undefined,
    },
    responseType: 'blob',
  })
  return res as unknown as Blob
}

export const adminLoginInfoApi = {
  loginInfoList,
  loginInfoDelete,
  loginInfoUnlock,
  loginInfoClean,
  loginInfoExport,
}

export default adminLoginInfoApi
