// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  JUMP_FAR_THRESHOLD,
  computeJumpVisibility,
  shouldShowJumpLatest,
  type ScrollJumpGeometry,
} from './scroll-jump'

const geo = (over: Partial<ScrollJumpGeometry> = {}): ScrollJumpGeometry => ({
  scrollTop: 0,
  contentHeight: 5000,
  viewportHeight: 600,
  ...over,
})

describe('跳顶/跳底显隐判据(三端唯一真相源)', () => {
  it('阈值取 D3 定档 800', () => {
    expect(JUMP_FAR_THRESHOLD).toBe(800)
  })

  it('两侧都是严格不等:800 不亮,801 才亮', () => {
    expect(computeJumpVisibility(geo({ scrollTop: 800 })).isFarFromTop).toBe(false)
    expect(computeJumpVisibility(geo({ scrollTop: 801 })).isFarFromTop).toBe(true)
  })

  it('贴底时距底为 0 ⇒ 不亮跳到最新,但仍算远离顶部', () => {
    const v = computeJumpVisibility(geo({ scrollTop: 4400 })) // 5000-600-4400=0
    expect(v.isFarFromBottom).toBe(false)
    expect(v.isFarFromTop).toBe(true)
  })

  it('距底同样 800 不亮、801 才亮', () => {
    expect(
      computeJumpVisibility(geo({ scrollTop: 1000, contentHeight: 2400 })).isFarFromBottom,
    ).toBe(false)
    expect(
      computeJumpVisibility(geo({ scrollTop: 1000, contentHeight: 2401 })).isFarFromBottom,
    ).toBe(true)
  })

  it('距底算法与 scroll-authority 的 distanceToBottom 同式:内容不足一屏取 0,不得算出负距离', () => {
    const v = computeJumpVisibility(geo({ scrollTop: 0, contentHeight: 300, viewportHeight: 600 }))
    expect(v.isFarFromBottom).toBe(false)
  })

  it('弹性回弹的负 scrollTop 不得被判成「远离顶部」(移动端实测形态)', () => {
    const v = computeJumpVisibility(geo({ scrollTop: -120 }))
    expect(v.isFarFromTop).toBe(false)
    expect(v.isFarFromBottom).toBe(true)
  })

  it('垃圾输入(NaN/Infinity/负尺寸)一律不亮,坏读数不得渲染成可点按钮', () => {
    expect(
      computeJumpVisibility(
        geo({
          scrollTop: Number.NaN,
          contentHeight: Number.POSITIVE_INFINITY,
          viewportHeight: -300,
        }),
      ),
    ).toEqual({
      isFarFromTop: false,
      isFarFromBottom: false,
    })
  })

  it('调用方可覆盖阈值(为各端按视口高度分档留口,不改默认值)', () => {
    expect(computeJumpVisibility(geo({ scrollTop: 300 }), 200).isFarFromTop).toBe(true)
  })
})

describe('「跳到最新」显示门', () => {
  it('没消息时恒不显示(空会话不该有一枚无用按钮)', () => {
    expect(shouldShowJumpLatest({ isFarFromBottom: true }, true, false)).toBe(false)
  })

  it('用户上滚即显示,与距离无关;真在底部且没上滚则不显示', () => {
    expect(shouldShowJumpLatest({ isFarFromBottom: false }, true, true)).toBe(true)
    expect(shouldShowJumpLatest({ isFarFromBottom: false }, false, true)).toBe(false)
    expect(shouldShowJumpLatest({ isFarFromBottom: true }, false, true)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
