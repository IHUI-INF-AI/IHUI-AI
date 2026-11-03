// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'

import {
  isCurlLike,
  isBotUserAgent,
  isHeadlessBrowser,
  isMissingOrShortUserAgent,
} from '../src/utils/bot-detection.js'

/**
 * 首方客户端 UA 不得被风控判为爬虫(2026-09-24 立)。
 *
 * 实测事故:两个首方客户端都落进风控的"爬虫"判定,且是**两条不同的路径** ——
 *   · mobile-rn:RN 的 fetch 由 okhttp 实现,而 CURL_LIKE_KEYWORDS 含 'okhttp';
 *   · cli:Node 的 fetch(undici)根本不发 User-Agent,命中 isMissingOrShortUserAgent。
 * @ihui/api-client 此前从不设 User-Agent ⇒ 自家 App 每个请求都被判为自动化客户端,
 * 触发两处后果:
 *   ① 越过挑战阈值后 429 带 `X-Challenge-Type: bot`,并要求完成一个
 *      客户端根本无法渲染的 CAPTCHA(`/api/security/challenge` 无任何客户端实现);
 *   ② 每请求 `recordBadEvent(ip,'automation-ua')`,持续拉低出口 IP 信誉,
 *      可升级到 403「IP 已被临时封禁 15 分钟」。
 * 手机走运营商 NAT,一个出口 IP 承载大量真实用户,误判代价成倍放大。
 *
 * 本文件是**该缺陷的永久反例**:词表就在这里(真相源),所以断言放在 api 侧,
 * 不在客户端复制一份词表。客户端 UA 的生成处:
 *   - apps/mobile-rn/src/lib/config.ts        → `IHUIAI-App/<ver> (<os>/<api>)`
 *   - apps/cli/src/lib/device-fingerprint.ts  → `IHUI-CLI/<ver> (<platform>/<arch>)`
 * 版本用哨兵值,避免客户端升版本时这里假红 —— 只钉住"前缀形态不被判成爬虫"。
 */

const FIRST_PARTY_UAS = [
  'IHUIAI-App/9.9.9 (android/34)',
  'IHUIAI-App/9.9.9 (ios/17.4)',
  'IHUIAI-App/9.9.9 (web/unknown)',
  'IHUI-CLI/9.9.9 (win32/x64)',
  'IHUI-CLI/9.9.9 (darwin/arm64)',
  'IHUI-CLI/9.9.9 (linux/x64)',
] as const

describe('首方 UA 不被误判为自动化客户端', () => {
  for (const ua of FIRST_PARTY_UAS) {
    it(`${ua} → 四条判据全 false`, () => {
      expect(isCurlLike(ua)).toBe(false)
      expect(isBotUserAgent(ua)).toBe(false)
      expect(isHeadlessBrowser(ua)).toBe(false)
      expect(isMissingOrShortUserAgent(ua)).toBe(false)
    })
  }
})

describe('阳性对照:不设 UA 时确实会被判成爬虫', () => {
  // 这正是修复前两个客户端各自实际落到的判据 —— 两条路径不同,都必须堵:
  //  · mobile-rn:RN 的 fetch 由 okhttp 实现 → 命中 curl-like 词表
  //  · cli:Node 的 fetch(undici)**根本不发 User-Agent** → 命中 missing-or-short
  it('okhttp(RN fetch 的底层实现)命中 curl-like', () => {
    expect(isCurlLike('okhttp/4.9.1')).toBe(true)
  })

  it('node-fetch 命中 curl-like', () => {
    expect(isCurlLike('node-fetch/1.0 (+https://github.com/bitinn/node-fetch)')).toBe(true)
  })

  it('完全缺失的 UA 命中 missing-or-short(CLI 修复前的真实形态)', () => {
    expect(isMissingOrShortUserAgent(null)).toBe(true)
    expect(isMissingOrShortUserAgent('')).toBe(true)
    expect(isMissingOrShortUserAgent('okhttp')).toBe(true) // 6 字符 < 10
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
