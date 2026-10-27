// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ getOAuthStatus: vi.fn() }))

vi.mock('@ihui/api-client', () => ({ getOAuthStatus: h.getOAuthStatus }))

import {
  fetchRnLoginRegion,
  orderRnLoginTabs,
  orderRnThirdPartyOptions,
  resolveRnLoginRegion,
} from '../login-region'

/**
 * RN 侧接线(2026-10-27 立)。排序表本体住 @ihui/shared,这里只验 RN 特有的两件事:
 * 取数三态(domestic / overseas / 一切异常都算"未判定")与 `platform` 字段适配。
 * 失效方向钉死:取不到 **不能** 被读成 domestic,也不能让选项列表缩水。
 */
beforeEach(() => {
  h.getOAuthStatus.mockReset()
})

describe('fetchRnLoginRegion — 只认两个字面量', () => {
  it('success=true 且字段合法 ⇒ 原样返回', async () => {
    h.getOAuthStatus.mockResolvedValue({ success: true, data: { loginRegion: 'domestic' } })
    await expect(fetchRnLoginRegion()).resolves.toBe('domestic')
  })

  it('海外值同样透传', async () => {
    h.getOAuthStatus.mockResolvedValue({ success: true, data: { loginRegion: 'overseas' } })
    await expect(fetchRnLoginRegion()).resolves.toBe('overseas')
  })

  it('success=false ⇒ null(不把失败读成国内)', async () => {
    h.getOAuthStatus.mockResolvedValue({ success: false, data: { loginRegion: 'domestic' } })
    await expect(fetchRnLoginRegion()).resolves.toBeNull()
  })

  it('字段缺失/第三种脏值 ⇒ null', async () => {
    h.getOAuthStatus.mockResolvedValue({ success: true, data: {} })
    await expect(fetchRnLoginRegion()).resolves.toBeNull()
    h.getOAuthStatus.mockResolvedValue({ success: true, data: { loginRegion: 'mars' } })
    await expect(fetchRnLoginRegion()).resolves.toBeNull()
  })

  it('请求抛错 ⇒ null(登录页不能因为一条排版判据炸掉)', async () => {
    h.getOAuthStatus.mockRejectedValue(new Error('network'))
    await expect(fetchRnLoginRegion()).resolves.toBeNull()
  })
})

describe('resolveRnLoginRegion — 委托共享层同一判据', () => {
  it('IP 优先、判不出才回落 locale', () => {
    expect(resolveRnLoginRegion({ ipRegion: 'overseas', locale: 'zh-CN' })).toBe('overseas')
    expect(resolveRnLoginRegion({ ipRegion: null, locale: 'zh-CN' })).toBe('domestic')
    expect(resolveRnLoginRegion({ ipRegion: null, locale: 'en' })).toBe('overseas')
  })
})

describe('orderRnLoginTabs — 与 web 同序(去掉 RN 不存在的 qr)', () => {
  it('国内 ⇒ 手机验证码第一(维持 RN 既有默认 tab)', () => {
    expect(orderRnLoginTabs(['email', 'phone', 'password'], 'domestic')).toEqual([
      'phone',
      'email',
      'password',
    ])
  })

  it('海外 ⇒ 邮箱第一且整体隐藏 phone', () => {
    expect(orderRnLoginTabs(['email', 'phone', 'password'], 'overseas')).toEqual([
      'email',
      'password',
    ])
  })

  it('不增删成员:入参集合里有什么就只排什么', () => {
    const out = orderRnLoginTabs(['password'], 'domestic')
    expect(out).toEqual(['password'])
  })
})

describe('orderRnThirdPartyOptions — platform 字段适配 + 稳定排序', () => {
  const options = [
    { platform: 'alipay' as const, label: '支付宝' },
    { platform: 'google' as const, label: 'Google' },
    { platform: 'wechat' as const, label: '微信' },
    { platform: 'github' as const, label: 'GitHub' },
  ]

  it('国内:微信第一;表外 google/github 排后且保持原相对顺序', () => {
    expect(orderRnThirdPartyOptions(options, 'domestic').map((o) => o.platform)).toEqual([
      'wechat',
      'alipay',
      'google',
      'github',
    ])
  })

  it('海外:google → github 在前', () => {
    expect(orderRnThirdPartyOptions(options, 'overseas').map((o) => o.platform)).toEqual([
      'google',
      'github',
      'alipay',
      'wechat',
    ])
  })

  it('一个都不丢(排序不得改变成员多重集)', () => {
    const domestic = orderRnThirdPartyOptions(options, 'domestic')
    expect(domestic).toHaveLength(options.length)
    expect(domestic.map((o) => o.label).sort()).toEqual(options.map((o) => o.label).sort())
  })

  it('空列表 ⇒ 空列表', () => {
    expect(orderRnThirdPartyOptions([], 'overseas')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
