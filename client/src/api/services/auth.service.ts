/**
 * 认证服务
 * 使用统一的 API 客户端
 */
import { apiClient } from '../client'
import request from '@/utils/request'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/apiResponseHandler'
import { t } from '@/utils/i18n'

export interface LoginRequest {
  phone: string
  code: string
}

export interface LoginResponse {
  token: {
    accessToken: string
    refreshToken?: string
    expiresIn: number
    tokenType: 'Bearer'
  }
  user: {
    uuid: string
    username: string
    nickname: string
    avatar?: string
    phone?: string
    email?: string
    roles?: string[]
    [key: string]: any
  }
}

/**
 * 发送验证码
 */
export async function sendCode(phone: string): Promise<ApiResponse<void>> {
  try {
    const response = await request.post('/auth/send-code', { phone })
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.sendCodeFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 验证码登录
 */
export async function loginByCode(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  try {
    const response = await request.post<LoginResponse>('/auth/login-by-code', data)
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.loginFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 密码登录
 */
export async function loginByPassword(username: string, password: string): Promise<ApiResponse<LoginResponse>> {
  try {
    const response = await request.post<LoginResponse>('/auth/login-by-password', { username, password })
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.loginFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 刷新Token
 */
export async function refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken?: string }>> {
  try {
    const response = await request.post('/auth/refresh-token', { refreshToken })
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.refreshTokenFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 登出
 */
export async function logout(): Promise<ApiResponse<void>> {
  try {
    apiClient.clearToken()
  } catch (e) {
    logger.debug('[auth.service] ' + t('common.errors.logoutFailed'), e)
  }
  return { code: 200, success: true, message: 'success', data: undefined, timestamp: Date.now() }
}

/**
 * 获取用户信息
 */
export async function getUserInfo(): Promise<ApiResponse<LoginResponse['user']>> {
  try {
    const response = await request.get<LoginResponse['user']>('/auth/user-info')
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.getUserInfoFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 第三方绑定
 */
export async function bindThirdParty(provider: string, code: string): Promise<ApiResponse<void>> {
  try {
    const response = await request.post('/auth/bind-third-party', { provider, code })
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.thirdPartyBindFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

// ========== 补充缺失的导出函数 ==========

export interface RegisterRequest {
  username: string
  password: string
  phone?: string
  email?: string
  code?: string
  inviteCode?: string
}

export interface AuthToken {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  tokenType?: string
}

/**
 * 用户注册
 */
export async function register(data: RegisterRequest): Promise<ApiResponse<LoginResponse>> {
  try {
    const response = await request.post<LoginResponse>('/auth/register', data)
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.registerFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 发送验证码（别名）
 */
export { sendCode as sendVerificationCode }

/**
 * 重置密码
 */
export async function resetPassword(phone: string, code: string, newPassword: string): Promise<ApiResponse<void>> {
  try {
    const response = await request.post('/auth/reset-password', { phone, code, newPassword })
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.resetPasswordFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 验证Token有效性
 */
export async function verifyToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
  try {
    const response = await request.post('/auth/verify-token', { token })
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.verifyTokenFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}

/**
 * 统一登录接口（自动选择验证码或密码登录）
 */
export async function login(username: string, passwordOrCode: string, loginType: 'password' | 'code' = 'password'): Promise<ApiResponse<LoginResponse>> {
  if (loginType === 'code') {
    return loginByCode({ phone: username, code: passwordOrCode })
  }
  return loginByPassword(username, passwordOrCode)
}

/**
 * 获取图形验证码（用于getCaptcha）
 */
export async function getCaptcha(): Promise<ApiResponse<{ captchaId: string; captchaImage: string }>> {
  try {
    const response = await request.get('/auth/captcha')
    return normalizeApiResponse(response)
  } catch (error) {
    logger.error('[auth.service] ' + t('common.errors.getCaptchaFailed'), error)
    return { code: 500, success: false, message: String(error), data: undefined, timestamp: Date.now() }
  }
}
