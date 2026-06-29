import { t } from '@/utils/i18n'

/**
 * 统一微信登录API
 * 支持微信二维码登录功能
 *
 * 创建时间: 2026-01-28
 */

import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import request from '@/utils/request'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 微信二维码登录响应
 */
export interface WechatQrResponse {
  /** 二维码图片URL或Base64数据 */
  qrCodeUrl: string
  /** 二维码唯一标识 */
  ticket: string
  /** 登录会话ID */
  loginId: string
  /** 二维码过期时间（秒） */
  expiresIn: number
  /** 过期时间字符串 */
  expireTime?: string
  /** 应用ID */
  appId?: string
}

/**
 * 微信登录状态
 */
export type WechatLoginStatusType =
  | 'pending'     // 等待扫码
  | 'scanning'    // 正在扫码
  | 'scanned'     // 已扫码，等待确认
  | 'confirming'  // 确认中
  | 'success'     // 登录成功
  | 'failed'      // 登录失败
  | 'expired'     // 二维码过期
  | 'cancelled'   // 用户取消

/**
 * 微信登录状态检查响应
 */
export interface WechatLoginStatus {
  /** 登录状态 */
  status: WechatLoginStatusType
  /** 登录成功后返回的token */
  token?: string
  /** 刷新token */
  refreshToken?: string
  /** token过期时间（秒） */
  expiresIn?: number
  /** 用户信息 */
  userInfo?: {
    id: string
    username: string
    nickname: string
    avatar: string
    role: string
    openId?: string
    unionId?: string
  }
  /** 状态消息 */
  message?: string
  /** 是否为模拟数据 */
  isMockData?: boolean
  /** 模拟数据提示 */
  mockMessage?: string
}

/**
 * 扩展ApiResponse接口以支持isMockData属性
 */
export interface ApiResponseWithMock<T> extends ApiResponse<T> {
  isMockData?: boolean
  mockMessage?: string
}

/**
 * 微信用户信息（从微信开放平台获取）
 */
export interface WechatUserInfo {
  /** 微信用户唯一标识 */
  openid: string
  /** 微信开放平台统一标识 */
  unionid?: string
  /** 用户昵称 */
  nickname: string
  /** 用户头像URL */
  headimgurl: string
  /** 性别：1男，2女，0未知 */
  sex: number
  /** 省份 */
  province: string
  /** 城市 */
  city: string
  /** 国家 */
  country: string
  /** 语言 */
  language: string
  /** 用户特权信息 */
  privilege?: string[]
}

// ============================================================================
// API 函数
// ============================================================================

/**
 * 生成微信登录二维码
 *
 * @description 调用后端接口生成微信登录二维码，用于扫码登录
 * @param params 二维码生成参数
 * @returns 二维码信息，包含URL、ticket和过期时间
 *
 * @example
 * ```typescript
 * const result = await generateWechatQrCode()
 * if (result.success && result.data) {
 *   // 显示二维码
 *   showQrCode(result.data.qrCodeUrl)
 *   // 开始轮询登录状态
 *   pollLoginStatus(result.data.loginId)
 * }
 * ```
 */
export const generateWechatQrCode = withApiResponseHandler(
  async (params?: {
    /** 应用ID（可选，默认从环境变量获取） */
    appId?: string
    /** 回调地址（可选） */
    redirectUri?: string
    /** 自定义state参数 */
    state?: string
  }): Promise<ApiResponseWithMock<WechatQrResponse>> => {
    // 从环境变量获取微信APP ID
    const wechatAppId = import.meta.env.VITE_WECHAT_APP_ID || params?.appId || ''

    logger.info('[WeChat Login] Generating QR code, params:', {
      appId: wechatAppId ? `${wechatAppId.substring(0, 4)}****` : '未配置',
      hasRedirectUri: !!params?.redirectUri,
    })

    try {
      // 调用后端API生成微信登录二维码
      const response = await request.get<WechatQrResponse>('/auth/wechat/qr-code', {
        params: {
          appId: wechatAppId,
          redirectUri: params?.redirectUri,
          state: params?.state,
        },
        headers: {
          'platform-type': 'web',
        },
      })

      logger.info('[Wechat Login] QR code generation API response:', response)

      // 处理响应数据
      let result: WechatQrResponse = {
        qrCodeUrl: '',
        ticket: '',
        loginId: '',
        expiresIn: 300, // 默认5分钟
      }

      if (response && response.data && typeof response.data === 'object') {
        // 处理嵌套的data结构
        if ('data' in response.data && typeof response.data.data === 'object') {
          result = response.data.data as WechatQrResponse
        } else {
          result = response.data as WechatQrResponse
        }
      }

      // 验证二维码URL
      if (result.qrCodeUrl) {
        logger.info('[WeChat Login] Got QR code URL')
      }

      return {
        code: 200,
        message: 'success',
        data: result,
        success: true,
        timestamp: Date.now(),
      }
    } catch (error) {
      logger.error('[WeChat Login] Failed to generate QR code:', error)

      // 网络错误时必须返回失败，禁止返回任何模拟数据
      return {
        code: 503,
        message: t('api.unified_wechat.后端服务未响应使'),
        success: false,
        timestamp: Date.now(),
      }
    }
  }
)

/**
 * 检查微信二维码登录状态
 *
 * @description 轮询检查微信扫码登录状态，直到登录成功、失败或二维码过期
 * @param loginId 登录会话ID（从generateWechatQrCode返回）
 * @returns 登录状态信息
 *
 * @example
 * ```typescript
 * const pollStatus = async (loginId: string) => {
 *   const result = await checkWechatQrStatus(loginId)
 *   if (result.success && result.data) {
 *     switch (result.data.status) {
 *       case 'success':
 *         // 登录成功，保存token
 *         saveToken(result.data.token)
 *         break
 *       case 'expired':
 *         // 二维码过期，重新生成
 *         regenerateQrCode()
 *         break
 *       case 'pending':
 *       case 'scanned':
 *         // 继续轮询
 *         setTimeout(() => pollStatus(loginId), 2000)
 *         break
 *     }
 *   }
 * }
 * ```
 */
export const checkWechatQrStatus = withApiResponseHandler(
  async (loginId: string): Promise<ApiResponseWithMock<WechatLoginStatus>> => {
    logger.info('[Wechat Login] Checking login status, loginId:', loginId)

    if (!loginId) {
      return {
        code: 400,
        message: t('api.unified_wechat.loginId不1'),
        success: false,
        timestamp: Date.now(),
      }
    }

    try {
      // 调用后端API检查登录状态
      const response = await request.get<WechatLoginStatus>(`/auth/wechat/status/${loginId}`, {
        headers: {
          'platform-type': 'web',
        },
      })

      return normalizeApiResponse((response as { data?: unknown }).data || response)
    } catch (error) {
      logger.warn('[Wechat Login] Check status API call failed:', error)

      // 网络错误时必须返回失败，禁止返回任何模拟登录成功数据
      return {
        code: 503,
        message: '网络错误，请稍后重试',
        data: {
          status: 'failed' as WechatLoginStatusType,
          message: '网络错误，请稍后重试',
        },
        success: false,
        timestamp: Date.now(),
      }
    }
  }
)

/**
 * 处理微信授权回调
 *
 * @description 处理微信OAuth回调，用授权码换取用户信息和登录token
 * @param code 微信授权码
 * @param state 状态标识（防CSRF）
 * @returns 登录结果
 */
export const handleWechatCallback = withApiResponseHandler(
  async (
    code: string,
    state: string
  ): Promise<ApiResponse<{
    token: string
    refreshToken?: string
    expiresIn?: number
    user: WechatUserInfo
  }>> => {
    logger.info('[Wechat Login] Handling auth callback, state:', state)

    try {
      const response = await request.post<{
        token: string
        refreshToken?: string
        expiresIn?: number
        user: WechatUserInfo
      }>(
        '/auth/wechat/callback',
        { code, state },
        {
          headers: {
            'platform-type': 'web',
          },
        }
      )

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[WeChat Login] Auth callback handling failed:', error)

      // 网络错误时必须返回失败，禁止返回任何模拟登录数据
      return {
        code: 503,
        message: '微信授权回调失败，请稍后重试',
        success: false,
        timestamp: Date.now(),
      }
    }
  }
)

/**
 * 获取微信登录配置
 *
 * @description 获取微信登录相关配置，包括是否启用、支持的登录方式等
 * @returns 微信登录配置
 */
export const getWechatConfig = withApiResponseHandler(
  async (): Promise<ApiResponse<{
    enabled: boolean
    appId: string
    qrLoginEnabled: boolean
    webAuthEnabled: boolean
  }>> => {
    // 从环境变量获取配置
    const wechatAppId = import.meta.env.VITE_WECHAT_APP_ID || ''
    const isEnabled = import.meta.env.VITE_WECHAT_LOGIN_ENABLED !== 'false'

    logger.info('[Wechat Login] Getting config')

    try {
      const response = await request.get<{
        enabled: boolean
        appId: string
        qrLoginEnabled: boolean
        webAuthEnabled: boolean
      }>('/auth/wechat/config', {
        headers: {
          'platform-type': 'web',
        },
      })

      return normalizeApiResponse(response)
    } catch (error) {
      logger.warn('[WeChat Login] Failed to get config, using default:', error)

      // 返回默认配置
      return {
        code: 200,
        message: 'success',
        data: {
          enabled: isEnabled,
          appId: wechatAppId,
          qrLoginEnabled: true,
          webAuthEnabled: true,
        },
        success: true,
        timestamp: Date.now(),
      }
    }
  }
)

// ============================================================================
// 默认导出
// ============================================================================

export default {
  generateWechatQrCode,
  checkWechatQrStatus,
  handleWechatCallback,
  getWechatConfig,
}
