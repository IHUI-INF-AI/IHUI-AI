// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  canComputeJumpVisibility,
  computeJumpVisibility,
  JUMP_FAR_THRESHOLD,
  readScrollJumpGeometry,
  shouldShowJumpLatest,
  type ScrollJumpGeometry,
  type ScrollJumpReading,
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

describe('滚动事件 → 几何折算的唯一收口(三端形状差异)', () => {
  it('RN 形状:contentOffset.y + contentSize.height + layoutMeasurement.height 全取到', () => {
    const r = readScrollJumpGeometry({
      nativeEvent: {
        contentOffset: { y: 1200 },
        contentSize: { height: 5000 },
        layoutMeasurement: { height: 600 },
      },
    })
    expect(r).toEqual({ scrollTop: 1200, contentHeight: 5000, viewportHeight: 600 })
    expect(canComputeJumpVisibility(r as ScrollJumpReading)).toBe(true)
    // computeJumpVisibility 只吃「几何齐全」的形状(contentHeight/viewportHeight 不可空),
    // Reading 里这两个是可空 —— 不许硬 cast 混过去(2026-11-26 这条曾把 packages/shared 的
    // tsc 构建整条打断,连带生产部署 build-fail)。先过同一把硬门再喂,读数仍是同一份。
    if (!r || !canComputeJumpVisibility(r)) throw new Error('RN 形状应折算出完整几何')
    expect(computeJumpVisibility(r)).toEqual({
      isFarFromTop: true,
      isFarFromBottom: true,
    })
  })

  it('小程序 Taro 形状:detail 给得出 scrollTop/scrollHeight,但没有视口高 ⇒ 判不出完整几何', () => {
    const r = readScrollJumpGeometry({ detail: { scrollTop: 1500, scrollHeight: 9000 } })
    expect(r).toEqual({ scrollTop: 1500, contentHeight: 9000, viewportHeight: null })
    // 显式门:取不到视口高就不许算距底(算出来会是"距底很大"⇒ 恒亮,与事实相反)
    expect(canComputeJumpVisibility(r as ScrollJumpReading)).toBe(false)
  })

  it('扁平 web 形状(scrollTop/scrollHeight 直挂事件)也认', () => {
    const r = readScrollJumpGeometry({ scrollTop: 50, scrollHeight: 4000 })
    expect(r).toEqual({ scrollTop: 50, contentHeight: 4000, viewportHeight: null })
  })

  it('连 scrollTop 都取不到 ⇒ 返回 null,而不是按 0 判定(§0.3:取不到不记绿也不冒红)', () => {
    expect(readScrollJumpGeometry({})).toBeNull()
    expect(readScrollJumpGeometry({ detail: { scrollTop: Number.NaN } })).toBeNull()
    expect(readScrollJumpGeometry(null)).toBeNull()
    expect(readScrollJumpGeometry('scroll')).toBeNull()
  })

  it('负 scrollTop 在折算层保留原值(由判据层负责按 0 记账,两层各司其职)', () => {
    const r = readScrollJumpGeometry({ nativeEvent: { contentOffset: { y: -80 } } })
    expect(r?.scrollTop).toBe(-80)
    expect(
      computeJumpVisibility({ scrollTop: -80, contentHeight: 5000, viewportHeight: 600 })
        .isFarFromTop,
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
