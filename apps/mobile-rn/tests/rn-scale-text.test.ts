// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scaleText` 的语义锁。它被 26 处内容文字共用,所以它的**边界**必须钉死:
 *  S1 倍率=1 ⇒ 返回 {} ⇒ 默认设置下渲染数值与改动前逐字相同(这条是"零观感变化"的证明,不是口头承诺);
 *  S2 倍率被唯一口夹到 1.4 ⇒ fontSize 与 lineHeight **同时**按同一倍率取整(只放字号就会裁字);
 *  S3 样式里没有 lineHeight ⇒ 只放字号,不凭空造一个行高出来;
 *  S4 不越权:除这两个键以外的任何键(color/flex/…)不得出现在返回值里;
 *  S5 空输入安全(undefined/null/非对象 ⇒ {})。
 */
import { describe, expect, it, vi } from 'vitest'
import { PixelRatio } from 'react-native'
import { scaleText } from '@ihui/rn-app'
import type { TextStyle } from 'react-native'

const CLAMP = 1.4

describe('scaleText 语义', () => {
  it('S1 倍率=1 时返回空覆盖(默认观感逐字不变)', () => {
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1)
    try {
      expect(scaleText({ fontSize: 12, lineHeight: 14, color: '#fff' })).toEqual({})
    } finally {
      spy.mockRestore()
    }
  })

  it('S2 倍率 2 被夹到 1.4,字号与行盒一起取整放大', () => {
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2)
    try {
      const out = scaleText({ fontSize: 12, lineHeight: 14 } as TextStyle)
      expect(out.fontSize).toBe(Math.round(12 * CLAMP))
      expect(out.lineHeight).toBe(Math.round(14 * CLAMP))
    } finally {
      spy.mockRestore()
    }
  })

  it('S3 没写 lineHeight 的样式只放字号,不凭空造行高', () => {
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2)
    try {
      const out = scaleText({ fontSize: 16 } as TextStyle)
      expect(out).toEqual({ fontSize: Math.round(16 * CLAMP) })
    } finally {
      spy.mockRestore()
    }
  })

  it('S4 不越权:除字号/行盒以外的键不得被复制进覆盖里', () => {
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2)
    try {
      const out = scaleText({ fontSize: 12, color: '#123456', flex: 1 } as TextStyle)
      expect(Object.keys(out).sort()).toEqual(['fontSize'])
    } finally {
      spy.mockRestore()
    }
  })

  it('S5 空输入安全', () => {
    expect(scaleText(undefined)).toEqual({})
    expect(scaleText(null)).toEqual({})
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
