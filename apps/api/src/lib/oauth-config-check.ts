// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { isProductionGuard } from '../config/index.js'

/**
 * Google 登录链路 + 出站代理的**启动自检判据**(纯函数,无 IO —— 便于单测且不在启动面重复实现)。
 *
 * 立因(2026-11-21 线上事故,实测不是假想):前端构建期内联的 redirect_uri 是
 * `https://aizhs.top/google/callback`,后端运行期 `GOOGLE_PC_REDIRECT_URI` 却是
 * `http://localhost:8801/google/callback`。这不是"两个配置项",而是**同一件事的两份真相** ——
 * Google 换 token 要求 redirect_uri 与发起授权时逐字符相等,不一致就 400 redirect_uri_mismatch。
 * 同一窗口还叠着第二层:本机直连 Google 不通(oauth2.googleapis.com 8-20s 超时),而
 * `PROXY_URL` 根本没配 ⇒ 就算地址对齐,换 token 也会超时。用户侧只看到回调页上"登录失败"。
 *
 * 为什么不在这里判死:把一次登录故障换成"服务永久不起"更糟(§5e 同一条纪律)。
 * 这里只把两件**必然导致线上失败**的配置喊出来:
 *   ① 回调指向 localhost / 127.0.0.1 / ::1 —— 线上用户的浏览器永远回不到这台机器的本机回环;
 *   ② PROXY_URL 未配 —— proxy-dispatcher 对白名单域名一律直连,受限网络下 Google 与墙外厂商必超时。
 */
export interface OAuthConfigEnv {
  GOOGLE_PC_REDIRECT_URI?: string
  PROXY_URL?: string
}

/** 判据本体:返回 0..N 条要在启动日志里喊出来的告警(空数组 = 本维无问题)。 */
export function collectOAuthConfigWarnings(env: OAuthConfigEnv): string[] {
  const warnings: string[] = []

  const redirectUri = (env.GOOGLE_PC_REDIRECT_URI ?? '').trim()
  if (redirectUri) {
    try {
      const host = new URL(redirectUri).hostname.toLowerCase()
      // `URL.hostname` 对 IPv6 字面量带方括号(`[::1]`),不能只比 `::1` —— 单测逮到过这一格。
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
        warnings.push(
          `⚠ Google 回调地址指向本机(${redirectUri}):线上用户授权后浏览器会去访问自己机器的该地址,登录必失败。` +
            '请把 GOOGLE_PC_REDIRECT_URI 改成与前端 NEXT_PUBLIC_GOOGLE_REDIRECT_URI 逐字符一致的公网地址。',
        )
      }
    } catch {
      warnings.push(
        `⚠ GOOGLE_PC_REDIRECT_URI 不是合法 URL(${redirectUri}):Google 换 token 会直接 400。`,
      )
    }
  }

  const proxy = (env.PROXY_URL ?? '').trim()
  if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
    warnings.push(
      '⚠ PROXY_URL 未配置:proxy-dispatcher 对所有域名走直连;受限网络下 Google OAuth 与墙外厂商调用都会超时。',
    )
  }

  return warnings
}

/** 启动面出口:仅生产档位收集(开发/测试允许 localhost 回调),由 index.ts 逐条 logger.warn。 */
export function collectOAuthConfigWarningsAtStartup(): string[] {
  if (!isProductionGuard) return []
  return collectOAuthConfigWarnings(process.env as OAuthConfigEnv)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
