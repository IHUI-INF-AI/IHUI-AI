import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 登录设备信息
export interface LoginDevice {
  id: string
  deviceId: string
  deviceName: string
  deviceType: 'web' | 'mobile' | 'tablet' | 'desktop'
  browser?: string
  os?: string
  ip: string
  location: string
  lastLoginTime: string
  isCurrent: boolean
  isTrusted: boolean
}

// 登录历史记录
export interface LoginHistory {
  id: string
  deviceId: string
  deviceName: string
  ip: string
  location: string
  loginTime: string
  logoutTime?: string
  status: 'success' | 'failed'
  failureReason?: string
}

// 会话信息
export interface SessionInfo {
  id: string
  deviceId: string
  deviceName: string
  ip: string
  location: string
  loginTime: string
  lastActiveTime: string
  expiresAt: string
  isCurrent: boolean
}

// 获取登录设备列表
export const getLoginDevices = withApiResponseHandler(
  async (): Promise<ApiResponse<LoginDevice[]>> => {
    const response = await request.get<LoginDevice[]>('/security/devices')
    return normalizeApiResponse(response)
  }
)

// 移除登录设备
export const removeLoginDevice = withApiResponseHandler(
  async (deviceId: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>(`/security/devices/${deviceId}/remove`)
    return normalizeApiResponse(response)
  }
)

// 标记设备为信任
export const trustDevice = withApiResponseHandler(
  async (deviceId: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>(`/security/devices/${deviceId}/trust`)
    return normalizeApiResponse(response)
  }
)

// 获取登录历史
export const getLoginHistory = withApiResponseHandler(
  async (params?: {
    page?: number
    pageSize?: number
    deviceId?: string
  }): Promise<ApiResponse<{ list: LoginHistory[]; total: number }>> => {
    const response = await request.get<{ list: LoginHistory[]; total: number }>(
      '/security/login-history',
      { params }
    )
    return normalizeApiResponse(response)
  }
)

// 获取所有会话
export const getSessions = withApiResponseHandler(async (): Promise<ApiResponse<SessionInfo[]>> => {
  const response = await request.get<SessionInfo[]>('/security/sessions')
  return normalizeApiResponse(response)
})

// 终止指定会话
export const terminateSession = withApiResponseHandler(
  async (sessionId: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>(`/security/sessions/${sessionId}/terminate`)
    return normalizeApiResponse(response)
  }
)

// 终止所有其他会话
export const terminateAllOtherSessions = withApiResponseHandler(
  async (): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/sessions/terminate-all')
    return normalizeApiResponse(response)
  }
)

// 验证邮箱
export const verifyEmail = withApiResponseHandler(
  async (data: { email: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/verify-email', data)
    return normalizeApiResponse(response)
  }
)

// 验证手机号
export const verifyPhone = withApiResponseHandler(
  async (data: { phone: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/verify-phone', data)
    return normalizeApiResponse(response)
  }
)

// 绑定邮箱
export const bindEmail = withApiResponseHandler(
  async (data: { email: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/bind-email', data)
    return normalizeApiResponse(response)
  }
)

// 解绑邮箱
export const unbindEmail = withApiResponseHandler(
  async (data: { password: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/unbind-email', data)
    return normalizeApiResponse(response)
  }
)

// 绑定手机号
export const bindPhone = withApiResponseHandler(
  async (data: { phone: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/bind-phone', data)
    return normalizeApiResponse(response)
  }
)

// 解绑手机号
export const unbindPhone = withApiResponseHandler(
  async (data: { password: string; code: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/security/unbind-phone', data)
    return normalizeApiResponse(response)
  }
)
