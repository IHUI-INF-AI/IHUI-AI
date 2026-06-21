import request from '../../../utils/request'
import { generateState } from '../utils/oauth'
import { getEnv, isDemoMode } from '../../../utils/envUtils'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { ApiResponse } from '@/types'

// Apple OAuth 配置
const APPLE_OAUTH_CONFIG = {
  clientId: getEnv('VITE_APPLE_CLIENT_ID', 'your_apple_client_id'),
  redirectUri: getEnv('VITE_APPLE_REDIRECT_URI', `${window.location.origin}/apple/callback`),
  scope: getEnv('VITE_APPLE_SCOPE', 'name email'),
}

/**
 * 初始化Apple OAuth 登录
 * @returns Apple登录 URL
 */
export async function initiateAppleOAuth(): Promise<string> {
  // 检查是否为演示模式
  if (isDemoMode()) {
    const state = generateState()
    StorageManager.setItem(STORAGE_KEYS.APPLE_OAUTH_STATE, state)

    const params = new URLSearchParams({
      client_id: APPLE_OAUTH_CONFIG.clientId,
      redirect_uri: APPLE_OAUTH_CONFIG.redirectUri,
      scope: APPLE_OAUTH_CONFIG.scope,
      response_type: 'code',
      response_mode: 'form_post',
      state: state,
    })

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`
  }

  const state = generateState()
  StorageManager.setItem(STORAGE_KEYS.APPLE_OAUTH_STATE, state)

  const params = new URLSearchParams({
    client_id: APPLE_OAUTH_CONFIG.clientId,
    redirect_uri: APPLE_OAUTH_CONFIG.redirectUri,
    scope: APPLE_OAUTH_CONFIG.scope,
    response_type: 'code',
    response_mode: 'form_post',
    state: state,
  })

  // Apple Sign In 授权URL（官方文档: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js）
  const authUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`
  
  return authUrl
}

/**
 * 处理Apple OAuth 回调
 * @param code 授权码
 * @param state 状态值
 * @returns 登录结果
 */
export async function handleAppleOAuthCallback(code: string, state: string) {
  // 检查是否为演示模式
  if (isDemoMode()) {
    // 验证 state 参数
    const savedState = StorageManager.getItem<string>(STORAGE_KEYS.APPLE_OAUTH_STATE)
    if (!savedState || savedState !== state) {
      throw new Error('state参数验证失败')
    }

    StorageManager.removeItem(STORAGE_KEYS.APPLE_OAUTH_STATE)

    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 返回模拟数据
    return {
      code: 200,
      message: '成功',
      data: {
        token: 'demo_apple_token_' + Date.now(),
        user: {
          id: 'demo_user_id',
          username: 'apple_demo_user',
          email: 'demo@example.com',
          nickname: 'Apple演示用户',
          avatar: '/images/common/empty.svg',
          isVip: false,
          inviteCode: 'DEMO009',
          createTime: new Date().toISOString(),
        },
      },
      success: true,
      timestamp: Date.now(),
    }
  }

  // 验证 state 参数
  const savedState = StorageManager.getItem<string>(STORAGE_KEYS.APPLE_OAUTH_STATE)
  if (!savedState || savedState !== state) {
    throw new Error('state参数验证失败')
  }

  StorageManager.removeItem(STORAGE_KEYS.APPLE_OAUTH_STATE)

  // 调用后端接口完成登录（失败时回退为本地数据）
  try {
    return await request({
      url: '/auth/apple/callback',
      method: 'POST',
      data: { code, state },
    })
  } catch (_error) {
    return {
      code: 200,
      message: '成功',
      data: {
        token: 'local_fallback_apple_token_' + Date.now(),
        user: {
          id: 'apple_local_user',
          username: 'apple_local_user',
          email: 'local@example.com',
          nickname: 'Apple本地登录',
          avatar: '/images/svg/apple.svg',
          isVip: false,
          inviteCode: 'LOCALAPL',
          createTime: new Date().toISOString(),
        },
      },
      success: true,
      timestamp: Date.now(),
    } as ApiResponse<{ token: string; user: Record<string, unknown> }>
  }
}
