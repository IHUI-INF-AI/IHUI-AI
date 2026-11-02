// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

const taro = vi.hoisted(() => ({
  getSystemInfoSync: vi.fn(() => ({
    screenHeight: 812,
    windowHeight: 780,
    windowWidth: 375,
    safeArea: { top: 44, bottom: 778, left: 0, right: 0 },
  })),
  onWindowResize: vi.fn(),
  offWindowResize: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({ default: taro }))
vi.mock('@tarojs/components', () => ({
  View: () => null,
  Text: () => null,
  ScrollView: () => null,
  Image: () => null,
  Input: () => null,
  Switch: () => null,
  Textarea: () => null,
}))

import { applySafeAreaPadding, computeSafeAreaInsets, type SafeAreaInsets } from './platform'

const INSETS: SafeAreaInsets = { top: 0, bottom: 34, left: 0, right: 0 }

describe('computeSafeAreaInsets', () => {
  it('bottom = screenHeight - safeArea.bottom,top/left/right 恒 0(登记差异)', () => {
    expect(
      computeSafeAreaInsets({
        screenHeight: 812,
        safeArea: { top: 44, bottom: 778, left: 0, right: 0 },
      }),
    ).toEqual({ top: 0, bottom: 34, left: 0, right: 0 })
    expect(
      computeSafeAreaInsets({ screenHeight: 844, safeArea: { top: 47, bottom: 810 } }),
    ).toEqual({ top: 0, bottom: 34, left: 0, right: 0 })
  })

  it('无刘海屏(safeArea.bottom == screenHeight)⇒ 0', () => {
    expect(computeSafeAreaInsets({ screenHeight: 640, safeArea: { bottom: 640 } })).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    })
  })

  it('取不到系统安全区(旧基础库 / 异常)⇒ 全 0(与迁移前一致,不猜固定值)', () => {
    expect(computeSafeAreaInsets(null)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(computeSafeAreaInsets(undefined)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(computeSafeAreaInsets({ screenHeight: 812 })).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    })
  })

  it('异常值(safeArea.bottom 越界 / 非有限数 / 缺 screenHeight)⇒ 夹到 0,不出负 padding', () => {
    expect(computeSafeAreaInsets({ screenHeight: 812, safeArea: { bottom: 900 } }).bottom).toBe(0)
    expect(
      computeSafeAreaInsets({ screenHeight: 812, safeArea: { bottom: Number.NaN } }).bottom,
    ).toBe(0)
    expect(computeSafeAreaInsets({ safeArea: { bottom: 0 } }).bottom).toBe(0)
    expect(computeSafeAreaInsets({ screenHeight: 0, safeArea: { bottom: 0 } }).bottom).toBe(0)
  })
})

describe('applySafeAreaPadding', () => {
  it('无样式 ⇒ 只补 bottom,不落 0 值边', () => {
    expect(applySafeAreaPadding(undefined, ['bottom'], INSETS)).toEqual({ paddingBottom: 34 })
    expect(applySafeAreaPadding(undefined, ['top', 'left', 'right'], INSETS)).toEqual({})
  })

  it('调用方显式写过该方向 padding ⇒ 不覆盖(避免双份留白)', () => {
    expect(applySafeAreaPadding({ paddingBottom: 10 }, ['bottom'], INSETS)).toEqual({
      paddingBottom: 10,
    })
    // 0 也算显式(不是"没写"),否则会把调用方刻意清零的底部留白又补回来
    expect(applySafeAreaPadding({ paddingBottom: 0 }, ['bottom'], INSETS)).toEqual({
      paddingBottom: 0,
    })
    expect(applySafeAreaPadding({ paddingVertical: 8 }, ['bottom'], INSETS)).toEqual({
      paddingVertical: 8,
    })
    expect(applySafeAreaPadding({ padding: 12 }, ['bottom'], INSETS)).toEqual({ padding: 12 })
  })

  it('数组样式先展平再判重(不能因为包了一层数组就当成没写)', () => {
    const style = [{ marginTop: 3 }, { paddingBottom: 6 }]
    expect(applySafeAreaPadding(style, ['bottom'], INSETS)).toEqual({
      marginTop: 3,
      paddingBottom: 6,
    })
  })

  it('edges 只按点名方向补;其余键原样保留', () => {
    expect(applySafeAreaPadding({ marginTop: 3, flex: 1 }, ['top', 'bottom'], INSETS)).toEqual({
      marginTop: 3,
      flex: 1,
      paddingBottom: 34,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
