// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  oauthCallback,
  wecomLogin,
  type LoginResult,
} from '@ihui/api-client'
import { WEB_BASE_URL } from './config'

// 通用 OAuth 平台类型(对齐后端 POST /api/auth/:platform/callback 的 platform 参数)
// 8 个平台:与 @ihui/types ThirdPartyPlatform 对齐(减去 'app' 不走 OAuth)
// 导出原因:apple.ts/google.ts 调 callOAuthCallback 时需传平台标识。
export type OAuthPlatform =
  'google' | 'apple' | 'feishu' | 'github' | 'wechat' | 'dingtalk' | 'enterpriseWechat' | 'alipay'

/** OAuth 登录结果(供 LoginScreen 处理 success / error / cancelled) */
export interface OAuthRedirectResult {
  success: boolean
  data?: LoginResult
  error?: string
  /** 用户取消授权(非错误,UI 层判断是否弹 Alert) */
  cancelled?: boolean
}

/**
 * App 系统拦截的 deep link 前缀(openAuthSessionAsync 第二参数)。
 *
 * 与 OAuth provider 的 redirect_uri 区分:
 * - redirectUri(传给 provider)= `http://localhost:8801/callback?platform=xxx&redirect=mobile-rn`(web 端 callback 页)
 * - appReturnUri(本常量,告诉系统哪个 URL 触发返回 App)= `ihui://oauth/callback`
 *
 * 流程:provider 回调 web callback 页 → web 检测 redirect=mobile-rn → 跳转 ihui://oauth/callback?xxx → 系统拦截,关闭浏览器,返回 App
 */
export const OAUTH_APP_RETURN_URI = 'ihui://oauth/callback'

// 环境变量(各平台 OAuth 授权 URL 构造所需)
const FEISHU_APP_ID = process.env.EXPO_PUBLIC_FEISHU_APP_ID
const WECOM_CORP_ID = process.env.EXPO_PUBLIC_WECOM_CORP_ID
const WECOM_AGENT_ID = process.env.EXPO_PUBLIC_WECOM_AGENT_ID
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID
const ALIPAY_APP_ID = process.env.EXPO_PUBLIC_ALIPAY_APP_ID
const DINGTALK_CLIENT_ID = process.env.EXPO_PUBLIC_DINGTALK_CLIENT_ID

/** 生成随机 state(防 CSRF,16 位 base36) */
function generateState(): string {
  return Math.random().toString(36).slice(2, 18)
}

/** 从回调 URL 解析 code 和 state(支持 query string)。
 *  支付宝回调参数名为 auth_code(非 code),同样解析。
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
      code: params.get('code') ?? params.get('auth_code') ?? undefined,
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
 * @param _redirectUri OAuth provider 的回调地址(web 端 callback 页,含 ?platform=xxx&redirect=mobile-rn)。
 *        已编码进 authUrl,本函数内部不再直接使用(下划线前缀表示有意保留参数以维持调用契约,
 *        apple.ts 等外部调用方仍传此参数)。openAuthSessionAsync 第二参数固定为 OAUTH_APP_RETURN_URI。
 * @param loginApi 拿到 code 后调后端换 JWT 的函数(各平台可能不同)
 * @param opts.allowMissingState provider 不回传 state 时跳过校验(支付宝 publicAppAuthorize 不保证回传)
 */
export async function openOAuthAndLogin(
  authUrl: string,
  _redirectUri: string,
  loginApi: (code: string, state: string) => Promise<OAuthRedirectResult>,
  opts?: { allowMissingState?: boolean },
): Promise<OAuthRedirectResult> {
  const state = generateState()
  const separator = authUrl.includes('?') ? '&' : '?'
  const urlWithState = authUrl.includes('state=')
    ? authUrl
    : `${authUrl}${separator}state=${encodeURIComponent(state)}`

  let result: WebBrowser.WebBrowserAuthSessionResult
  try {
    result = await WebBrowser.openAuthSessionAsync(urlWithState, OAUTH_APP_RETURN_URI)
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
  if (returnedState !== state && !(opts?.allowMissingState && returnedState === undefined)) {
    return { success: false, error: 'OAuth state 校验失败(可能遭遇 CSRF 攻击)' }
  }

  return loginApi(code, state)
}

/** 飞书登录:构造授权 URL → openOAuthAndLogin → oauthCallback('feishu', code, state) */
export async function loginByFeishuRedirect(): Promise<OAuthRedirectResult> {
  if (!FEISHU_APP_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_FEISHU_APP_ID' }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=feishu&redirect=mobile-rn`
  const authUrl =
    `https://open.feishu.cn/open-apis/authen/v1/authorize` +
    `?app_id=${encodeURIComponent(FEISHU_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`
  return openOAuthAndLogin(authUrl, redirectUri, (code, state) =>
    callOAuthCallback('feishu', code, state),
  )
}

/**
 * 钉钉登录:App 端自构造授权 URL → openOAuthAndLogin → dingtalkLogin(code)。
 *
 * 2026-09-04 修复:不再走后端 GET /auth/dingtalk/auth-url。原因:
 * 1. 后端 URL 自带后端 state,App 端 openOAuthAndLogin 检测到 state= 后不再附加本地 state,
 *    回调校验 returnedState !== 本地 state → 必然报"OAuth state 校验失败";
 * 2. 后端 redirect_uri(DINGTALK_REDIRECT_URI)不含 redirect=mobile-rn,
 *    web 中转页不会跳 ihui:// 深链 → 授权后永远回不到 App。
 * 改为与飞书/企微同一模式:App 端构造授权 URL(参数对齐后端 buildDingtalkAuthUrl)。
 */
export async function loginByDingtalkRedirect(): Promise<OAuthRedirectResult> {
  if (!DINGTALK_CLIENT_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_DINGTALK_CLIENT_ID' }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=dingtalk&redirect=mobile-rn`
  const authUrl =
    `https://login.dingtalk.com/oauth2/auth` +
    `?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(DINGTALK_CLIENT_ID)}` +
    `&scope=${encodeURIComponent('openid')}` +
    `&prompt=consent`
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
  const redirectUri = `${WEB_BASE_URL}/callback?platform=enterpriseWechat&redirect=mobile-rn`
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
  const redirectUri = `${WEB_BASE_URL}/callback?platform=google&redirect=mobile-rn`
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

/** GitHub 登录:构造授权 URL → openOAuthAndLogin → oauthCallback('github', code, state)
 *  对齐 web 端 GITHUB_CONFIG:scope=read:user user:email,回调走 web /callback?platform=github */
export async function loginByGithubRedirect(): Promise<OAuthRedirectResult> {
  if (!GITHUB_CLIENT_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_GITHUB_CLIENT_ID' }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=github&redirect=mobile-rn`
  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('read:user user:email')}`
  return openOAuthAndLogin(authUrl, redirectUri, (code, state) =>
    callOAuthCallback('github', code, state),
  )
}

/** 支付宝登录:auth_code 模式(非标准 OAuth2)→ openOAuthAndLogin → oauthCallback('alipay', ...)
 *  对齐 web 端 ALIPAY_CONFIG:参数名 app_id,scope 默认 auth_user,
 *  授权端点 https://openauth.alipay.com/oauth2/publicAppAuthorize.htm;
 *  回调参数名为 auth_code(parseCallbackUrl 已兼容),后端 POST /api/auth/alipay/callback
 *  兼容 auth_code(见 apps/api auth-extended.ts case 'alipay')。
 *  支付宝不保证回传 state → allowMissingState 跳过校验(仍附加 state 尽力防御)。 */
export async function loginByAlipayRedirect(): Promise<OAuthRedirectResult> {
  if (!ALIPAY_APP_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_ALIPAY_APP_ID' }
  }
  const redirectUri = `${WEB_BASE_URL}/callback?platform=alipay&redirect=mobile-rn`
  const authUrl =
    `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm` +
    `?app_id=${encodeURIComponent(ALIPAY_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent('auth_user')}`
  return openOAuthAndLogin(
    authUrl,
    redirectUri,
    (code, state) => callOAuthCallback('alipay', code, state),
    { allowMissingState: true },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
