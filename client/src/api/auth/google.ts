/**
 * Google 登录认证 API
 * 对接后端: auth/google 模块
 * 路由前缀: /api/v1/auth/google
 *
 * 注意: 后端接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface GoogleAuthResult {
  token: string
  refreshToken: string
  userInfo?: unknown
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
// Google 认证
// ===========================================================================

/** PC 端微信扫码授权码 (后端使用 Query 参数) */
export async function googleAuthPcWxCode(code: string): Promise<ApiResponse<GoogleAuthResult | null>> {
  const res = await http.get('/api/v1/auth/google/pc/wxCode', {
    params: { code },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<GoogleAuthResult | null>
}

/** Android 端微信授权码 (后端使用 Query 参数) */
export async function googleAuthAndroidWxCode(idToken: string): Promise<ApiResponse<GoogleAuthResult | null>> {
  const res = await http.get('/api/v1/auth/google/android/wxCode', {
    params: { idToken },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<GoogleAuthResult | null>
}

/** 获取 Google 认证配置状态 */
export async function googleAuthConfigStatus(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/auth/google/config')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const googleAuthApi = {
  googleAuthPcWxCode,
  googleAuthAndroidWxCode,
  googleAuthConfigStatus,
}

export default googleAuthApi