import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

// =============================================================================
// 认证核心类型
// =============================================================================

export interface AuthUser {
  id: string
  phone: string
  email: string
  nickname: string
  avatar: string
  bio: string
  roleId: number
  status: number
  permissions: string[]
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: AuthUser
}

export type SmsScene = 'register' | 'login' | 'reset' | 'phone-binding'

// =============================================================================
// 登录(3 种方式 + 别名兼容)
// =============================================================================

/** 账号密码登录(手机号/邮箱/用户名) — POST /auth/login */
export async function loginByAccount(
  account: string,
  password: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  })
}

/** 手机号密码登录(小程序别名) — POST /auth/login/password */
export async function loginByPhone(
  phone: string,
  password: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/password', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
}

/** 手机号验证码登录 — POST /auth/login/sms */
export async function loginBySms(phone: string, code: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/sms', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

/** 微信登录 — POST /auth/login/wechat(需配置 WECHAT_APPID/SECRET) */
export async function loginByWechat(code: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/wechat', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

// =============================================================================
// 注册 / 登出 / 刷新 / 验证码
// =============================================================================

/** 手机号注册 — POST /auth/register */
export async function register(
  phone: string,
  password: string,
  code?: string,
  invitationCode?: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone, password, code, invitationCode }),
  })
}

/** 登出(吊销 refreshToken) — POST /auth/logout */
export async function logout(refreshToken: string): Promise<ApiResult<{ revoked: boolean }>> {
  return fetchApi<{ revoked: boolean }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

/** 刷新 accessToken — POST /auth/refresh */
export async function refreshAccessToken(refreshToken: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

/** 发送短信验证码 — POST /auth/sms/send */
export async function sendSmsCode(
  phone: string,
  scene: SmsScene = 'login',
): Promise<ApiResult<{ sent: boolean; expiresIn?: number; code?: string }>> {
  return fetchApi<{ sent: boolean; expiresIn?: number; code?: string }>('/api/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, scene }),
  })
}

/** 获取当前用户信息 — GET /auth/me */
export async function getMe(): Promise<ApiResult<{ user: AuthUser }>> {
  return fetchApi<{ user: AuthUser }>('/api/auth/me', {
    method: 'GET',
  })
}

// =============================================================================
// 换绑手机(已有功能)
// =============================================================================

export async function sendChangePhoneOldCode(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/send-old-code', {
    method: 'POST',
  })
}

export async function verifyChangePhoneOldCode(
  code: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/verify-old-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function sendChangePhoneNewCode(
  phone: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/send-new-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function changePhone(
  phone: string,
  code: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/confirm', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}
