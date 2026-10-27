// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type { LoginTab } from '@ihui/types'

import {
  FEATURED_LOGIN_PLATFORM,
  LOGIN_EXCLUDED_TABS,
  QR_LOGIN_PLATFORM_PRIORITY,
  THIRD_PARTY_PRIORITY,
  isOverseasLocale,
  orderByPlatformPriority,
  orderLoginTabs,
  planLoginRegion,
  resolveLoginRegion,
} from '../login-order-policy'

/**
 * 登录方式优先级判据(2026-10-27 下沉到共享层时立)。
 *
 * 需求原话:国内 IP ⇒ 微信扫码登录最优先;国外 IP ⇒ 邮箱 + Google/GitHub 最优先。
 * 本文件钉住纯判据这一层(排序/剔除/主推/兜底),渲染与取数在端内各自取证。
 * 双向断言:表被改坏一排(国内首位不是 qr / 海外仍留 phone)必须当场翻红。
 */
describe('resolveLoginRegion — IP 优先,判不出才落 locale', () => {
  it('IP 判定压过界面语言(国内 IP + 英文界面 ⇒ 仍判国内)', () => {
    expect(resolveLoginRegion({ ipRegion: 'domestic', locale: 'en' })).toBe('domestic')
  })

  it('IP 判定压过界面语言(海外 IP + 中文界面 ⇒ 仍判海外)', () => {
    expect(resolveLoginRegion({ ipRegion: 'overseas', locale: 'zh-CN' })).toBe('overseas')
  })

  it('未判定(null/undefined)才回落界面语言', () => {
    expect(resolveLoginRegion({ ipRegion: null, locale: 'zh-CN' })).toBe('domestic')
    expect(resolveLoginRegion({ ipRegion: null, locale: 'en' })).toBe('overseas')
    expect(resolveLoginRegion({ ipRegion: undefined, locale: 'ja' })).toBe('overseas')
  })

  it('脏值不被读成国内(走 locale 兜底)', () => {
    const dirty = 'somewhere-else' as unknown as 'domestic'
    expect(resolveLoginRegion({ ipRegion: dirty, locale: 'en' })).toBe('overseas')
  })

  it('只有 zh-CN 算国内界面,zh-TW 也算海外(与 web 既有口径一致)', () => {
    expect(isOverseasLocale('zh-CN')).toBe(false)
    expect(isOverseasLocale('zh-TW')).toBe(true)
  })
})

describe('orderLoginTabs — 只改顺序与明确剔除,不增删成员', () => {
  it('国内:扫码排第一', () => {
    expect(orderLoginTabs(['email', 'phone', 'password', 'qr'], 'domestic')).toEqual([
      'qr',
      'phone',
      'email',
      'password',
    ])
  })

  it('海外:邮箱第一、密码次之,手机号整体剔除', () => {
    expect(orderLoginTabs(['email', 'phone', 'password', 'qr'], 'overseas')).toEqual([
      'email',
      'password',
      'qr',
    ])
    expect(LOGIN_EXCLUDED_TABS.overseas).toContain('phone')
  })

  it('表外 tab 排末尾并保持原相对顺序(新增方式不必回来改表)', () => {
    const withUnknown = ['passkey', 'email', 'sms'] as unknown as LoginTab[]
    expect(orderLoginTabs(withUnknown, 'domestic')).toEqual(['email', 'passkey', 'sms'])
  })

  it('剔到空集时兜底为该地区首位一项,绝不给空列表', () => {
    expect(orderLoginTabs([], 'domestic')).toEqual(['qr'])
    expect(orderLoginTabs(['phone'], 'overseas')).toEqual(['email'])
  })
})

describe('orderByPlatformPriority — 稳定排序,表外不动原相对顺序', () => {
  const items = [
    { key: 'alipay' as const },
    { key: 'google' as const },
    { key: 'wechat' as const },
    { key: 'github' as const },
  ]

  it('国内表:微信第一,google 未列名但仍在', () => {
    expect(orderByPlatformPriority(items, THIRD_PARTY_PRIORITY.domestic).map((i) => i.key)).toEqual(
      ['wechat', 'alipay', 'google', 'github'],
    )
  })

  it('海外表:google → github 在前', () => {
    expect(orderByPlatformPriority(items, THIRD_PARTY_PRIORITY.overseas).map((i) => i.key)).toEqual(
      ['google', 'github', 'alipay', 'wechat'],
    )
  })

  it('空表 = 原样返回(排序不是"没给表就乱排")', () => {
    expect(orderByPlatformPriority(items, []).map((i) => i.key)).toEqual([
      'alipay',
      'google',
      'wechat',
      'github',
    ])
  })

  it('不修改入参(纯函数)', () => {
    const frozen = Object.freeze([...items])
    expect(() => orderByPlatformPriority(frozen, THIRD_PARTY_PRIORITY.domestic)).not.toThrow()
    expect(items.map((i) => i.key)).toEqual(['alipay', 'google', 'wechat', 'github'])
  })
})

describe('planLoginRegion — 组合出口', () => {
  it('国内默认全集:首位 qr,主推微信,扫码内部微信也排第一(子面板第一格同样是微信)', () => {
    const plan = planLoginRegion({ ipRegion: 'domestic', locale: 'zh-CN' })
    expect(plan.region).toBe('domestic')
    expect(plan.tabs[0]).toBe('qr')
    expect(plan.featuredPlatform).toBe('wechat')
    expect(plan.qrPlatformPriority[0]).toBe('wechat')
  })

  it('海外默认全集:首位 email,主推 google,手机号不在集合里', () => {
    const plan = planLoginRegion({ ipRegion: 'overseas', locale: 'en' })
    expect(plan.region).toBe('overseas')
    expect(plan.tabs[0]).toBe('email')
    expect(plan.tabs).not.toContain('phone')
    expect(plan.featuredPlatform).toBe('google')
    expect(plan.priorityPlatforms.slice(0, 2)).toEqual(['google', 'github'])
  })

  it('主推平台不可用时不主推(但不改变排序表)', () => {
    const plan = planLoginRegion({
      ipRegion: 'domestic',
      locale: 'zh-CN',
      isPlatformAvailable: () => false,
    })
    expect(plan.featuredPlatform).toBeUndefined()
    expect(plan.priorityPlatforms[0]).toBe('wechat')
    expect(FEATURED_LOGIN_PLATFORM.domestic).toBe('wechat')
  })

  it('调用方限定 tabs 时只排给定的那几项(移动端不开放 qr)', () => {
    const plan = planLoginRegion({
      ipRegion: 'domestic',
      locale: 'zh-CN',
      requestedTabs: ['email', 'phone', 'password'],
    })
    expect(plan.tabs).toEqual(['phone', 'email', 'password'])
  })

  it('海外空表 ⇒ 扫码渠道优先序为空(不重排,维持调用方原序)', () => {
    expect(QR_LOGIN_PLATFORM_PRIORITY.overseas).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
