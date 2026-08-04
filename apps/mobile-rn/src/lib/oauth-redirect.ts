/**
 * OAuth 浏览器跳转兜底(飞书/钉钉/企微/Google)
 *
 * 平台特有:依赖 expo-web-browser + react-native Platform API,不适合共享。
 *
 * 适用场景:移动端无原生 RN SDK 的平台(飞书/钉钉/企微),或原生 SDK 未安装时的 fallback(Google)。
 * 流程:expo-web-browser 打开授权页 → 用户授权 → 回调 URL 拿 code → 调后端换 JWT。
 *
 * 不适用:微信(用 react-native-wechat-lib 原生 SDK,见 wechat.ts)、
 *        苹果 iOS(用 expo-apple-authentication 原生 SDK,见 apple.ts)。
 */

import * as WebBrowser from 'expo-web-browser'
import {
  dingtalkLogin,
  getDingtalkAuthUrl,
  oauthCallback,
  wecomLogin,
  type LoginResult,
} from '@ihui/api-client'
import { WEB_BASE_URL } from './config'

// 通用 OAuth 平台类型(对齐后端 POST /api/auth/:platform/callback 的 platform 参数)
// 8 个平台:与 @ihui/types ThirdPartyPlatform 对齐(减去 'app' 不走 OAuth)
// 导出原因:apple.ts/google.ts 调 callOAuthCallback 时需传平台标识。
export type OAuthPlatform =
  | 'google'
  | 'apple'
  | 'feishu'
  | 'github'
  | 'wechat'
  | 'dingtalk'
  | 'enterpriseWechat'
  | 'alipay'

/** OAuth 登录结果(供 LoginScreen 处理 success / error / cancelled) */
export interface OAuthRedirectResult {
  success: boolean
  data?: LoginResult
  error?: string
  /** 用户取消授权(非错误,UI 层判断是否弹 Alert) */
  cancelled?: boolean
}

// 环境变量(各平台 OAuth 授权 URL 构造所需)
const FEISHU_APP_ID = process.env.EXPO_PUBLIC_FEISHU_APP_ID
const WECOM_CORP_ID = process.env.EXPO_PUBLIC_WECOM_CORP_ID
const WECOM_AGENT_ID = process.env.EXPO_PUBLIC_WECOM_AGENT_ID
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID

/** 生成随机 state(防 CSRF,16 位 base36) */
function generateState(): string {
  return Math.random().toString(36).slice(2, 18)
}

/** 从回调 URL 解析 code 和 state(支持 query string)。
 *  返回 error 字段表示 OAuth provider 返回的错误(如 ?error=access_denied) */
function parseCallbackUrl(url: string): {
  code?: string
  state?: string
  error?: string
} {
  try {
    const u = new URL(url)
    const params = u.searchParams
    return {
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
      error: params.get('error') ?? undefined,
    }
  } catch {
    return {}
  }
}

/**
 * 通用 OAuth callback 调用(POST /api/auth/:platform/callback)。
 * 导出原因:apple.ts/google.ts 需复用本函数调后端 oauthCallback('apple'/'google', code, state)。
 */
export async function callOAuthCallback(
  platform: OAuthPlatform,
  code: string,
  state: string,
): Promise<OAuthRedirectResult> {
  try {
    const res = await oauthCallback(platform, code, state)
    if (res.success && res.data) {
      return { success: true, data: res.data }
    }
    return { success: false, error: res.error ?? 'OAuth 登录失败' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'OAuth 登录失败' }
  }
}

/**
 * 通用 OAuth 跳转流程:打开浏览器 → 拿 code + state → 校验 state → 调 loginApi 换 JWT。
 * 导出原因:apple.ts 需复用本函数走 Android web OAuth 跳转流程。
 * @param authUrl OAuth 授权页 URL(不含 state,本函数会自动附加 state 防 CSRF)
 * @param redirectUri 用于 Android 让系统知道哪个 URL 触发返回 App
 * @param loginApi 拿到 code 后调后端换 JWT 的函数(各平台可能不同)
 */
export async function openOAuthAndLogin(
  authUrl: string,
  redirectUri: string,
  loginApi: (code: string, state: string) => Promise<OAuthRedirectResult>,
): Promise<OAuthRedirectResult> {
  const state = generateState()
  const separator = authUrl.includes('?') ? '&' : '?'
  const urlWithState = authUrl.includes('state=')
    ? authUrl
    : `${authUrl}${separator}state=${encodeURIComponent(state)}`

  let result: WebBrowser.WebBrowserAuthSessionResult
  try {
    result = await WebBrowser.openAuthSessionAsync(urlWithState, redirectUri)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '浏览器打开失败' }
  }

  // result.type !== 'success' → 用户取消 / 关闭浏览器(cancel / dismiss)
  if (result.type !== 'success') {
    return { success: false, cancelled: true, error: '用户取消授权' }
  }

  // result 在 'success' 分支为 WebBrowserRedirectResult,url 必有(运行时仍 check 防御)
  const redirectUrl = result.url
  if (!redirectUrl) {
    return { success: false, error: 'OAuth 回调未返回 URL' }
  }

  const { code, state: returnedState, error } = parseCallbackUrl(redirectUrl)
  if (error) {
    return { success: false, error: `OAuth 提供商返回错误:${error}` }
  }
  if (!code) {
    return { success: false, error: 'OAuth 回调未包含 code' }
  }
  if (returnedState !== state) {
    return { success: false, error: 'OAuth state 校验失败(可能遭遇 CSRF 攻击)' }
  }

  return loginApi(code, state)
}

/** 飞书登录:构造授权 URL → openOAuthAndLogin → oauthCallback('feishu', code, state) */
export async function loginByFeishuRedirect(): Promise<OAuthRedirectResult> {
  if (!FEISHU_APP_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_FEISHU_APP_ID' }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=feishu`
  const authUrl =
    `https://open.feishu.cn/open-apis/authen/v1/authorize` +
    `?app_id=${encodeURIComponent(FEISHU_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`
  return openOAuthAndLogin(authUrl, redirectUri, (code, state) =>
    callOAuthCallback('feishu', code, state),
  )
}

/** 钉钉登录:GET /auth/dingtalk/auth-url 拿 authUrl → openOAuthAndLogin → dingtalkLogin(code) */
export async function loginByDingtalkRedirect(): Promise<OAuthRedirectResult> {
  // 1. 拿后端构造的 authUrl
  let authUrl: string
  try {
    const res = await getDingtalkAuthUrl()
    if (!res.success || !res.data?.authUrl) {
      return { success: false, error: res.error ?? '获取钉钉授权 URL 失败' }
    }
    authUrl = res.data.authUrl
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : '获取钉钉授权 URL 失败',
    }
  }

  // 2. 打开浏览器拿 code → dingtalkLogin(code) 换 JWT(保持与现有契约一致,不走通用 oauthCallback)
  const redirectUri = `${WEB_BASE_URL}/callback?platform=dingtalk`
  return openOAuthAndLogin(authUrl, redirectUri, async (code) => {
    try {
      const res = await dingtalkLogin(code)
      if (res.success && res.data) {
        return { success: true, data: res.data }
      }
      return { success: false, error: res.error ?? '钉钉登录失败' }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '钉钉登录失败' }
    }
  })
}

/** 企业微信登录:构造授权 URL → openOAuthAndLogin → wecomLogin(code) */
export async function loginByWecomRedirect(): Promise<OAuthRedirectResult> {
  if (!WECOM_CORP_ID || !WECOM_AGENT_ID) {
    return {
      success: false,
      error: '未配置 EXPO_PUBLIC_WECOM_CORP_ID / EXPO_PUBLIC_WECOM_AGENT_ID',
    }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=enterpriseWechat`
  const authUrl =
    `https://login.work.weixin.qq.com/wwlogin/sso/login` +
    `?login_type=CorpApp` +
    `&appid=${encodeURIComponent(WECOM_CORP_ID)}` +
    `&agentid=${encodeURIComponent(WECOM_AGENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`
  // 企微用 wecomLogin(code) 而非通用 oauthCallback(保持与现有契约一致)
  return openOAuthAndLogin(authUrl, redirectUri, async (code) => {
    try {
      const res = await wecomLogin(code)
      if (res.success && res.data) {
        return { success: true, data: res.data }
      }
      return { success: false, error: res.error ?? '企微登录失败' }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '企微登录失败' }
    }
  })
}

/** Google 登录(OAuth 跳转 fallback):构造授权 URL → openOAuthAndLogin → oauthCallback('google', code, state) */
export async function loginByGoogleRedirect(): Promise<OAuthRedirectResult> {
  if (!GOOGLE_CLIENT_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_GOOGLE_CLIENT_ID' }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=google`
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}`
  return openOAuthAndLogin(authUrl, redirectUri, (code, state) =>
    callOAuthCallback('google', code, state),
  )
}
