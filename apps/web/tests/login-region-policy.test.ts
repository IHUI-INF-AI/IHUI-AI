// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { isOverseasLocale, loginTabsForLocale } from '../src/lib/login-region-policy'

/**
 * 2026-10-26 海外登录策略:
 * - 非 zh-CN 界面视为海外,不提供手机号验证码登录 tab;
 * - 国内保持共享层默认 4 tab 原样。
 */
describe('login-region-policy — 海外登录口径', () => {
  it('zh-CN 为国内,其余支持语言均为海外', () => {
    expect(isOverseasLocale('zh-CN')).toBe(false)
    for (const locale of ['en', 'ja', 'ko', 'zh-TW']) {
      expect(isOverseasLocale(locale)).toBe(true)
    }
  })

  it('国内不传 tabs 时原样返回 undefined(共享层继续用默认 4 tab)', () => {
    expect(loginTabsForLocale(undefined, 'zh-CN')).toBeUndefined()
  })

  it('海外不传 tabs 时显式剔除手机号(桌面默认 4 tab → 3 tab)', () => {
    expect(loginTabsForLocale(undefined, 'en')).toEqual(['email', 'password', 'qr'])
  })

  it('海外移动端 tabs 剔除 phone,保留邮箱/密码', () => {
    expect(loginTabsForLocale(['email', 'phone', 'password'], 'en')).toEqual(['email', 'password'])
  })

  it('海外只传 phone 时兜底为 email,避免空 tab 列表', () => {
    expect(loginTabsForLocale(['phone'], 'en')).toEqual(['email'])
  })

  it('国内传入 tabs 原样返回', () => {
    expect(loginTabsForLocale(['email', 'phone'], 'zh-CN')).toEqual(['email', 'phone'])
  })
})
