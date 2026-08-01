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
 */
export function getSsoLoginUrl(): string {
  const redirectUri = getSsoRedirectUrl()
  return buildSsoLoginUrl(WEB_BASE, redirectUri, SSO_CLIENT_ID)
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
export async function openSsoLogin(interactive = true): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new Error('chrome.identity API 不可用,请在 manifest 添加 identity 权限')
  }
  const url = getSsoLoginUrl()
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
  const responseUrl = await openSsoLogin(true)
  if (!responseUrl) return null

  const code = extractSsoCode(responseUrl)
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
