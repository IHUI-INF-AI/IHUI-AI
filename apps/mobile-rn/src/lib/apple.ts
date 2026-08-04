/**
 * Apple 登录封装
 *
 * 平台特有:依赖 RN Platform + expo-apple-authentication(可选)+ expo-web-browser,不适合共享。
 *
 * 平台支持:
 * - iOS native:优先用 expo-apple-authentication(当前未安装,需 npx expo install + expo prebuild --platform ios)
 * - Android:通过 web OAuth 跳转(https://appleid.apple.com/auth/authorize)
 * - web:不支持(Apple 不允许 web 端非 Safari 浏览器授权)
 *
 * 依赖环境变量:
 * - EXPO_PUBLIC_APPLE_CLIENT_ID:Apple Services ID(如 ai.ihui.app)
 * - EXPO_PUBLIC_APPLE_REDIRECT_URI:后端回调 URL(可选,缺省用 web 端 callback 页)
 *
 * 与 oauth-redirect.ts 的关系:Android web OAuth 流程复用 oauth-redirect.ts 的 openOAuthAndLogin + callOAuthCallback。
 */

import { Platform } from 'react-native'
import { WEB_BASE_URL } from './config'
import {
  callOAuthCallback,
  openOAuthAndLogin,
  type OAuthRedirectResult,
} from './oauth-redirect'

const APPLE_CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID
const APPLE_REDIRECT_URI = process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI

/** Apple 原生授权结果(iOS native) */
export interface AppleNativeResult {
  success: boolean
  data?: { identityToken: string; authorizationCode: string }
  error?: string
  /** 用户取消授权(非错误,UI 层判断是否弹 Alert) */
  cancelled?: boolean
}

/**
 * expo-apple-authentication 模块类型(动态 import,未安装时运行时检测)。
 * 类型手动声明,避免模块未安装时编译报错。
 */
interface AppleAuthModule {
  isAvailable?: () => boolean
  signInAsync: (options: {
    requestedScopes?: unknown[]
  }) => Promise<{
    identityToken?: string
    authorizationCode?: string
  }>
  AppleAuthenticationScope?: {
    FULL_NAME: unknown
    EMAIL: unknown
  }
}

/** Apple 登录是否可用(iOS 原生 SDK 或 Android web OAuth 均需 CLIENT_ID;web 不支持) */
export function isAppleLoginAvailable(): boolean {
  if (Platform.OS === 'web') return false
  return Boolean(APPLE_CLIENT_ID)
}

/**
 * iOS 原生 Apple 登录(expo-apple-authentication,需安装 + prebuild)。
 * 返回 identityToken + authorizationCode,LoginScreen 需自行调后端验证 token(本函数不换 JWT)。
 * 未安装 expo-apple-authentication 时返回 success=false + 明确 error,不阻塞构建。
 */
export async function loginWithAppleNative(): Promise<AppleNativeResult> {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'Apple 原生登录仅支持 iOS 平台' }
  }
  if (!APPLE_CLIENT_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_APPLE_CLIENT_ID' }
  }

  // 动态 import:expo-apple-authentication 未安装时给明确错误,不阻塞构建
  // 用 string 变量绕过 TS 静态模块解析(否则 TS2307 报错,因模块未安装)
  let appleAuth: AppleAuthModule
  try {
    const moduleName: string = 'expo-apple-authentication'
    const mod = await import(moduleName)
    appleAuth = mod as unknown as AppleAuthModule
  } catch {
    return {
      success: false,
      error:
        'expo-apple-authentication 未安装,需执行:npx expo install expo-apple-authentication && expo prebuild --platform ios',
    }
  }

  if (typeof appleAuth.isAvailable !== 'function' || !appleAuth.isAvailable()) {
    return {
      success: false,
      error: 'iOS 系统版本不支持 Apple 登录(需 iOS 13+)',
    }
  }

  // 构造 requestedScopes(用 AppleAuthenticationScope enum 值,未定义则空数组)
  const scopes: unknown[] = []
  const scopeEnum = appleAuth.AppleAuthenticationScope
  if (scopeEnum) {
    if (scopeEnum.FULL_NAME !== undefined) scopes.push(scopeEnum.FULL_NAME)
    if (scopeEnum.EMAIL !== undefined) scopes.push(scopeEnum.EMAIL)
  }

  try {
    const credential = await appleAuth.signInAsync({ requestedScopes: scopes })
    if (!credential.identityToken || !credential.authorizationCode) {
      return { success: false, error: 'Apple 授权未返回 identityToken/authorizationCode' }
    }
    return {
      success: true,
      data: {
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Apple 原生错误码:1001 = ERR_CANCELED = 用户取消(非错误)
    if (msg.includes('ERR_CANCELED') || msg.includes('1001')) {
      return { success: false, error: '用户取消授权', cancelled: true }
    }
    return { success: false, error: msg }
  }
}

/**
 * Android web OAuth 跳转 Apple 登录。
 * 构造 https://appleid.apple.com/auth/authorize URL → openOAuthAndLogin → oauthCallback('apple', code, state)。
 * iOS 平台也可用(作为 expo-apple-authentication 未安装时的 fallback,但 Apple 政策要求 iOS 用原生 SDK)。
 */
export async function loginWithAppleRedirect(): Promise<OAuthRedirectResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Apple 登录不支持 web 平台' }
  }
  if (!APPLE_CLIENT_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_APPLE_CLIENT_ID' }
  }
  // redirectUri 优先用环境变量(后端回调 URL),fallback 到 web 端 callback 页
  const redirectUri = APPLE_REDIRECT_URI ?? `${WEB_BASE_URL}/callback?platform=apple`
  const authUrl =
    `https://appleid.apple.com/auth/authorize` +
    `?client_id=${encodeURIComponent(APPLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('name email')}`
  return openOAuthAndLogin(authUrl, redirectUri, (code, state) =>
    callOAuthCallback('apple', code, state),
  )
}
