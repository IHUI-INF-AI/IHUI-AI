/**
 * Google 登录封装
 *
 * 平台特有:依赖 RN Platform + @react-native-google-signin/google-signin(可选)+ expo-web-browser,不适合共享。
 *
 * 平台支持:
 * - Android/iOS native:优先用 @react-native-google-signin/google-signin(当前未安装)
 *   原生 SDK 拿 serverAuthCode → 调后端 oauthCallback('google', serverAuthCode, state) 换 JWT
 * - Android/iOS fallback:通过 web OAuth 跳转(accounts.google.com)
 * - web:通过 web OAuth 跳转
 *
 * 依赖环境变量:
 * - EXPO_PUBLIC_GOOGLE_CLIENT_ID:Google OAuth Client ID(如 xxx.apps.googleusercontent.com)
 *
 * 与 oauth-redirect.ts 的关系:
 * - loginWithGoogleRedirect 直接复用 oauth-redirect.ts 的 loginByGoogleRedirect
 * - loginWithGoogleNative 拿 serverAuthCode 后,调 oauth-redirect.ts 的 callOAuthCallback 换 JWT
 */

import { Platform } from 'react-native'
import {
  callOAuthCallback,
  loginByGoogleRedirect,
  type OAuthRedirectResult,
} from './oauth-redirect'

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID

/** Google 原生授权结果(Android/iOS native) */
export interface GoogleNativeResult {
  success: boolean
  data?: { idToken: string; serverAuthCode?: string; accessToken?: string }
  error?: string
  /** 用户取消授权(非错误,UI 层判断是否弹 Alert) */
  cancelled?: boolean
}

/**
 * @react-native-google-signin/google-signin 模块类型(动态 import,未安装时运行时检测)。
 * 类型手动声明,避免模块未安装时编译报错。
 */
interface GoogleSignInModule {
  statusCodes?: {
    SIGN_IN_CANCELLED: unknown
    IN_PROGRESS: unknown
    SIGN_IN_REQUIRED: unknown
  }
  GoogleSignin?: {
    configure?: (options: { webClientId?: string }) => void
    hasPlayServices?: () => Promise<boolean>
    signIn?: () => Promise<{
      idToken?: string
      accessToken?: string
      serverAuthCode?: string
    }>
    signInSilently?: () => Promise<{
      idToken?: string
      accessToken?: string
      serverAuthCode?: string
    }>
    isSignedIn?: () => boolean
    signOut?: () => Promise<void>
    revokeAccess?: () => Promise<void>
  }
}

/** Google 登录是否可用(需 CLIENT_ID;web 平台也可走 OAuth 跳转) */
export function isGoogleLoginAvailable(): boolean {
  return Boolean(GOOGLE_CLIENT_ID)
}

/**
 * Android/iOS 原生 Google 登录(@react-native-google-signin/google-signin,需安装 + prebuild)。
 * 返回 serverAuthCode(供 LoginScreen 调 callOAuthCallback('google', serverAuthCode, state) 换 JWT)。
 * 未安装 SDK 时返回 success=false + 明确 error,不阻塞构建。
 */
export async function loginWithGoogleNative(): Promise<GoogleNativeResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Google 原生登录不支持 web 平台' }
  }
  if (!GOOGLE_CLIENT_ID) {
    return { success: false, error: '未配置 EXPO_PUBLIC_GOOGLE_CLIENT_ID' }
  }

  // 动态 import:SDK 未安装时给明确错误,不阻塞构建
  // 用 string 变量绕过 TS 静态模块解析(否则 TS2307 报错,因模块未安装)
  let googleSignin: GoogleSignInModule
  try {
    const moduleName: string = '@react-native-google-signin/google-signin'
    const mod = await import(moduleName)
    googleSignin = mod as unknown as GoogleSignInModule
  } catch {
    return {
      success: false,
      error:
        '@react-native-google-signin/google-signin 未安装,需执行:npx expo install @react-native-google-signin/google-signin && expo prebuild',
    }
  }

  const GoogleSignin = googleSignin.GoogleSignin
  if (
    !GoogleSignin ||
    typeof GoogleSignin.configure !== 'function' ||
    typeof GoogleSignin.signIn !== 'function'
  ) {
    return {
      success: false,
      error: '@react-native-google-signin/google-signin 模块导出异常',
    }
  }

  // 配置 Client ID(webClientId 用于获取 serverAuthCode)
  GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID })

  // 检查 Play Services(Android 专用,iOS 上 hasPlayServices 可能不存在)
  if (typeof GoogleSignin.hasPlayServices === 'function') {
    try {
      const has = await GoogleSignin.hasPlayServices()
      if (!has) {
        return {
          success: false,
          error: '设备未安装 Google Play Services,无法使用 Google 登录',
        }
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Google Play Services 检查失败',
      }
    }
  }

  try {
    const userInfo = await GoogleSignin.signIn()
    if (!userInfo.serverAuthCode) {
      return {
        success: false,
        error: 'Google 授权未返回 serverAuthCode(需在 Google Cloud Console 配置 OAuth Client)',
      }
    }
    return {
      success: true,
      data: {
        idToken: userInfo.idToken ?? '',
        serverAuthCode: userInfo.serverAuthCode,
        accessToken: userInfo.accessToken,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 用户取消:Google SignIn statusCodes.SIGN_IN_CANCELLED
    const cancelledCode = googleSignin.statusCodes?.SIGN_IN_CANCELLED
    if (
      (cancelledCode !== undefined && msg.includes(String(cancelledCode))) ||
      msg.includes('SIGN_IN_CANCELLED') ||
      msg.includes('cancel')
    ) {
      return { success: false, error: '用户取消授权', cancelled: true }
    }
    return { success: false, error: msg }
  }
}

/**
 * 用 Google 原生 SDK 的 serverAuthCode 调后端 oauthCallback('google', code, state) 换 JWT。
 * state 由本函数生成(防 CSRF),与 oauth-redirect.ts 的 redirect 流程一致。
 */
export async function exchangeGoogleCodeForJwt(
  serverAuthCode: string,
): Promise<OAuthRedirectResult> {
  // state 在原生 SDK 流程中由前端生成(redirect 流程由 openOAuthAndLogin 生成)
  // 这里用随机 state,后端 /auth/:platform/callback 只校验 state 非空,不校验一致性
  const state = Math.random().toString(36).slice(2, 18)
  return callOAuthCallback('google', serverAuthCode, state)
}

/** web OAuth 跳转 Google 登录(fallback)。
 *  直接复用 oauth-redirect.ts 的 loginByGoogleRedirect(内部走 oauthCallback('google', code, state))。 */
export async function loginWithGoogleRedirect(): Promise<OAuthRedirectResult> {
  return loginByGoogleRedirect()
}
