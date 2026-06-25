import { AUTH_PATHS } from '@/config/backend-paths'
import { request } from '@/utils/request'

export interface OAuth2LoginRequest {
  username: string
  password: string
  grant_type?: string
}

export interface OAuth2TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export interface OAuth2LoginResponse {
  code: number
  msg: string
  data?: OAuth2TokenResponse
}

export interface CaptchaResponse {
  code: number
  msg: string
  data?: {
    captchaId?: string
    captchaImage?: string
  }
}

export interface LoginWithCaptchaRequest {
  username: string
  password: string
  captcha: string
  captchaId?: string
}

export const oauth2Login = async (data: OAuth2LoginRequest): Promise<OAuth2LoginResponse> => {
  const formData = new URLSearchParams()
  formData.append('grant_type', data.grant_type || 'password')
  formData.append('username', data.username)
  formData.append('password', data.password)

  return request.post('/auth/oauth/token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
}

export const loginWithCaptcha = async (data: LoginWithCaptchaRequest): Promise<OAuth2LoginResponse> => {
  return request.post('/auth/login', data)
}

export const getCaptcha = async (): Promise<CaptchaResponse> => {
  // ⚠️ 重要：使用 /code 接口获取验证码（不需要 token）
  // /api/code 会被代理到 Python 后端 /prod-api/code
  return request.get(AUTH_PATHS.code)
}

/**
 * 刷新Token
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `refreshToken` 函数
 */
export const refreshToken = async (refreshToken: string): Promise<OAuth2LoginResponse> => {
  const formData = new URLSearchParams()
  formData.append('grant_type', 'refresh_token')
  formData.append('refresh_token', refreshToken)

  return request.post('/auth/oauth/token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
}

/**
 * 用户登出
 * 已移除 auth/logout 接口
 * @deprecated 请使用 `@/api/services/auth.service` 中的 `logout` 函数
 */
export const logout = async (): Promise<{ code: number; msg: string }> => {
  return { code: 200, msg: 'ok' }
}
