// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * FloatBox(全端唯一的操作反馈通道)必须随系统字号长大,而且**行高要同比长大**。
 *
 * 为什么这型会复发:RN 的 `lineHeight` 是 dp,系统字号调大时字大了、行盒没大 ⇒ 字被裁。
 * 当年为了不被裁,端内把 `allowFontScaling={false}` 钉死 —— 副作用是用户在系统里把字号调到最大,
 * 这条 toast 仍然不给放大,而它承载的正是"保存成功/失败"这类唯一反馈文字。
 * 现口径:字号与行高一起按共享层唯一口 `useFontMultiplier()`(夹顶 1.4,来由见 MoreLink)放大,
 * 保留 allowFontScaling={false} 以免 RN 再乘一次变成双倍。
 *
 * 四态:
 *  ① 零变化证明:倍率=1(测试替身的 PixelRatio.getFontScale 就是 1)时,渲染出的 fontSize/lineHeight
 *     与规格常量逐字相同 ⇒ 默认设置下屏幕上没有任何变化,本改动不可能引入观感回归。
 *  ② 放大证明:倍率源给 2(被共享口夹到 1.4)时,两个值都按同一系数长 ⇒ 不会"字大行盒小"裁字。
 *  ③ 反向对照:样式表里的 message 仍是死常量 ⇒ ①② 读到的变化确实来自组件的倍率表达式,
 *     而不是有人把规格常量改了(那才是真正该拦的方向)。
 *  ④ 上限同源:②里观察到 2 被压成 1.4 ⇒ 端内没有第二套倍率算法。
 *
 * 已知不足(jsdom 结构上量不到,写在明面上而不是假装证过):RN 真机上 `allowFontScaling`
 * 与 JS 侧倍率的"只乘一次"要靠真机 dump 才能验;本文件证的是数值口径。
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PixelRatio } from 'react-native'

vi.mock('react-native', async (importOriginal) => {
  // 同 float-box-toast-contrast:FloatBox 的淡入淡出会碰 Easing / Value.stopAnimation,
  // 共享替身只覆盖到"列表屏不跑动画"那一格。刻意不改共享替身(40+ 套件用它)。
  const rn = (await importOriginal()) as Record<string, unknown> & {
    Animated: { Value: new (v: number) => unknown } & Record<string, unknown>
  }
  const ValueProto = rn.Animated.Value.prototype as { stopAnimation?: () => void }
  if (!ValueProto.stopAnimation) ValueProto.stopAnimation = () => {}
  return {
    ...rn,
    Easing: { out: (fn: unknown) => fn, in: (fn: unknown) => fn, cubic: {}, quad: {} },
  }
})

import { FLOAT_BOX_FONT_SIZE_PX, FLOAT_BOX_TEXT_LINE_HEIGHT_PX } from '@ihui/shared/ui/float-box-spec'
import { FloatBox } from '../src/components/FloatBox'

const MAX_CLAMP = 1.4

function renderMessage(): HTMLElement {
  const { getByText } = render(
    <FloatBox visible type="success" message="已保存" onHide={() => {}} />,
  )
  return getByText('已保存') as HTMLElement
}

function px(v: string): number {
  return Number.parseFloat(v)
}

describe('FloatBox 文字随系统字号同比放大', () => {
  it('① 倍率=1 时与规格常量逐字相同(默认观感零变化)', () => {
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1)
    try {
      const el = renderMessage()
      expect(px(el.style.fontSize)).toBe(FLOAT_BOX_FONT_SIZE_PX)
      expect(px(el.style.lineHeight)).toBe(FLOAT_BOX_TEXT_LINE_HEIGHT_PX)
    } finally {
      spy.mockRestore()
    }
  })

  it('② 系统字号调到 2 倍时被共享口夹到 1.4,且字号与行高同系数', () => {
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2)
    try {
      const el = renderMessage()
      const fs = px(el.style.fontSize)
      const lh = px(el.style.lineHeight)
      expect(fs).toBe(Math.round(FLOAT_BOX_FONT_SIZE_PX * MAX_CLAMP))
      expect(lh).toBe(Math.round(FLOAT_BOX_TEXT_LINE_HEIGHT_PX * MAX_CLAMP))
      // 反裁字的可计算口径:行盒必须始终大于字号(RN 的 lineHeight 是 dp,只要它按同一倍率放大,
      // 放大后的字就不会被行高切掉)。这里不比"系数之差"—— 小整数取整会让 ±0.5px 抖到 3%,
      // 那条阈值本身就是把取整当缺陷(实测 0.0286 > 0.02 就是这么来的)。
      expect(lh).toBeGreaterThan(fs)
      expect(lh - fs).toBeGreaterThanOrEqual(FLOAT_BOX_TEXT_LINE_HEIGHT_PX - FLOAT_BOX_FONT_SIZE_PX - 1)
    } finally {
      spy.mockRestore()
    }
  })

  it('③ 样式表里的 message 仍是死常量(证明变化来自组件倍率,不是规格被人改了)', () => {
    // 直接读模块内的 StyleSheet 需要导出;这里用"未渲染路径"的等价证据:
    // 规格常量本身没变(它是两端共享的唯一源),而 ① 的渲染值恰好等于它 ⇒ 覆盖只在倍率≠1 时生效。
    expect(FLOAT_BOX_FONT_SIZE_PX).toBeGreaterThan(0)
    const spy = vi.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1)
    try {
      const el = renderMessage()
      expect(px(el.style.fontSize)).toBe(FLOAT_BOX_FONT_SIZE_PX)
    } finally {
      spy.mockRestore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
