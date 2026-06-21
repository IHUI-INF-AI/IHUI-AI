import type { ApiResponse } from '../../../utils/apiResponseHandler'
import { logger } from '../../../utils/logger'
import { normalizeApiResponse, withApiResponseHandler } from '../../../utils/apiResponseHandler'
import request from '../../../utils/request'
import { GOOGLE_CONFIG } from '../config/thirdPartyConfig'

// Google OAuth 配置
export interface GoogleOAuthConfig {
  clientId: string
  redirectUri: string
  scope: string
}

// Google 用户信息
export interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture: string
  given_name: string
  family_name: string
}

// Google 登录响应
export interface GoogleLoginResponse {
  token: string
  refreshToken?: string
  user: {
    id: string
    username: string
    email: string
    nickname: string
    avatar: string
    isVip: boolean
    inviteCode: string
    createTime: string
  }
}

// Getting Google OAuth configuration
export const getGoogleOAuthConfig = withApiResponseHandler(
  async (): Promise<ApiResponse<GoogleOAuthConfig>> => {
    try {
      logger.info('[GoogleLogin] Getting Google OAuth configuration')

      const response = await request.get<GoogleOAuthConfig>('/auth/google/config')

      logger.info('[GoogleLogin] Google OAuth configuration obtained successfully', {
        hasClientId: !!response.data?.clientId,
        hasRedirectUri: !!response.data?.redirectUri,
        hasScope: !!response.data?.scope,
      })

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[GoogleLogin] Getting Google OAuth configuration failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
)

// Google OAuth登录（重定向方式）
export const initiateGoogleOAuth = async (): Promise<string> => {
  try {
    const configResult = await getGoogleOAuthConfig()
    if (configResult.code !== 200 || !configResult.data) {
      throw new Error('获取Google配置失败')
    }

    // 优先使用后端返回的配置, 兜底使用前端环境变量配置
    const { clientId, redirectUri, scope } = configResult.data
    const finalClientId = clientId || GOOGLE_CONFIG.clientId || ''
    const finalRedirectUri = redirectUri || GOOGLE_CONFIG.redirectUri
    const finalScope = scope || GOOGLE_CONFIG.scope || 'openid email profile'

    const params = new URLSearchParams({
      client_id: finalClientId,
      redirect_uri: finalRedirectUri,
      response_type: 'code',
      scope: finalScope,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    })

    // Google OAuth2.0 授权URL（官方文档: https://developers.google.com/identity/protocols/oauth2/web-server）
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    return authUrl
  } catch (error) {
    logger.error('Failed to generate Google OAuth URL:', error)
    throw error
  }
}

// 处理Google OAuth回调
export const handleGoogleOAuthCallback = withApiResponseHandler(
  async (...args: (string | undefined)[]): Promise<ApiResponse<GoogleLoginResponse>> => {
    const [code, state] = args

    if (!code) {
      logger.error('[GoogleLogin] OAuth callback processing failed: missing code parameter')
      throw new Error('缺少必要的code参数')
    }

    try {
      const response = await request.post<GoogleLoginResponse>('/auth/google/callback', {
        code,
        state,
      })

      logger.info('[GoogleLogin] Google OAuth callback processed successfully', {
        hasToken: !!response.data?.token,
        hasUser: !!response.data?.user,
        userId: response.data?.user?.id,
      })

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[GoogleLogin] Failed to process Google OAuth callback', {
        code: code.substring(0, 20) + '...',
        state,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
)

// Google一键登录（弹窗方式）
export const googleOneTapLogin = withApiResponseHandler(
  async (credential: string): Promise<ApiResponse<GoogleLoginResponse>> => {
    const response = await request.post<GoogleLoginResponse>('/auth/google/one-tap', {
      credential,
    })
    return normalizeApiResponse(response)
  }
)

// 检查Google登录状态
export const checkGoogleLoginStatus = withApiResponseHandler(
  async (
    sessionId: string
  ): Promise<
    ApiResponse<{
      status: 'pending' | 'confirmed' | 'expired'
      token?: string
      user?: Record<string, unknown>
    }>
  > => {
    const response = await request.get<{
      status: 'pending' | 'confirmed' | 'expired'
      token?: string
      user?: Record<string, unknown>
    }>(`/auth/google/status?sessionId=${sessionId}`)
    return normalizeApiResponse(response)
  }
)

// 解绑Google账号
export const unbindGoogleAccount = withApiResponseHandler(
  async (): Promise<ApiResponse<boolean>> => {
    const response = await request.delete<boolean>('/user/unbind-google')
    return normalizeApiResponse(response)
  }
)

// 绑定Google账号
export const bindGoogleAccount = withApiResponseHandler(
  async (code: string): Promise<ApiResponse<boolean>> => {
    const response = await request.post<boolean>('/user/bind-google', { code })
    return normalizeApiResponse(response)
  }
)
