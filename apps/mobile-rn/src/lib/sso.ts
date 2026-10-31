// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端 SSO 接入:核心逻辑复用 @ihui/shared/auth/sso-core,
 * 仅保留 RN 独占(expo-web-browser 打开登录页 + expo-linking deep link 监听)。
 */
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { WEB_BASE_URL, SSO_CLIENT_ID, SSO_REDIRECT_URI, API_BASE_URL } from './config'
import {
  exchangeSsoCode as exchangeSsoCodeCore,
  extractSsoCode,
  buildSsoLoginUrl,
  type SsoTokenData,
} from '@ihui/shared/auth/sso-core'

// 重新导出类型(保持 RN 调用方 SsoTokenData 类型名不变)
export type { SsoTokenData } from '@ihui/shared/auth/sso-core'

/** RN 封装:内部用 API_BASE_URL + SSO_CLIENT_ID */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  return exchangeSsoCodeCore(API_BASE_URL, code, SSO_CLIENT_ID)
}

/** RN 独占:生成 SSO 登录中心 URL */
export function getSsoLoginUrl(): string {
  return buildSsoLoginUrl(WEB_BASE_URL, SSO_REDIRECT_URI, SSO_CLIENT_ID)
}

/**
 * 打开 web SSO 登录页,等待用户登录后 deep link 回跳。
 * 返回 deep link URL(含 sso_code query),或 null(用户取消/超时)。
 */
export async function openSsoLogin(): Promise<string | null> {
  const url = getSsoLoginUrl()
  const result = await WebBrowser.openAuthSessionAsync(url, SSO_REDIRECT_URI)
  if (result.type === 'success' && result.url) {
    return result.url
  }
  return null
}

// extractSsoCode 直接 re-export
export { extractSsoCode }

/** 2026-10-31 安全强化第 18 批(F1):deep link 必须是本 App 的 ihui://sso/callback
 *  —— 共享 extractSsoCode 只取 sso_code 参数不判来源,任意 URL(网页/其他 App
 *  触发的 scheme)携带的 sso_code 在此不再被采信;一次性 30s 码 + 攻击者需先从
 *  web 端生成码,残余窗口极窄,但形态校验零成本。 */
function isSsoCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'ihui:' &&
      parsed.hostname === 'sso' &&
      parsed.pathname.replace(/\/+$/, '') === '/callback'
    )
  } catch {
    return false
  }
}

/** RN 独占:监听 deep link(应用已启动时,系统把 ihui://sso/callback?sso_code=xxx 转给本回调) */
export function subscribeSsoDeepLink(callback: (ssoCode: string) => void): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (!isSsoCallbackUrl(url)) return
    const code = extractSsoCode(url)
    if (code) callback(code)
  })
  return () => subscription.remove()
}

/** RN 独占:应用冷启动时检查初始 deep link(若因 deep link 唤起,这里拿到 URL) */
export async function getInitialSsoCode(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL()
    if (!url || !isSsoCallbackUrl(url)) return null
    return extractSsoCode(url)
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
