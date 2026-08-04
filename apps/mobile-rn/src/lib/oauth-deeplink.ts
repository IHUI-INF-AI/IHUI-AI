/**
 * OAuth deep link 回调处理(ihui://oauth/callback)
 *
 * 平台特有:依赖 expo-linking deep link API,不适合共享。
 *
 * 流程:
 * 1. expo-web-browser 打开 OAuth 授权页(redirect_uri 指向 web 端 callback 页 + &redirect=mobile-rn)
 * 2. web 端 callback 页检测 redirect=mobile-rn,跳转 ihui://oauth/callback?platform=xxx&code=xxx&state=xxx
 * 3. 系统拦截 ihui:// scheme,返回 App
 * 4. 本模块监听 deep link,解析 platform/code/state
 * 5. 调 oauthCallback(platform, code, state) 换 JWT
 * 6. 通过回调返回 JWT 给调用方(App.tsx 更新 rnAuthStore)
 *
 * 与 sso.ts 的关系:`ihui://sso/callback` 和 `ihui://oauth/callback` 是两个不同的 deep link,
 * 互不干扰,本模块只处理 OAuth 回调,不影响 SSO 流程。
 */

import * as Linking from 'expo-linking'
import type { QueryParams } from 'expo-linking'
import {
  callOAuthCallback,
  OAUTH_APP_RETURN_URI,
  type OAuthPlatform,
  type OAuthRedirectResult,
} from './oauth-redirect'

// 重新导出类型:调用方(App.tsx)从本模块取 OAuthRedirectResult,不必绕道 oauth-redirect
export type { OAuthRedirectResult }

/** OAuth deep link URI 前缀(完整匹配 ihui://oauth/callback) */
export const OAUTH_DEEPLINK_PREFIX = OAUTH_APP_RETURN_URI

/** OAuthPlatform 合法值集合(用于运行时类型守卫,避免不安全的字符串断言) */
const OAUTH_PLATFORMS: ReadonlySet<string> = new Set<OAuthPlatform>([
  'google',
  'apple',
  'feishu',
  'github',
  'wechat',
  'dingtalk',
  'enterpriseWechat',
  'alipay',
])

/** 运行时类型守卫:判断字符串是否为合法 OAuthPlatform */
function isOAuthPlatform(value: string | undefined): value is OAuthPlatform {
  return value !== undefined && OAUTH_PLATFORMS.has(value)
}

/** 从 queryParams 取首项 string(queryParams 值可能为 undefined | string | string[]) */
function getParam(params: QueryParams | null, key: string): string | undefined {
  const v = params?.[key]
  if (Array.isArray(v)) return v[0]
  return v ?? undefined
}

/** 从 deep link URL 解析 OAuth 回调参数 */
export function parseOAuthDeepLink(url: string): {
  platform?: OAuthPlatform
  code?: string
  state?: string
} {
  try {
    const parsed = Linking.parse(url)
    // 检查是否是 ihui://oauth/callback(ParsedURL 用 hostname 字段)
    if (parsed.scheme !== 'ihui' || parsed.hostname !== 'oauth') return {}
    // path 可能是 '/callback' 或 'callback',统一去掉前导斜杠后比较
    const path = (parsed.path ?? '').replace(/^\//, '')
    if (path !== 'callback') return {}
    const platformRaw = getParam(parsed.queryParams, 'platform')
    return {
      platform: isOAuthPlatform(platformRaw) ? platformRaw : undefined,
      code: getParam(parsed.queryParams, 'code'),
      state: getParam(parsed.queryParams, 'state'),
    }
  } catch {
    return {}
  }
}

/** 判断 URL 是否是 OAuth deep link */
export function isOAuthDeepLink(url: string): boolean {
  return url.startsWith(OAUTH_DEEPLINK_PREFIX)
}

/**
 * 监听 OAuth deep link(应用已启动时,系统把 ihui://oauth/callback?xxx 转给本回调)。
 * 返回取消监听函数。
 */
export function subscribeOAuthDeepLink(
  callback: (result: OAuthRedirectResult) => void,
): () => void {
  const subscription = Linking.addEventListener('url', async ({ url }) => {
    if (!isOAuthDeepLink(url)) return
    const { platform, code, state } = parseOAuthDeepLink(url)
    if (!platform || !code) {
      callback({ success: false, error: 'OAuth deep link 缺少 platform 或 code' })
      return
    }
    // 调后端 oauthCallback 换 JWT
    const result = await callOAuthCallback(platform, code, state ?? '')
    callback(result)
  })
  return () => subscription.remove()
}

/**
 * 应用冷启动时检查初始 deep link(若因 deep link 唤起,这里拿到 URL)。
 * 返回 OAuthRedirectResult 或 null(非 OAuth deep link 唤起时)。
 */
export async function getInitialOAuthDeepLink(): Promise<OAuthRedirectResult | null> {
  try {
    const url = await Linking.getInitialURL()
    if (!url || !isOAuthDeepLink(url)) return null
    const { platform, code, state } = parseOAuthDeepLink(url)
    if (!platform || !code) return null
    return await callOAuthCallback(platform, code, state ?? '')
  } catch {
    return null
  }
}
