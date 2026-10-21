// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebView 门户配置(RN 端封装,2026-10-18 起数据下沉 @ihui/shared/constants/web-portal)
 *
 * 本文件只保留 RN 端差异:EXPO_PUBLIC_WEB_BASE_URL 环境底座与两个绑定底座的薄函数。
 * 分组数据 / 类型 / 纯函数一律从 shared 单一真相源取,禁止在本文件再抄一份清单
 * (AGENTS.md §0.6:同类判据/清单全仓只许一份)。小程序端对等封装见
 * apps/miniapp-taro/src/constants/web-portal.ts。
 */

import {
  WEB_PORTAL_SECTIONS,
  buildMemoryDetailUrl,
  buildWebPortalUrl,
  toWebSsoRedirectUri,
  type WebPortalEntry,
  type WebPortalSection,
} from '@ihui/shared/constants'

export { WEB_PORTAL_SECTIONS }
export type { WebPortalEntry, WebPortalSection }

const ENV_WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL

export const WEB_BASE_URL = ENV_WEB_BASE_URL || 'https://aizhs.top'

/** 绑定 RN 底座:同域 URL 压成 SSO redirectUri 合规形态(相对路径) */
export function toSsoRedirectUri(url: string): string {
  return toWebSsoRedirectUri(WEB_BASE_URL, url)
}

/** 绑定 RN 底座:拼接门户条目完整 URL */
export function buildWebUrl(entry: WebPortalEntry): string {
  return buildWebPortalUrl(WEB_BASE_URL, entry)
}

/** 绑定 RN 底座:记忆详情页 URL(路径形状见 @ihui/shared/constants 的 buildMemoryDetailUrl) */
export function buildMemoryDetailWebUrl(id: string): string {
  return buildMemoryDetailUrl(WEB_BASE_URL, id)
}
