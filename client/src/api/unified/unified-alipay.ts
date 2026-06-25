/**
 * 支付宝登录 API
 * 
 * @description 提供支付宝二维码登录和状态检查功能
 * @packageDocumentation
 */

import request from '@/utils/request'
import { t } from '@/utils/i18n'
import { normalizeApiResponse } from '@/utils/api-response'
import { withApiResponseHandler } from '../../utils/apiResponseHandler'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types/api'

/**
 * 支付宝二维码登录响应
 */
export interface AlipayQrCodeResponse {
  /** 二维码图片 Base64 */
  qrCode: string
  /** 二维码跳转链接 */
  qrCodeUrl?: string
  /** 会话 ID，用于轮询状态 */
  sessionId: string
  /** 二维码过期时间（秒） */
  expiresIn: number
}

/**
 * 支付宝二维码状态响应
 */
export interface AlipayQrStatusResponse {
  /** 状态：pending-等待扫码, scanned-已扫码, confirmed-已确认, expired-已过期, error-错误 */
  status: 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error'
  /** 登录成功后返回的 token */
  token?: string
  /** 刷新 token */
  refreshToken?: string
  /** 用户信息 */
  user?: {
    id: string
    uuid: string
    username: string
    nickname?: string
    avatar?: string
    phone?: string
    alipayUserId?: string
  }
  /** 错误或提示消息 */
  message?: string
}

/**
 * 支付宝授权码登录响应
 */
export interface AlipayAuthCodeResponse {
  /** 登录成功后返回的 token */
  token: string
  /** 刷新 token */
  refreshToken?: string
  /** 用户信息 */
  user: {
    id: string
    uuid: string
    username: string
    nickname?: string
    avatar?: string
    phone?: string
    alipayUserId?: string
  }
}

/**
 * 生成支付宝二维码（登录用）
 * 
 * @description 调用后端 API 生成支付宝登录二维码
 * @returns 二维码信息，包括图片和会话 ID
 * 
 * @example
 * ```typescript
 * const result = await generateAlipayQrCode()
 * if (result.success) {
 *   // 显示二维码
 *   qrCodeImage.value = result.data.qrCode
 *   sessionId.value = result.data.sessionId
 * }
 * ```
 */
export const generateAlipayQrCode = withApiResponseHandler(
  async (): Promise<ApiResponse<AlipayQrCodeResponse>> => {
    try {
      const response = await request.post<AlipayQrCodeResponse>(
        '/auth/alipay/qrcode/generate',
        {},
        { base: 1 }
      )
      
      const normalized = normalizeApiResponse<AlipayQrCodeResponse>(response)
      
      if (normalized.success && normalized.data) {
        logger.info('[AlipayQrCode] QR code generated successfully', {
          sessionId: normalized.data.sessionId,
          expiresIn: normalized.data.expiresIn,
        })
      }
      
      return normalized
    } catch (error) {
      logger.error('[AlipayQrCode] Failed to generate QR code:', error)
      throw error
    }
  }
)

/**
 * 检查支付宝二维码扫描状态
 * 
 * @param sessionId 会话 ID，由 generateAlipayQrCode 返回
 * @returns 扫码状态，如果已确认则包含 token 和用户信息
 * 
 * @example
 * ```typescript
 * const result = await checkAlipayQrStatus(sessionId.value)
 * if (result.success) {
 *   if (result.data.status === 'confirmed') {
 *     // 登录成功
 *     saveToken(result.data.token)
 *     saveUser(result.data.user)
 *   } else if (result.data.status === 'expired') {
 *     // 二维码过期，需要重新生成
 *     await generateAlipayQrCode()
 *   }
 * }
 * ```
 */
export const checkAlipayQrStatus = withApiResponseHandler(
  async (sessionId: string): Promise<ApiResponse<AlipayQrStatusResponse>> => {
    if (!sessionId) {
      return {
        code: 400,
        success: false,
        message: t('api.unified_alipay.会话ID不能为空'),
        data: {
          status: 'error',
          message: t('api.unified_alipay.会话ID不能为空1'),
        },
      }
    }
    
    try {
      const response = await request.get<AlipayQrStatusResponse>(
        '/auth/alipay/qrcode/status',
        {
          params: { sessionId },
          base: 1,
        }
      )
      
      const normalized = normalizeApiResponse<AlipayQrStatusResponse>(response)
      
      if (normalized.success && normalized.data) {
        logger.debug('[AlipayQrCode] Status check', {
          sessionId,
          status: normalized.data.status,
        })
        
        // 如果登录成功，记录日志
        if (normalized.data.status === 'confirmed') {
          logger.info('[AlipayQrCode] Login successful', {
            userId: normalized.data.user?.id,
          })
        }
      }
      
      return normalized
    } catch (error) {
      logger.error('[AlipayQrCode] Failed to check status:', error)
      throw error
    }
  }
)

/**
 * 使用支付宝授权码登录
 * 
 * @param authCode 支付宝授权码（从支付宝回调获取）
 * @param state 状态参数（用于防止 CSRF）
 * @returns 登录结果，包含 token 和用户信息
 * 
 * @description 用于支付宝 OAuth2 授权码模式登录
 */
export const loginWithAlipayAuthCode = withApiResponseHandler(
  async (
    authCode: string,
    state?: string
  ): Promise<ApiResponse<AlipayAuthCodeResponse>> => {
    if (!authCode) {
      return {
        code: 400,
        success: false,
        message: t('api.unified_alipay.授权码不能为空2'),
        data: null as unknown as AlipayAuthCodeResponse,
      }
    }
    
    try {
      const response = await request.post<AlipayAuthCodeResponse>(
        '/auth/alipay/callback',
        {
          authCode,
          state,
        },
        { base: 1 }
      )
      
      const normalized = normalizeApiResponse<AlipayAuthCodeResponse>(response)
      
      if (normalized.success && normalized.data) {
        logger.info('[AlipayAuth] Auth code login successful', {
          userId: normalized.data.user?.id,
        })
      }
      
      return normalized
    } catch (error) {
      logger.error('[AlipayAuth] Auth code login failed:', error)
      throw error
    }
  }
)

/**
 * 获取支付宝授权 URL
 * 
 * @param redirectUri 登录成功后的回调地址
 * @param state 状态参数（用于防止 CSRF）
 * @returns 支付宝授权页面 URL
 */
export const getAlipayAuthUrl = withApiResponseHandler(
  async (
    redirectUri: string,
    state?: string
  ): Promise<ApiResponse<{ authUrl: string }>> => {
    try {
      const response = await request.get<{ authUrl: string }>(
        '/auth/alipay/authorize',
        {
          params: {
            redirectUri: encodeURIComponent(redirectUri),
            state,
          },
          base: 1,
        }
      )
      
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[AlipayAuth] Failed to get authorization URL:', error)
      throw error
    }
  }
)

/**
 * 绑定支付宝账号到当前用户
 * 
 * @param authCode 支付宝授权码
 * @returns 绑定结果
 */
export const bindAlipayAccount = withApiResponseHandler(
  async (authCode: string): Promise<ApiResponse<{ success: boolean; alipayUserId?: string }>> => {
    try {
      const response = await request.post<{ success: boolean; alipayUserId?: string }>(
        '/user/alipay/bind',
        { authCode },
        { base: 1 }
      )
      
      const normalized = normalizeApiResponse<{ success: boolean; alipayUserId?: string }>(response)
      
      if (normalized.success) {
        logger.info('[AlipayBind] Binding successful')
      }
      
      return normalized
    } catch (error) {
      logger.error('[AlipayBind] Binding failed:', error)
      throw error
    }
  }
)

/**
 * 解绑支付宝账号
 * 
 * @returns 解绑结果
 */
export const unbindAlipayAccount = withApiResponseHandler(
  async (): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await request.post<{ success: boolean }>(
        '/user/alipay/unbind',
        {},
        { base: 1 }
      )
      
      const normalized = normalizeApiResponse<{ success: boolean }>(response)
      
      if (normalized.success) {
        logger.info('[AlipayUnbind] Unbinding successful')
      }
      
      return normalized
    } catch (error) {
      logger.error('[AlipayUnbind] Unbinding failed:', error)
      throw error
    }
  }
)
