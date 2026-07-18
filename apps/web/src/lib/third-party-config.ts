/**
 * 第三方登录统一配置管理
 *
 * 等价自旧架构 client/src/features/third-party-login/config/thirdPartyConfig.ts，
 * 适配新架构（Next.js，使用 NEXT_PUBLIC_* 前缀环境变量）。
 *
 * 生产环境只需在 .env 文件中配置对应的环境变量即可。
 */

import type { ThirdPartyPlatform } from '@/types/third-party'

/**
 * 读取 Next.js 公开环境变量（客户端可见，必须以 NEXT_PUBLIC_ 前缀）。
 * 返回字符串；未配置时返回 fallback。
 */
function getEnv(key: string, fallback = ''): string {
  if (typeof process !== 'undefined' && process.env) {
    const v = process.env[key]
    return v === undefined || v === '' ? fallback : v
  }
  return fallback
}

/** 读取布尔环境变量，未配置时返回 fallback。 */
function getEnvBool(key: string, fallback = true): boolean {
  const v = getEnv(key, '')
  if (v === '') return fallback
  return v === 'true' || v === '1'
}

/** 当前站点 origin（用于构造默认回调地址） */
function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/**
 * 第三方登录平台配置接口
 */
export interface ThirdPartyPlatformConfig {
  /** 是否启用 */
  enabled: boolean
  /** OAuth client_id（Google/GitHub/Apple 等） */
  clientId?: string
  /** 应用 appId（钉钉/企微/微信等国内平台） */
  appId?: string
  /** client_secret，仅后端使用，前端不应暴露 */
  clientSecret?: string
  /** 授权回调地址 */
  redirectUri: string
  /** 授权范围 */
  scope?: string
  /** 后端代理入口（相对路径，由后端代理到各厂商授权页） */
  proxyPath: string
  /** 授权端点（直接跳转时使用，留空则走 proxyPath） */
  authUrl?: string
  /** 平台特定配置 */
  [key: string]: unknown
}

/**
 * Google 登录配置
 * 官方文档: https://developers.google.com/identity/protocols/oauth2/web-server
 */
export const GOOGLE_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_GOOGLE_ENABLED', true),
  clientId: getEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID'),
  redirectUri: getEnv('NEXT_PUBLIC_GOOGLE_REDIRECT_URI', `${getOrigin()}/google/callback`),
  scope: getEnv('NEXT_PUBLIC_GOOGLE_SCOPE', 'openid email profile'),
  proxyPath: '/api/auth/google',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
}

/**
 * Apple 登录配置
 * 官方文档: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
 */
export const APPLE_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_APPLE_ENABLED', true),
  clientId: getEnv('NEXT_PUBLIC_APPLE_CLIENT_ID'),
  redirectUri: getEnv('NEXT_PUBLIC_APPLE_REDIRECT_URI', `${getOrigin()}/apple/callback`),
  scope: getEnv('NEXT_PUBLIC_APPLE_SCOPE', 'name email'),
  proxyPath: '/api/auth/apple',
  authUrl: 'https://appleid.apple.com/auth/authorize',
}

/**
 * 钉钉登录配置
 * 官方文档: https://open.dingtalk.com/document/orgapp/tutorial-obtaining-user-personal-information
 */
export const DINGTALK_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_DINGTALK_ENABLED', true),
  appId: getEnv('NEXT_PUBLIC_DINGTALK_APP_ID'),
  clientId: getEnv('NEXT_PUBLIC_DINGTALK_CLIENT_ID'),
  redirectUri: getEnv(
    'NEXT_PUBLIC_DINGTALK_REDIRECT_URI',
    `${getOrigin()}/callback?platform=dingtalk`,
  ),
  scope: getEnv('NEXT_PUBLIC_DINGTALK_SCOPE', 'openid corpid'),
  proxyPath: '/api/auth/dingtalk',
  authUrl: 'https://login.dingtalk.com/oauth2/auth',
}

/**
 * 企业微信登录配置
 * 官方文档: https://developer.work.weixin.qq.com/document/path/91022
 */
export const ENTERPRISE_WECHAT_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED', true),
  appId: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID'),
  agentId: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_AGENT_ID'),
  redirectUri: getEnv(
    'NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI',
    `${getOrigin()}/callback?platform=enterpriseWechat`,
  ),
  scope: getEnv('NEXT_PUBLIC_ENTERPRISE_WECHAT_SCOPE', 'snsapi_privateinfo'),
  proxyPath: '/api/auth/login/enterprise/pc/wxCode',
  authUrl: 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect',
}

/**
 * 微信登录配置
 * 官方文档: https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1419316505
 */
export const WECHAT_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_WECHAT_ENABLED', true),
  appId: getEnv('NEXT_PUBLIC_WECHAT_APP_ID'),
  redirectUri: getEnv('NEXT_PUBLIC_WECHAT_REDIRECT_URI', `${getOrigin()}/callback?platform=wechat`),
  scope: getEnv('NEXT_PUBLIC_WECHAT_SCOPE', 'snsapi_login'),
  proxyPath: '/api/auth/wechat/mini/login',
  authUrl: 'https://open.weixin.qq.com/connect/qrconnect',
}

/**
 * GitHub 登录配置
 * 官方文档: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */
export const GITHUB_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_GITHUB_ENABLED', true),
  clientId: getEnv('NEXT_PUBLIC_GITHUB_CLIENT_ID'),
  redirectUri: getEnv('NEXT_PUBLIC_GITHUB_REDIRECT_URI', `${getOrigin()}/callback?platform=github`),
  scope: getEnv('NEXT_PUBLIC_GITHUB_SCOPE', 'read:user user:email'),
  proxyPath: '/api/auth/github',
  authUrl: 'https://github.com/login/oauth/authorize',
}

/**
 * 飞书登录配置
 * 官方文档: https://open.feishu.cn/document/common-capabilities/sso/web-application-sso/qr-sdk-documentation
 */
export const FEISHU_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_FEISHU_ENABLED', true),
  appId: getEnv('NEXT_PUBLIC_FEISHU_APP_ID'),
  clientId: getEnv('NEXT_PUBLIC_FEISHU_CLIENT_ID'),
  redirectUri: getEnv('NEXT_PUBLIC_FEISHU_REDIRECT_URI', `${getOrigin()}/callback?platform=feishu`),
  scope: getEnv('NEXT_PUBLIC_FEISHU_SCOPE', 'contact:user.base:readonly'),
  proxyPath: '/api/auth/feishu',
  authUrl: 'https://passport.feishu.cn/suite/passport/oauth/authorize',
}

/**
 * 支付宝登录配置
 * 官方文档: https://opendocs.alipay.com/open/263/105809
 *
 * 支付宝登录使用 auth_code 模式(非标准 OAuth2 跳转),前端拿到 auth_code 后
 * 直接 GET /api/auth/alipay/pc/wxCode?code=xxx,后端用应用私钥换 access_token + user_id。
 * 未配置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY 时降级为 mock 模式(DEV)。
 *
 * 授权页地址: https://openauth.alipay.com/oauth2/publicAppAuthorize.htm
 * 关键差异: 参数名为 `app_id`(非 `client_id`),scope 默认 `auth_user`。
 */
export const ALIPAY_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_ALIPAY_ENABLED', true),
  appId: getEnv('NEXT_PUBLIC_ALIPAY_APP_ID'),
  redirectUri: getEnv('NEXT_PUBLIC_ALIPAY_REDIRECT_URI', `${getOrigin()}/callback?platform=alipay`),
  scope: getEnv('NEXT_PUBLIC_ALIPAY_SCOPE', 'auth_user'),
  proxyPath: '/api/auth/alipay/pc/wxCode',
  authUrl: 'https://openauth.alipay.com/oauth2/publicAppAuthorize.htm',
}

/** 平台 → 配置映射 */
const PLATFORM_CONFIGS: Record<ThirdPartyPlatform, ThirdPartyPlatformConfig> = {
  google: GOOGLE_CONFIG,
  apple: APPLE_CONFIG,
  dingtalk: DINGTALK_CONFIG,
  enterpriseWechat: ENTERPRISE_WECHAT_CONFIG,
  wechat: WECHAT_CONFIG,
  github: GITHUB_CONFIG,
  feishu: FEISHU_CONFIG,
  alipay: ALIPAY_CONFIG,
}

/**
 * 获取所有平台配置
 */
export function getAllPlatformConfigs(): Record<ThirdPartyPlatform, ThirdPartyPlatformConfig> {
  return PLATFORM_CONFIGS
}

/**
 * 获取指定平台配置
 */
export function getPlatformConfig(platform: ThirdPartyPlatform): ThirdPartyPlatformConfig {
  return PLATFORM_CONFIGS[platform]
}

/**
 * 检查平台配置是否完整
 * @returns valid 表示是否有效，missing 为缺失项列表
 */
export function validatePlatformConfig(platform: ThirdPartyPlatform): {
  valid: boolean
  missing: string[]
} {
  const config = PLATFORM_CONFIGS[platform]

  if (!config) {
    return { valid: false, missing: ['平台配置不存在'] }
  }

  if (!config.enabled) {
    return { valid: false, missing: ['平台未启用'] }
  }

  const missing: string[] = []
  if (!config.clientId && !config.appId) {
    missing.push('CLIENT_ID 或 APP_ID')
  }
  if (!config.redirectUri) {
    missing.push('REDIRECT_URI')
  }

  return { valid: missing.length === 0, missing }
}
