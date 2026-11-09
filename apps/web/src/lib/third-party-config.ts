// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * Next.js 客户端 env 变量映射表。
 *
 * ⚠️ 重要:Next.js 只在编译时静态替换 `process.env.NEXT_PUBLIC_*` 的**直接字面量引用**,
 * 不支持 `process.env[key]` 的动态访问。所以必须显式列出所有用到的变量名,
 * 让 Next.js 编译器能识别并内联到客户端 chunk。
 */
const ENV_DIRECT_ACCESS: Record<string, string | undefined> = {
  NEXT_PUBLIC_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_ENABLED,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_REDIRECT_URI: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
  NEXT_PUBLIC_GOOGLE_SCOPE: process.env.NEXT_PUBLIC_GOOGLE_SCOPE,
  NEXT_PUBLIC_APPLE_ENABLED: process.env.NEXT_PUBLIC_APPLE_ENABLED,
  NEXT_PUBLIC_APPLE_CLIENT_ID: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
  NEXT_PUBLIC_APPLE_REDIRECT_URI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI,
  NEXT_PUBLIC_APPLE_SCOPE: process.env.NEXT_PUBLIC_APPLE_SCOPE,
  NEXT_PUBLIC_DINGTALK_ENABLED: process.env.NEXT_PUBLIC_DINGTALK_ENABLED,
  NEXT_PUBLIC_DINGTALK_APP_ID: process.env.NEXT_PUBLIC_DINGTALK_APP_ID,
  NEXT_PUBLIC_DINGTALK_CLIENT_ID: process.env.NEXT_PUBLIC_DINGTALK_CLIENT_ID,
  NEXT_PUBLIC_DINGTALK_REDIRECT_URI: process.env.NEXT_PUBLIC_DINGTALK_REDIRECT_URI,
  NEXT_PUBLIC_DINGTALK_SCOPE: process.env.NEXT_PUBLIC_DINGTALK_SCOPE,
  NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED,
  NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID,
  NEXT_PUBLIC_ENTERPRISE_WECHAT_AGENT_ID: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_AGENT_ID,
  NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI:
    process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI,
  NEXT_PUBLIC_ENTERPRISE_WECHAT_SCOPE: process.env.NEXT_PUBLIC_ENTERPRISE_WECHAT_SCOPE,
  NEXT_PUBLIC_WECHAT_ENABLED: process.env.NEXT_PUBLIC_WECHAT_ENABLED,
  NEXT_PUBLIC_WECHAT_APP_ID: process.env.NEXT_PUBLIC_WECHAT_APP_ID,
  NEXT_PUBLIC_WECHAT_REDIRECT_URI: process.env.NEXT_PUBLIC_WECHAT_REDIRECT_URI,
  NEXT_PUBLIC_WECHAT_SCOPE: process.env.NEXT_PUBLIC_WECHAT_SCOPE,
  NEXT_PUBLIC_GITHUB_ENABLED: process.env.NEXT_PUBLIC_GITHUB_ENABLED,
  NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
  NEXT_PUBLIC_GITHUB_REDIRECT_URI: process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI,
  NEXT_PUBLIC_GITHUB_SCOPE: process.env.NEXT_PUBLIC_GITHUB_SCOPE,
  NEXT_PUBLIC_FEISHU_ENABLED: process.env.NEXT_PUBLIC_FEISHU_ENABLED,
  NEXT_PUBLIC_FEISHU_APP_ID: process.env.NEXT_PUBLIC_FEISHU_APP_ID,
  NEXT_PUBLIC_FEISHU_CLIENT_ID: process.env.NEXT_PUBLIC_FEISHU_CLIENT_ID,
  NEXT_PUBLIC_FEISHU_REDIRECT_URI: process.env.NEXT_PUBLIC_FEISHU_REDIRECT_URI,
  NEXT_PUBLIC_FEISHU_SCOPE: process.env.NEXT_PUBLIC_FEISHU_SCOPE,
  NEXT_PUBLIC_ALIPAY_ENABLED: process.env.NEXT_PUBLIC_ALIPAY_ENABLED,
  NEXT_PUBLIC_ALIPAY_APP_ID: process.env.NEXT_PUBLIC_ALIPAY_APP_ID,
  NEXT_PUBLIC_ALIPAY_REDIRECT_URI: process.env.NEXT_PUBLIC_ALIPAY_REDIRECT_URI,
  NEXT_PUBLIC_ALIPAY_SCOPE: process.env.NEXT_PUBLIC_ALIPAY_SCOPE,
  NEXT_PUBLIC_OIDC_ENABLED: process.env.NEXT_PUBLIC_OIDC_ENABLED,
  NEXT_PUBLIC_LINUXDO_ENABLED: process.env.NEXT_PUBLIC_LINUXDO_ENABLED,
  NEXT_PUBLIC_LINUXDO_CLIENT_ID: process.env.NEXT_PUBLIC_LINUXDO_CLIENT_ID,
  // 仅登记占位,使 .env 键集与本表严格一一对应;LINUXDO_CONFIG.redirectUri 恒留空
  // (后端代理闭环,填值会切到直连厂商分支 —— 见下方 LINUXDO_CONFIG 注释),本键不参与导航。
  NEXT_PUBLIC_LINUXDO_REDIRECT_URI: process.env.NEXT_PUBLIC_LINUXDO_REDIRECT_URI,
  NEXT_PUBLIC_LINUXDO_SCOPE: process.env.NEXT_PUBLIC_LINUXDO_SCOPE,
}

/**
 * 读取 Next.js 公开环境变量（客户端可见，必须以 NEXT_PUBLIC_ 前缀）。
 * 返回字符串；未配置时返回 fallback。
 */
function getEnv(key: string, fallback = ''): string {
  const v = ENV_DIRECT_ACCESS[key]
  return v === undefined || v === '' ? fallback : v
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
  /** 后端代理入口（相对路径，由后端代理到各厂商授权页；无真实后端入口的平台不填） */
  proxyPath?: string
  /** 授权端点（直接跳转时使用；留空且无法直连时由调用方明确报未配置） */
  authUrl?: string
  /** 企业微信 agentid（自建应用 ID，仅 enterpriseWechat 使用） */
  agentId?: string
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

/**
 * 本站 App 扫码登录配置(非 OAuth,走 /api/auth/qr/* 端点) */
export const APP_CONFIG: ThirdPartyPlatformConfig = {
  enabled: true,
  redirectUri: '',
  proxyPath: '/api/auth/qr/generate', // method: POST
}

/**
 * 企业 OIDC SSO 配置(后端代理模式)
 *
 * 与国内平台不同,OIDC 采用"后端代理"闭环:
 *   - 前端不配置 clientId/authUrl 等机密,点击时经 useThirdPartyAuth.startLogin('oidc')
 *     命中 canDirectRedirect=false → 跳转 `${proxyPath}`(后端 /api/auth/oauth/oidc/redirect)
 *   - 后端自己 generateState + 302 到 IdP;回调由 IdP 直接打到后端 callback 端点,
 *     后端 exchangeCode → 写 httpOnly cookie → redirect 回前端,浏览器自带闭环
 *   因此本配置仅需 enabled + 后端代理入口即可。
 */
export const OIDC_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_OIDC_ENABLED', false),
  redirectUri: '',
  proxyPath: '/api/auth/oauth/oidc/redirect', // method: GET
}

/**
 * LinuxDo 登录配置(2026-11-07 立)
 *
 * 厂商:LinuxDo(Discourse 社区,授权页 https://connect.linux.do/oauth2/authorize),
 * 国内可达、面向中国开发者,故归「国内优先」档(排法见
 * `packages/shared/src/auth/login-region-policy.ts` 的 THIRD_PARTY_PRIORITY.domestic)。
 *
 * 闭环形态与 OIDC 同型(**后端代理**),不是 GitHub 那种「前端直连厂商 + web /callback」:
 *   1. 点击 → `${proxyPath}` = GET /api/auth/oauth/linuxdo/redirect
 *   2. 后端自己 generateState + 302 到 connect.linux.do(厂商侧登记的 redirect_uri 是**后端**
 *      GET /api/auth/oauth/linuxdo/callback,即 api `.env` 的 LINUXDO_REDIRECT_URI)
 *   3. 后端 exchangeCode → setAuthCookies(httpOnly)→ 302 回 `${webOrigin}/sso/login?sso=linuxdo`
 *   ⇒ 浏览器自己把会话闭环走完,web 侧既不接收厂商回调,也不参与 state 校验。
 *
 * 因此 `redirectUri` **恒留空**(与 OIDC_CONFIG 同一手法):`validatePlatformConfig` 拿不到
 * REDIRECT_URI ⇒ `canDirectRedirect` 恒 false ⇒ `startLogin` 只会落 `proxyPath` 那一跳。
 * 一旦在此填上 web 回调地址,startLogin 会改走「直连厂商」分支,把用户送回
 * `POST /api/auth/:platform/callback` —— 那条通用回调只覆盖 8 平台**不含 linuxdo**,
 * 且厂商白名单也对不上,结果就是"亮着但点了必挂"(本文件 2026-10-22 记的同型事故)。
 * `authUrl`/`clientId`/`scope` 只作厂商端点与公开标识的登记,不参与导航。
 *
 * 「未配置即不亮」:后端只在 redirect/callback 里用 `isLinuxdoConfigured()` 判可用,
 * 而 `GET /api/auth/oauth-status` 的 8 键里没有 linuxdo(该路由不在前端可控面),
 * 所以 enabled 沿用 OIDC 那档 fail-closed 默认值 `false` —— 必须由部署方显式烘
 * `NEXT_PUBLIC_LINUXDO_ENABLED=true` 才点亮,不给"构建期开关说了算"的假绿留窗口
 * (判据与回归锁见 `src/hooks/__tests__/use-third-party-server-gate.test.tsx`)。
 */
const LINUXDO_CONFIG: ThirdPartyPlatformConfig = {
  enabled: getEnvBool('NEXT_PUBLIC_LINUXDO_ENABLED', false),
  clientId: getEnv('NEXT_PUBLIC_LINUXDO_CLIENT_ID'),
  redirectUri: '',
  scope: getEnv('NEXT_PUBLIC_LINUXDO_SCOPE', 'user'),
  authUrl: 'https://connect.linux.do/oauth2/authorize',
  proxyPath: '/api/auth/oauth/linuxdo/redirect', // method: GET
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
  oidc: OIDC_CONFIG,
  linuxdo: LINUXDO_CONFIG,
  app: APP_CONFIG,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
