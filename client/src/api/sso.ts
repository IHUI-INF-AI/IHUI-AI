/**
 * SSO单点登录API
 * 用于教育平台双端的统一登录流程
 */
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import axios from 'axios'

/**
 * SSO登录响应数据
 */
export interface SSOLoginResponse {
  /** 访问令牌 */
  token?: string
  /** 兼容后端返回的字段名 */
  accessToken?: string
  access_token?: string
  /** 刷新令牌 */
  refreshToken?: string
  refresh_token?: string
  /** 用户ID */
  userId?: string
  /** 用户名 */
  username?: string
  /** 用户昵称 */
  nickname?: string
  /** 用户头像 */
  avatar?: string
  /** 令牌过期时间（秒） */
  expiresIn?: number
  /** 其他用户信息 */
  [key: string]: unknown
}

/**
 * SSO登录请求参数
 */
export interface SSOLoginParams {
  /** 用户UUID */
  uuid: string
  /** 平台类型：1=管理员端，2=会员端 */
  platform: 1 | 2
}

/**
 * 教育平台类型枚举
 */
export enum EduPlatformType {
  /** 管理员端 */
  ADMIN = 1,
  /** 会员端/用户端 */
  USER = 2
}

/**
 * 基于UUID的单点登录
 *
 * @param params SSO登录参数
 * @returns SSO登录响应
 *
 * @example
 * // 管理员端登录
 * const response = await ssoLoginByUuid({ uuid: 'user-uuid', platform: 1 })
 *
 * // 会员端登录
 * const response = await ssoLoginByUuid({ uuid: 'user-uuid', platform: 2 })
 */
export const ssoLoginByUuid = withApiResponseHandler(
  async (params: SSOLoginParams): Promise<ApiResponse<SSOLoginResponse>> => {
    try {
      logger.info('[SSO] Initiating SSO login request', {
        uuid: params.uuid.substring(0, 8) + '...', // 只显示前8位，保护隐私
        platform: params.platform === 1 ? '管理员端' : '会员端'
      })
      // 开发环境：打印完整 UUID，便于排查（生产环境不打印）
      if (import.meta.env.DEV) {
        logger.info('[SSO] Request parameter uuid:', params.uuid)
      }

      // ⚠️ 这里不要用 '@/utils/request'：
      // request 拦截器会自动注入主站 Authorization Bearer token，教育平台 SSO 端点可能因此直接返回 401。
      // 使用原生 axios 走同源代理，只传 uuid/platform，避免鉴权干扰。
      const response = await axios.post<SSOLoginResponse>(
        '/edu-sso/api/auth/sso/uuid/login',
        { uuid: params.uuid, platform: params.platform },
        { headers: { 'Content-Type': 'application/json' } }
      )

      // 记录原始响应数据，便于调试
      if (import.meta.env.DEV) {
        const rawData = response.data as Record<string, unknown> | undefined
        logger.info('[SSO] Raw response data:', {
          status: response.status,
          dataKeys: rawData ? Object.keys(rawData) : [],
          hasAccessToken: !!rawData?.accessToken,
          accessTokenLength: typeof rawData?.accessToken === 'string' ? rawData.accessToken.length : 0,
          hasToken: !!rawData?.token,
          tokenLength: typeof rawData?.token === 'string' ? rawData.token.length : 0,
          expiresIn: rawData?.expiresIn,
        })
      }

      const normalizedResponse = normalizeApiResponse<SSOLoginResponse>(response)

      if (normalizedResponse.success && normalizedResponse.data) {
        // 获取实际的 token 值（兼容多种字段名）
        const actualToken = normalizedResponse.data.token || normalizedResponse.data.accessToken || normalizedResponse.data.access_token
        logger.info('[SSO] SSO login successful', {
          hasToken: !!actualToken,
          tokenLength: actualToken?.length ?? 0,
          tokenPreview: actualToken ? actualToken.substring(0, 50) + '...' : null,
          hasRefreshToken: !!normalizedResponse.data.refreshToken,
          expiresIn: normalizedResponse.data.expiresIn,
          userId: normalizedResponse.data.userId,
        })
      } else {
        logger.warn('[SSO] SSO login failed', {
          code: normalizedResponse.code,
          message: normalizedResponse.message,
          data: normalizedResponse.data,
        })
      }

      return normalizedResponse
    } catch (error) {
      // HTTP 4xx/5xx 时 axios 会抛错，但响应体可能包含业务码（如 555 未找到平台关联用户），转为统一响应让调用方展示提示
      if (axios.isAxiosError(error) && error.response?.data) {
        const body = error.response.data as { code?: number; msg?: string; message?: string; data?: unknown }
        if (typeof body === 'object' && (body.code !== undefined || body.msg != null)) {
          const code = typeof body.code === 'number' ? body.code : error.response.status || 500
          const message = body.msg ?? body.message ?? 'SSO登录失败'
          logger.warn('[SSO] SSO business error (returning as response)', { code, message })
          return {
            code,
            message,
            data: (body.data ?? {}) as SSOLoginResponse,
            success: false,
            timestamp: Date.now(),
          }
        }
        logger.error('[SSO] SSO login request exception', {
          status: error.response.status,
          data: error.response.data,
        })
      } else {
        logger.error('[SSO] SSO login request exception', error)
      }
      throw error
    }
  }
)

/**
 * 构建教育平台跳转URL
 *
 * @param baseUrl 教育平台基础URL
 * @param ssoData SSO登录返回的数据
 * @returns 完整的跳转URL
 */
export function buildEduPlatformUrl(
  baseUrl: string,
  ssoData: SSOLoginResponse
): string {
  try {
    const url = new URL(baseUrl)

    // 添加token（必需参数）
    const token = ssoData.token || ssoData.accessToken || ssoData.access_token
    if (token) {
      url.searchParams.set('token', token as string)
    }

    // 添加刷新令牌（必需参数）
    const refreshToken = ssoData.refreshToken || ssoData.refresh_token
    if (refreshToken) {
      url.searchParams.set('refreshToken', refreshToken as string)
    }

    // 添加过期时间（必需参数，教育平台路由守卫需要此参数）
    // 默认 604800 秒（7天），与教育平台默认值保持一致
    const expiresIn = ssoData.expiresIn ?? 604800
    url.searchParams.set('expiresIn', String(expiresIn))

    // 添加用户信息（排除已单独传递的字段）
    const userInfo: Record<string, unknown> = {}
    const excludeKeys = ['token', 'accessToken', 'access_token', 'refreshToken', 'refresh_token', 'expiresIn']

    for (const [key, value] of Object.entries(ssoData)) {
      if (!excludeKeys.includes(key) && value !== undefined && value !== null) {
        userInfo[key] = value
      }
    }

    if (Object.keys(userInfo).length > 0) {
      url.searchParams.set('userInfo', encodeURIComponent(JSON.stringify(userInfo)))
    }

    logger.info('[SSO] Build redirect URL complete', {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
      expiresIn,
      userInfoKeys: Object.keys(userInfo)
    })

    return url.toString()
  } catch (error) {
    logger.error('[SSO] Failed to build redirect URL', error)
    // 如果URL构建失败，返回基础URL并用查询字符串方式拼接
    const params = new URLSearchParams()
    if (ssoData.token) {
      params.set('token', ssoData.token)
    }
    if (ssoData.refreshToken) {
      params.set('refreshToken', ssoData.refreshToken)
    }
    // 添加默认过期时间
    params.set('expiresIn', String(ssoData.expiresIn ?? 604800))
    return `${baseUrl}?${params.toString()}`
  }
}
