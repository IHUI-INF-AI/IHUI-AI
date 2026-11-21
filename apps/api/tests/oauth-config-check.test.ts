// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { collectOAuthConfigWarnings } from '../src/lib/oauth-config-check.js'

/**
 * 判据:生产启动时哪些"必然导致登录失败"的配置必须自己喊出来。
 *
 * 每一条都对应 2026-11-21 线上事故里真实发生过的一格,断言的是**告警文本里带得出定位信息**,
 * 而不只是"有告警" —— 喊"配置有问题"却不说哪个键、值是什么,等于不喊。
 */
describe('collectOAuthConfigWarnings —— 登录/出站配置自检', () => {
  const GOOD_PROXY = 'http://127.0.0.1:7900'

  it('健康配置:公网回调 + 已配代理 ⇒ 零告警', () => {
    const warnings = collectOAuthConfigWarnings({
      GOOGLE_PC_REDIRECT_URI: 'https://aizhs.top/google/callback',
      PROXY_URL: GOOD_PROXY,
    })
    expect(warnings).toEqual([])
  })

  it('回调指向 localhost / 127.0.0.1 / ::1 ⇒ 告警且带出原值', () => {
    for (const uri of [
      'http://localhost:8801/google/callback',
      'http://127.0.0.1:8801/google/callback',
      'http://[::1]:8801/google/callback',
    ]) {
      const warnings = collectOAuthConfigWarnings({
        GOOGLE_PC_REDIRECT_URI: uri,
        PROXY_URL: GOOD_PROXY,
      })
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('回调地址指向本机')
      // 定位信息必须可读:把当时的实际值打出来,否则又要人去三方对字符
      expect(warnings[0]).toContain(uri)
    }
  })

  it('回调不是合法 URL ⇒ 单独一档告警(Google 会直接 400)', () => {
    const warnings = collectOAuthConfigWarnings({
      GOOGLE_PC_REDIRECT_URI: 'aizhs.top/google/callback',
      PROXY_URL: GOOD_PROXY,
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('不是合法 URL')
  })

  it('PROXY_URL 缺失或不是 http(s) ⇒ 告警(墙外厂商与 Google OAuth 必超时)', () => {
    for (const proxy of [undefined, '', '   ', '127.0.0.1:7900', 'socks5://127.0.0.1:7900']) {
      const warnings = collectOAuthConfigWarnings({
        GOOGLE_PC_REDIRECT_URI: 'https://aizhs.top/google/callback',
        PROXY_URL: proxy,
      })
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('PROXY_URL 未配置')
    }
  })

  it('两维同时坏 ⇒ 两条都喊,不互相吞掉', () => {
    const warnings = collectOAuthConfigWarnings({
      GOOGLE_PC_REDIRECT_URI: 'http://localhost:8801/google/callback',
      PROXY_URL: '',
    })
    expect(warnings).toHaveLength(2)
  })

  it('GOOGLE_PC_REDIRECT_URI 未配置时不冒充"指向本机"', () => {
    const warnings = collectOAuthConfigWarnings({ PROXY_URL: GOOD_PROXY })
    expect(warnings).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
