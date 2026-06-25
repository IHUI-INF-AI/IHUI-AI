/**
 * 统一的API工具模块
 * 避免重复代码，提供公共API函数
 */

import { AUTH_PATHS, LOGIN_PWD_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'
import type { UserToken } from '../user/user'
import type { AuthResponse } from '../auth/auth'

// 统一登录 - 总管理端：POST /auth/login，body: username, password, code, uuid
export const unifiedLogin = withApiResponseHandler(
  async (data: {
    username?: string
    password?: string
    phone?: string
    code?: string
    type?: 'account' | 'phone'
    identifier?: string
    uuid?: string
  }): Promise<ApiResponse<UserToken | AuthResponse>> => {
    let endpoint: string = AUTH_PATHS.login
    let requestData: Record<string, unknown> = {
      username: data.username || data.phone || data.identifier,
      password: data.password,
      code: data.code ?? '',
      uuid: data.uuid ?? '',
    }

    if (data.type === 'phone' && data.phone && data.code) {
      endpoint = LOGIN_PWD_PATHS.smsVerify
      requestData = { phone: data.phone, code: data.code }
    }

    const response = await request.post<UserToken | AuthResponse>(endpoint, requestData, {
      headers: { 'platform-type': 'web' },
    })
    return normalizeApiResponse(response)
  }
)

// 统一的注册函数 - 连接到192.168.1.25:8080
// 根据Swagger文档，后端注册接口是 /login/pwd/registerLogin
export const unifiedRegister = withApiResponseHandler(
  async (data: {
    username: string
    password: string
    email: string
    phone?: string
    code?: string
    captcha?: string
    inviteCode?: string
  }): Promise<ApiResponse<UserToken | AuthResponse>> => {
    // 根据Swagger文档，使用 /login/pwd/registerLogin 接口
    // 构建请求数据，匹配后端接口要求
    const requestData: Record<string, unknown> = {
      username: data.username,
      password: data.password,
    }

    // 可选字段
    if (data.email) requestData.email = data.email
    if (data.phone) requestData.phone = data.phone
    if (data.code) requestData.code = data.code
    if (data.captcha) requestData.captcha = data.captcha
    if (data.inviteCode) requestData.inviteCode = data.inviteCode

    // 优先使用 /login/pwd/registerLogin
    try {
      const response = await request.post<UserToken | AuthResponse>(LOGIN_PWD_PATHS.registerLogin, requestData)
      return normalizeApiResponse(response)
    } catch (e) {
      logger.debug('[api-utils] registerLogin failed, trying fallback interface', e)
      // 如果失败，尝试使用 /api/auth/register
      const response = await request.post<UserToken | AuthResponse>(AUTH_PATHS.register, data)
      return normalizeApiResponse(response)
    }
  }
)

// 统一的登出函数（已移除 auth/logout 接口，直接返回成功）
export const unifiedLogout = withApiResponseHandler(async (): Promise<ApiResponse<boolean>> => {
  return { code: 200, success: true, message: 'ok', data: true, timestamp: Date.now() }
})

// 统一的刷新Token函数
export const unifiedRefreshToken = withApiResponseHandler(
  async (refreshToken: string): Promise<ApiResponse<UserToken>> => {
    const response = await request.post<UserToken>('/auth/refresh-token', { refreshToken })
    return normalizeApiResponse(response)
  }
)

// 统一的修改密码函数
export const unifiedChangePassword = withApiResponseHandler(
  async (data: { oldPassword: string; newPassword: string }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/change-password', data)
    return normalizeApiResponse(response)
  }
)

// 统一的发送消息函数
export const unifiedSendMessage = withApiResponseHandler(
  async (data: {
    content: string
    type?: string
    agentId?: string
    sessionId?: string
  }): Promise<ApiResponse<unknown>> => {
    const response = await request.post<unknown>('/message/send', data)
    return normalizeApiResponse(response)
  }
)

// 统一的用户VIP信息函数
export const unifiedGetUserVipInfo = withApiResponseHandler(
  async (): Promise<ApiResponse<unknown>> => {
    const response = await request.get<unknown>('/user/vip', {})
    return normalizeApiResponse(response)
  }
)

// 统一的开发者列表函数
export const unifiedGetDeveloperList = withApiResponseHandler(
  async (params?: {
    page?: number
    pageSize?: number
    status?: string
  }): Promise<ApiResponse<unknown>> => {
    const response = await request.get<unknown>('/developer/list', { params })
    return normalizeApiResponse(response)
  }
)

// 统一的用户身份设置函数
export const unifiedSetUserIdentity = withApiResponseHandler(
  async (data: {
    userId: string
    identity: string
    permissions?: string[]
  }): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/identity', data)
    return normalizeApiResponse(response)
  }
)
