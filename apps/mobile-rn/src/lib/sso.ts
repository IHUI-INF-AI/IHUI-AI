// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端 SSO 接入:核心逻辑复用 @ihui/shared/auth/sso-core,
 * 仅保留 RN 独占(expo-web-browser 打开登录页 + expo-linking deep link 监听)。
 */
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { WEB_BASE_URL, SSO_CLIENT_ID, SSO_REDIRECT_URI, API_BASE_URL } from './config'
import {
  exchangeSsoCode as exchangeSsoCodeCore,
  extractSsoCode as extractSsoCodeCore,
  buildSsoLoginUrl,
  type SsoTokenData,
} from '@ihui/shared/auth/sso-core'

// 重新导出类型(保持 RN 调用方 SsoTokenData 类型名不变)
export type { SsoTokenData } from '@ihui/shared/auth/sso-core'

// =============================================================================
// SSO state 绑定(2026-10-31 安全强化第 23 批)
//
// 病灶:RN 的 deep-link 落点(`ihui://sso/callback`)是**系统级**的 —— 任何 App/网页
// 都能构造同样的 scheme 把受害者唤起;`isSsoCallbackUrl` 只校验了"形状像我们的回调",
// 不校验"这次授权是不是本次发起的"。于是别人投一枚自己生成的 sso_code,受害者 App
// 一唤起就会拿它换票 —— 登录态被换成攻击者账户。
//
// 修法 = state:发起登录时生成 128 位随机值,随授权 URL 发出;**跨进程**持久化
// (AsyncStorage),因为授权完成后 App 可能已被系统回收、冷启动才会收到 deep link。
// 没有任何待处理 state 时,一律不认 deep-link 里的码(fail-closed)。
// =============================================================================
const SSO_STATE_STORAGE_KEY = 'ihui.sso.pendingState'

/** 内存镜像:供同步调用点(extractSsoCode)使用;冷启动路径会先 load 再比对 */
let pendingSsoState: string | null = null

function makeSsoState(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof c?.randomUUID !== 'function') {
    // 弱随机的 state 等于没有 state,而它挡的正是"别人替你登录"
    throw new Error('crypto.randomUUID 不可用:拒绝用弱随机生成 SSO state')
  }
  return c.randomUUID().replace(/-/g, '')
}

async function loadPendingState(): Promise<string | null> {
  if (pendingSsoState) return pendingSsoState
  try {
    pendingSsoState = await AsyncStorage.getItem(SSO_STATE_STORAGE_KEY)
  } catch {
    pendingSsoState = null
  }
  return pendingSsoState
}

async function rememberPendingState(state: string): Promise<void> {
  pendingSsoState = state
  try {
    await AsyncStorage.setItem(SSO_STATE_STORAGE_KEY, state)
  } catch {
    // 持久化失败:本次(热启动路径)仍能用内存值完成;冷启动会因读不到而拒绝,失效方向安全
  }
}

async function clearPendingState(): Promise<void> {
  pendingSsoState = null
  try {
    await AsyncStorage.removeItem(SSO_STATE_STORAGE_KEY)
  } catch {
    // 清不掉也无妨:下次 beginSsoLogin 会覆盖
  }
}

/**
 * 校验并提取 sso_code —— RN 侧所有回跳/deep-link URL 的**唯一出口**。
 *
 * 没有待处理的登录请求 ⇒ 一律返回 null(不认这枚码),这就是 state 绑定的实质。
 */
export function extractSsoCode(url: string, expectedState?: string): string | null {
  const state = expectedState ?? pendingSsoState
  if (!state) return null
  return extractSsoCodeCore(url, state)
}

/** RN 封装:内部用 API_BASE_URL + SSO_CLIENT_ID */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  const token = await exchangeSsoCodeCore(API_BASE_URL, code, SSO_CLIENT_ID)
  // 换票成功后这次登录已完结:清掉 state,避免它长期驻留被复用
  if (token) await clearPendingState()
  return token
}

/** RN 独占:生成 SSO 登录中心 URL */
export function getSsoLoginUrl(state?: string): string {
  return buildSsoLoginUrl(WEB_BASE_URL, SSO_REDIRECT_URI, SSO_CLIENT_ID, state)
}

/**
 * 打开 web SSO 登录页,等待用户登录后 deep link 回跳。
 * 返回 deep link URL(含 sso_code query),或 null(用户取消/超时)。
 *
 * 2026-10-31 第 23 批:进入时生成并持久化 state,随授权 URL 发出 —— 本函数返回的 URL
 * 由调用方用本模块的 `extractSsoCode` 提取(它按同一份 pending state 比对)。
 */
export async function openSsoLogin(): Promise<string | null> {
  const state = makeSsoState()
  await rememberPendingState(state)
  const url = getSsoLoginUrl(state)
  const result = await WebBrowser.openAuthSessionAsync(url, SSO_REDIRECT_URI)
  if (result.type === 'success' && result.url) {
    return result.url
  }
  // 用户取消/失败:这次登录未完成,清掉已发出的 state(避免它挂在那里等下一个人用)
  await clearPendingState()
  return null
}

// extractSsoCode 在本文件顶部定义(带 state 比对的本地实现),此处不再 re-export 共享版

/** 2026-10-31 安全强化第 18 批(F1):deep link 必须是本 App 的 ihui://sso/callback
 *  —— 共享 extractSsoCode 只取 sso_code 参数不判来源,任意 URL(网页/其他 App
 *  触发的 scheme)携带的 sso_code 在此不再被采信;一次性 30s 码 + 攻击者需先从
 *  web 端生成码,残余窗口极窄,但形态校验零成本。
 *  第 23 批追加一层:形状对还不够,还要过 pending state 绑定(见 extractSsoCode)。 */
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
    // 第 23 批:先取回 pending state(热路径读内存,异常情形回落到持久化值)再比对
    void loadPendingState().then((state) => {
      if (!state) return
      const code = extractSsoCode(url, state)
      if (code) callback(code)
    })
  })
  return () => subscription.remove()
}

/** RN 独占:应用冷启动时检查初始 deep link(若因 deep link 唤起,这里拿到 URL) */
export async function getInitialSsoCode(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL()
    if (!url || !isSsoCallbackUrl(url)) return null
    // 冷启动时内存镜像必为空:state 必须从持久化里读回来才能比对(见本文件顶部立据)
    const state = await loadPendingState()
    if (!state) return null
    return extractSsoCode(url, state)
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
