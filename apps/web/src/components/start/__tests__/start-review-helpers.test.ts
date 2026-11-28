// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { formatSuccessRate, pickTopPlatform } from '../start-review-helpers'

describe('pickTopPlatform', () => {
  it('取发布数最多的平台', () => {
    expect(
      pickTopPlatform([
        { platform: 'weibo', count: 3 },
        { platform: 'xiaohongshu', count: 8 },
        { platform: 'wechat', count: 5 },
      ]),
    ).toEqual({ platform: 'xiaohongshu', count: 8 })
  })

  it('并列时保留先出现的平台,不随机抖动', () => {
    expect(
      pickTopPlatform([
        { platform: 'wechat', count: 4 },
        { platform: 'douyin', count: 4 },
      ]),
    ).toEqual({ platform: 'wechat', count: 4 })
  })

  it('忽略空平台和零/负计数', () => {
    expect(pickTopPlatform([{ platform: '', count: 9 }, { platform: 'zhihu', count: 0 }])).toBeNull()
  })
})

describe('formatSuccessRate', () => {
  it('0..1 转百分比,整数不带小数点', () => {
    expect(formatSuccessRate(1)).toBe('100%')
    expect(formatSuccessRate(0)).toBe('0%')
    expect(formatSuccessRate(0.75)).toBe('75%')
  })

  it('非整数保留一位', () => {
    expect(formatSuccessRate(0.8333)).toBe('83.3%')
  })

  it('非法值返回占位,不显示 NaN', () => {
    expect(formatSuccessRate(Number.NaN)).toBe('-')
    expect(formatSuccessRate(-0.2)).toBe('-')
  })
})
