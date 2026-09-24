// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Platform } from 'react-native'
import { SSO_CLIENT_IDS } from '@ihui/shared/constants'
import { version as PKG_VERSION } from '../../package.json'

/** 应用版本唯一真相源 = apps/mobile-rn/package.json(此前 SettingsScreen 写死 1.0.2、
 *  SharedDemoScreen 写死 1.0.0,而真实版本是 0.0.5 —— 三个版本号互相矛盾)。 */
export const APP_VERSION = PKG_VERSION

/**
 * 首方 User-Agent(2026-09-24 立)。RN 的 fetch 由 okhttp 实现,而后端
 * `apps/api/src/utils/bot-detection.ts` 把 `okhttp` 列进 CURL_LIKE_KEYWORDS ——
 * 不设 UA 等于自家 App 的**每个**请求都被判为爬虫:
 *  ① 一旦出口 IP 越过挑战阈值,429 会带 `X-Challenge-Type: bot` 并要求完成一个
 *    RN 端根本无法渲染的 CAPTCHA(`/api/security/challenge` 无任何客户端实现);
 *  ② 每次请求都触发 `recordBadEvent(ip, 'automation-ua')`,持续拉低用户出口 IP 的
 *    信誉,可升级到 403「IP 已被临时封禁 15 分钟」。
 * 手机走运营商 NAT,一个出口 IP 承载大量真实用户,误判代价被成倍放大。
 * 字符串刻意不含任何 curl-like / bot 关键字。
 */
export const APP_USER_AGENT = `IHUIAI-App/${APP_VERSION} (${Platform.OS}/${
  typeof Platform.Version === 'number' ? Platform.Version : Platform.Version ?? 'unknown'
})`

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8802'

// 10.0.2.2 是 Android 模拟器访问宿主机的专用 IP,web 平台浏览器无法访问,替换为 localhost。
// 生产环境配置的真实域名(如 https://api.example.com)不受影响。
export const API_BASE_URL =
  Platform.OS === 'web' && ENV_API_BASE_URL.includes('10.0.2.2')
    ? ENV_API_BASE_URL.replace('10.0.2.2', 'localhost')
    : ENV_API_BASE_URL
export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '@ihui/shared/constants'

/**
 * SSO 配置(移动端作为 SSO client 接入 web 登录中心)
 *
 * 流程:
 * 1. 用户点"使用网页账号登录" → openAuthSession 打开 web /sso/login?redirect=ihui://sso/callback&client_id=mobile-rn
 * 2. 用户在 web 登录后,web 生成 30s sso_code,跳 ihui://sso/callback?sso_code=xxx
 * 3. 系统拦截 deep link,拿 sso_code 调 /api/auth/sso/exchange 换 token → 自动登录
 */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8801'
export const SSO_CLIENT_ID = SSO_CLIENT_IDS.MOBILE_RN
export const SSO_REDIRECT_URI = 'ihui://sso/callback'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
