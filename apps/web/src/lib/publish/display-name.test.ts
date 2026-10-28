// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { isSamePlatformName, splitDisplayNameParts, stripLocalCredLabel } from './display-name'

describe('stripLocalCredLabel — 账号 displayName 展示层清洗', () => {
  it('移除「本机凭据 日期」字样,保留逗号后一个空格', () => {
    expect(stripLocalCredLabel('公众号(AI智汇社,本机凭据 2026-09-15)')).toBe(
      '公众号(AI智汇社, 2026-09-15)',
    )
  })

  it('全角逗号分隔同样处理', () => {
    expect(stripLocalCredLabel('公众号(AI智汇社,本机凭据 2026-09-15)')).toBe(
      '公众号(AI智汇社, 2026-09-15)',
    )
    // 移除后产生的全角重复分隔符合并为单个(逗号后保留一个空格)
    expect(stripLocalCredLabel('B站(收藏夹,本机凭据,,2026-09-15)')).toBe('B站(收藏夹, 2026-09-15)')
  })

  it('括号内容变空时移除空括号(半角与全角)', () => {
    expect(stripLocalCredLabel('B站(本机凭据)')).toBe('B站')
    expect(stripLocalCredLabel('B站(本机凭据 )')).toBe('B站')
    expect(stripLocalCredLabel('小红书(本机凭据)')).toBe('小红书')
  })

  it('移除紧邻括号内侧的多余分隔符', () => {
    expect(stripLocalCredLabel('账号(本机凭据,2026-09-15)')).toBe('账号(2026-09-15)')
    expect(stripLocalCredLabel('账号(2026-09-15,本机凭据)')).toBe('账号(2026-09-15)')
  })

  it('不含「本机凭据」时原样返回(不 trim、不改动)', () => {
    const raw = 'B站(扫码登录 2026-09-15 14:11)'
    expect(stripLocalCredLabel(raw)).toBe(raw)
    // 前后空白原样保留
    expect(stripLocalCredLabel('  抖音(主号)  ')).toBe('  抖音(主号)  ')
  })

  it('「本机凭据」多次出现时全部移除', () => {
    expect(stripLocalCredLabel('小红书(本机凭据)(本机凭据)')).toBe('小红书')
    expect(stripLocalCredLabel('账号(本机凭据,本机凭据 2026-09-15)')).toBe('账号(2026-09-15)')
    expect(stripLocalCredLabel('本机凭据')).toBe('')
  })
})

describe('splitDisplayNameParts — 主名与括号补充信息拆分', () => {
  it('拆出主名与括号内备注/时间', () => {
    expect(splitDisplayNameParts('公众号(AI智汇社, 2026-09-15)')).toEqual({
      name: '公众号',
      suffix: 'AI智汇社 · 2026-09-15',
    })
  })

  it('先清洗「本机凭据」再拆分', () => {
    expect(splitDisplayNameParts('公众号(AI智汇社,本机凭据 2026-09-15)')).toEqual({
      name: '公众号',
      suffix: 'AI智汇社 · 2026-09-15',
    })
  })

  it('多组括号内容按顺序合并', () => {
    expect(splitDisplayNameParts('B站(主号)(扫码登录 2026-09-15 14:11)')).toEqual({
      name: 'B站',
      suffix: '主号 · 扫码登录 2026-09-15 14:11',
    })
  })

  it('无括号时原样返回主名、suffix 为空', () => {
    expect(splitDisplayNameParts('抖音')).toEqual({ name: '抖音', suffix: '' })
  })

  it('空括号不产生 suffix', () => {
    expect(splitDisplayNameParts('快手()')).toEqual({ name: '快手', suffix: '' })
  })
})

describe('isSamePlatformName — 主名与平台名重复判断', () => {
  it('简称映射到官方平台名时视为重复', () => {
    expect(isSamePlatformName('B站', '哔哩哔哩')).toBe(true)
    expect(isSamePlatformName('b站', '哔哩哔哩')).toBe(true)
    expect(isSamePlatformName('公众号', '微信公众号')).toBe(true)
    expect(isSamePlatformName('油管', 'YouTube')).toBe(true)
  })

  it('完全相同时视为重复', () => {
    expect(isSamePlatformName('知乎', '知乎')).toBe(true)
  })

  it('账号名与平台无关时不重复', () => {
    expect(isSamePlatformName('AI智汇社', '微信公众号')).toBe(false)
    expect(isSamePlatformName('李经理的号', '哔哩哔哩')).toBe(false)
  })

  it('空值返回 false', () => {
    expect(isSamePlatformName('', '哔哩哔哩')).toBe(false)
    expect(isSamePlatformName('B站', '')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
