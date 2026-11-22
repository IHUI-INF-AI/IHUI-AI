// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * WebView 门户配置(小程序端封装,2026-10-18 起数据下沉 @ihui/shared/constants/web-portal)
 *
 * 本文件只保留小程序端差异:TARO_APP_WEB_URL 环境底座与绑定底座的薄函数。
 * 分组数据 / 类型 / 纯函数一律从 shared 单一真相源取,禁止在本文件再抄一份清单
 * (AGENTS.md §0.6:同类判据/清单全仓只许一份)。RN 端对等封装见
 * apps/mobile-rn/src/lib/webview-portal-config.ts。
 */
import {
  WEB_PORTAL_SECTIONS,
  buildWebPortalUrl,
  buildWebSsoMobileAuthUrl,
  toWebSsoRedirectUri,
  WEB_BASE,
  type WebPortalEntry,
  type WebPortalSection,
} from '@ihui/shared/constants'

export { WEB_PORTAL_SECTIONS, buildWebPortalUrl, buildWebSsoMobileAuthUrl, toWebSsoRedirectUri }
export type { WebPortalEntry, WebPortalSection }

const ENV_WEB_BASE_URL = process.env.TARO_APP_WEB_URL

export const WEB_BASE_URL = ENV_WEB_BASE_URL || WEB_BASE

/** 绑定小程序底座:同域 URL 压成 SSO redirectUri 合规形态(站内相对路径) */
export function toSsoRedirectUri(url: string): string {
  return toWebSsoRedirectUri(WEB_BASE_URL, url)
}

/** 绑定小程序底座:拼接门户条目完整 URL */
export function buildWebUrl(entry: WebPortalEntry): string {
  return buildWebPortalUrl(WEB_BASE_URL, entry)
}

/** 绑定小程序底座:构建 App→Web 免登录 URL(web 端 /sso/mobile-auth 消费页换 cookie) */
export function buildWebSsoUrl(targetUrl: string, ssoCode: string): string {
  return buildWebSsoMobileAuthUrl(WEB_BASE_URL, targetUrl, ssoCode)
}
