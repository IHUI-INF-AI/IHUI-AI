// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Extension 端 SSO 接入(2026-08-01 立)
 *
 * 平台特有:依赖 chrome.identity.launchWebAuthFlow(Chrome 扩展 identity API),
 * 不适合共享到 packages/shared。
 *
 * 核心逻辑复用 @ihui/shared/auth/sso-core(exchangeSsoCode / extractSsoCode / buildSsoLoginUrl),
 * 仅保留 extension 独占(chrome.identity 打开登录页 + redirect URL 拼接)。
 *
 * 使用场景:
 *   - 用户已在 web 端登录,extension 一键授权拿 token(无需再输账号密码)
 *   - 首次使用 extension 的快捷登录入口
 *
 * 流程:
 *   1. chrome.identity.getRedirectURL() 拿到 https://<ext-id>.chromiumapp.org/
 *   2. buildSsoLoginUrl 拼接 web SSO 登录中心 URL(redirect=chromiumapp.org URL, client_id=extension)
 *   3. chrome.identity.launchWebAuthFlow 打开登录窗口,用户在 web 端登录/授权
 *   4. web 端 /sso/login 生成 sso_code 后跳转到 https://<ext-id>.chromiumapp.org/?sso_code=xxx
 *   5. Chrome 捕获该 redirect,launchWebAuthFlow 返回该 URL
 *   6. extractSsoCode 提取 sso_code
 *   7. exchangeSsoCode 用 code 换 token(走 @ihui/shared/auth/sso-core)
 *   8. setTokenPair 写入 tokenStore + scheduleRefreshAlarm + startAutoRefresh
 *
 * 安全边界:
 *   - chromiumapp.org 是 Chrome 扩展 identity 固定 redirect 域,只有已安装的扩展能接收回调
 *   - 后端 isSafeRedirectUri 已允许 *.chromiumapp.org(见 apps/api/src/routes/auth-sso.ts)
 *   - sso_code 一次性,30 秒过期,getdel 原子取出(防重放)
 */
import {
  exchangeSsoCode as exchangeSsoCodeCore,
  extractSsoCode,
  buildSsoLoginUrl,
  type SsoTokenData,
} from '@ihui/shared/auth/sso-core'
import { SSO_CLIENT_IDS, WEB_BASE } from '@ihui/shared/constants'

import { getApiBaseUrl } from '../../lib/config'
import { setTokenPair } from '../../lib/token'
import { scheduleRefreshAlarm, startAutoRefresh } from '../../lib/token-utils'

// 重新导出类型(保持调用方 SsoTokenData 类型名不变)
export type { SsoTokenData } from '@ihui/shared/auth/sso-core'
export { extractSsoCode }

const SSO_CLIENT_ID = SSO_CLIENT_IDS.EXTENSION

/**
 * 获取 Chrome 扩展 identity redirect URL。
 * 格式:https://<extension-id>.chromiumapp.org/
 *
 * 开发环境 extension-id 可能每次加载不同(除非固定 key);
 * 生产环境 extension-id 固定(由 Chrome Web Store 分配)。
 */
export function getSsoRedirectUrl(): string {
  if (typeof chrome === 'undefined' || !chrome.identity?.getRedirectURL) {
    throw new Error('chrome.identity API 不可用,请在 manifest 添加 identity 权限')
  }
  return chrome.identity.getRedirectURL()
}

/**
 * 构建 web SSO 登录中心 URL。
 * redirect 用 chrome.identity.getRedirectURL(),client_id=extension。
 *
 * 2026-10-31 第 22 批:支持 state(chrome.identity 的回调落点虽只回给本扩展,但 state 仍
 * 绑住"这次授权是本次发起的" —— 与其余端同一契约,不因落点较窄就少一道绑定)。
 */
export function getSsoLoginUrl(state?: string): string {
  const redirectUri = getSsoRedirectUrl()
  return buildSsoLoginUrl(WEB_BASE, redirectUri, SSO_CLIENT_ID, state)
}

/**
 * extension 封装:用 code 换 token(注入 apiBase + clientId)。
 */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  return exchangeSsoCodeCore(getApiBaseUrl(), code, SSO_CLIENT_ID)
}

/**
 * 打开 web SSO 登录页,等待用户登录后回调。
 *
 * @param interactive true=弹出可见窗口让用户登录;false=静默尝试(已授权时直接拿 code)
 * @returns redirect URL(含 sso_code query),或 null(用户取消/超时/失败)
 */
/**
 * 生成 SSO state(128 位随机,16 字节 → 32 hex)。
 *
 * 2026-10-31 第 22 批:随机源必须是平台的密码学实现;取不到就**抛错**而不是退回
 * Math.random —— 弱随机的 state 等于没有 state,而它挡的是"别人替你登录"。
 * (extensions 里 Web Crypto 恒在;RN/小程序各自的随机源在各自文件中实现。)
 */
function makeSsoState(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function openSsoLogin(interactive = true, state?: string): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new Error('chrome.identity API 不可用,请在 manifest 添加 identity 权限')
  }
  const url = getSsoLoginUrl(state)
  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        resolve(null)
        return
      }
      resolve(responseUrl)
    })
  })
}

/**
 * SSO 一键授权登录(完整流程)。
 *
 * 1. 打开 web SSO 登录页(interactive=true)
 * 2. 提取 sso_code
 * 3. 用 code 换 token
 * 4. 写入 tokenStore + 启动自动刷新
 *
 * @returns 成功返回 SsoTokenData;失败/取消返回 null
 */
export async function loginWithSso(): Promise<SsoTokenData | null> {
  // 2026-10-31 第 22 批:每次登录生成新的随机 state,随授权 URL 发出并在回调比对。
  const state = makeSsoState()
  const responseUrl = await openSsoLogin(true, state)
  if (!responseUrl) return null

  const code = extractSsoCode(responseUrl, state)
  if (!code) return null

  const tokenData = await exchangeSsoCode(code)
  if (!tokenData) return null

  // 写入 tokenStore + 启动定时刷新(与 login-api-client.handleLoginSuccess 一致)
  await setTokenPair({
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiresIn: tokenData.expiresIn,
  })
  scheduleRefreshAlarm(tokenData.accessToken)
  startAutoRefresh()

  return tokenData
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
