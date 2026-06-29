/**
 * 第三方登录统一配置管理
 *
 * 所有第三方登录的配置项都在这里统一管理
 * 生产环境只需要在 .env 文件中配置对应的环境变量即可
 */

import { getEnv } from '@/utils/envUtils'

/**
 * 第三方登录平台配置接口
 */
export interface ThirdPartyPlatformConfig {
  // 基础配置
  enabled: boolean
  clientId?: string
  appId?: string
  clientSecret?: string // 仅后端使用，前端不暴露
  redirectUri: string
  scope?: string

  // 平台特定配置
  [key: string]: unknown
}

/**
 * Google登录配置
 * 官方文档: https://developers.google.com/identity/protocols/oauth2/web-server
 */
export const GOOGLE_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnv('VITE_GOOGLE_ENABLED', 'true') === 'true',
  clientId: getEnv('VITE_GOOGLE_CLIENT_ID', ''),
  redirectUri: getEnv('VITE_GOOGLE_REDIRECT_URI', `${window.location.origin}/google/callback`),
  scope: getEnv(
    'VITE_GOOGLE_SCOPE',
    'openid email profile'
  ),
}

/**
 * Apple登录配置
 * 官方文档: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
 */
export const APPLE_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnv('VITE_APPLE_ENABLED', 'true') === 'true',
  clientId: getEnv('VITE_APPLE_CLIENT_ID', ''),
  redirectUri: getEnv('VITE_APPLE_REDIRECT_URI', `${window.location.origin}/apple/callback`),
  scope: getEnv('VITE_APPLE_SCOPE', 'name email'),
}

/**
 * 华为登录配置
 * 官方文档: https://developer.huawei.com/consumer/cn/doc/development/HMSCore-Guides/oauth2-0000001050049140
 */
export const HUAWEI_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnv('VITE_HUAWEI_ENABLED', 'true') === 'true',
  clientId: getEnv('VITE_HUAWEI_CLIENT_ID', ''),
  redirectUri: getEnv('VITE_HUAWEI_REDIRECT_URI', `${window.location.origin}/huawei/callback`),
  scope: getEnv('VITE_HUAWEI_SCOPE', 'openid profile'),
}


/**
 * 获取所有平台配置
 */
export const getAllPlatformConfigs = (): Record<string, ThirdPartyPlatformConfig> => {
  return {
    google: GOOGLE_CONFIG,
    apple: APPLE_CONFIG,
    huawei: HUAWEI_CONFIG,
  }
}

/**
 * 检查平台配置是否完整
 */
export const validatePlatformConfig = (platform: string): { valid: boolean; missing: string[] } => {
  const configs = getAllPlatformConfigs()
  const config = configs[platform]

  if (!config) {
    return { valid: false, missing: ['平台配置不存在'] }
  }

  const missing: string[] = []

  // 检查必需的配置项
  if (!config.enabled) {
    return { valid: false, missing: ['平台未启用'] }
  }

  if (!config.clientId && !config.appId) {
    missing.push('CLIENT_ID 或 APP_ID')
  }

  if (!config.redirectUri) {
    missing.push('REDIRECT_URI')
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}
