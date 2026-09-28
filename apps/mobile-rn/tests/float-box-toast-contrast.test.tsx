// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * FloatBox toast 的"底色 × 前景"配对回归(2026-09-28 立)。
 *
 * 用户实拍:广场首屏错误提示是「纯黑方块内一个红叉」，读不到字。
 * 归因不在图标、也不在守门 83 那一型(它判的是 brand 实底 × 浅色前景 / 浅色当容器底;
 * 这里的底是**固定** rgba(0,0,0,0.85)，不随主题翻转)。真因是**前景取了随主题翻转的档**:
 * `TEXT_COLOR = tokens.surface.light`，而 `surface.light` 在深色档案里是 #262626 ——
 * 85% 黑压在深色页面底 #242424 上合成 ≈ rgb(5,5,5)，压在白卡片上合成 ≈ rgb(38,38,38)
 * = 与字色同一个值 ⇒ 深色档案下整条文案隐形，屏幕上只剩状态图标坐在黑块里。
 *
 * 判法:把"文字能不能读"变成一个算得出的数(WCAG 相对亮度比)，并用渲染面证明这个值
 * 真的挂到了那个文字节点上(不是只存在于常量里)。三态:
 *  ① 装车证明:渲染出来的 message 节点 color == 成对常量 fg，容器 backgroundColor == 成对常量 bg。
 *  ② 判据:该前景对**两种页面底层**(深色页 #242424 / 白卡片 #FFFFFF)合成后的底都 ≥ 4.5:1。
 *  ③ 缺陷对照:把旧取法(surface.light)按同一把尺子量 ⇒ 深色档案必然 < 4.5:1 ——
 *     这条既证明"缺陷曾经可达"，也证明本判据不是"给任何颜色都放行"的空尺子。
 *  ④ 不变量:前景所在档在两态**同值**(这才是"固定深底配固定亮字"的形式定义)，
 *     而 surface.light 两态**异值**(所以它是这一型的陷阱档，不得再用作 toast 前景)。
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

/**
 * 本端共享的 react-native 替身只覆盖到"列表屏不跑动画"的那一格:`Animated.timing` 是
 * `() => ({ start: () => {} })`,既没有 `Easing`,`Value` 也没有 `stopAnimation` ——
 * 而 FloatBox 的淡入淡出两条都会碰。刻意**不改共享替身**(它被 40+ 套件用,加一项就是
 * 给别人的套件换地基),在本文件内做一层"替身的替身":先取同一份实现,只补这两格。
 */
vi.mock('react-native', async (importOriginal) => {
  // 走 importOriginal 而不是 `await import('./__mocks__/react-native')`:后者是一条**穿过
  // resolve.alias 落到仓内 .ts 源**的动态导入,不经 vite 变换层 ⇒ Node 直接吃 TS,在
  // `export type RnTokens = typeof rnTokens` 那一类位置抛 SyntaxError(本文件第一次落盘时
  // 整套件 0 用例、头条只写 "1 failed",正是守门 114 要防的收集期失明)。
  const rn = (await importOriginal()) as unknown as {
    Animated: { Value: new (v: number) => unknown } & Record<string, unknown>
    [k: string]: unknown
  }
  const ValueProto = rn.Animated.Value.prototype as { stopAnimation?: () => void }
  if (!ValueProto.stopAnimation) ValueProto.stopAnimation = () => {}
  return {
    ...rn,
    Easing: { out: (fn: unknown) => fn, in: (fn: unknown) => fn, cubic: {}, quad: {} },
  }
})

import {
  FLOAT_BOX_TOAST_SURFACE,
  FloatBox,
} from '../src/components/FloatBox'
import { rnDarkTokens, rnLightTokens } from '@ihui/design-tokens'

const WCAG_BODY_MIN = 4.5

/** #RGB / #RRGGBB → [r,g,b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

/** rgba(0,0,0,0.85) 压在某个不透明底层上的合成色(浮层是半透明的,所以必须先把底算出来) */
function compositeOver(underHex: string, overlayAlpha = 0.85): [number, number, number] {
  const [r, g, b] = hexToRgb(underHex)
  const k = 1 - overlayAlpha
  return [k * r, k * g, k * b]
}

function luminance(rgb: [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = rgb
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function fgVsToastBg(fgHex: string, pageUnder: string): number {
  return contrast(hexToRgb(fgHex), compositeOver(pageUnder))
}

function cssColor(value: string): string {
  const [r, g, b] = hexToRgb(value)
  return `rgb(${r}, ${g}, ${b})`
}

describe('FloatBox toast 底色×前景配对(深色档案下文案必须仍可读)', () => {
  it('① 装车:成对常量真的挂到了 message 节点与容器上', () => {
    const { getByText, container } = render(
      <FloatBox visible type="error" message="登录已过期,请重新登录" duration={3000} />,
    )
    const el = getByText('登录已过期,请重新登录')
    expect(el.style.color).toBe(cssColor(FLOAT_BOX_TOAST_SURFACE.fg))
    // 底色挂在再外层的容器上(RN 替身把 style 摊成 jsdom 内联样式,颜色会被规范化,
    // 所以比对时抹掉空白 —— 空格差异是序列化格式,不是取值差异)
    const norm = (v: string): string => v.replace(/\s+/g, '')
    const bgs = Array.from(container.querySelectorAll<HTMLElement>('[style]'))
      .map((n) => norm(n.style.backgroundColor))
      .filter((v) => v !== '')
    expect(bgs).toContain(norm(FLOAT_BOX_TOAST_SURFACE.bg))
  })

  it('② 判据:前景对每一种页面底层都 ≥ 4.5:1(深色页与白卡片两头)', () => {
    for (const under of [rnDarkTokens.surface.bg, rnLightTokens.surface.card]) {
      const ratio = fgVsToastBg(FLOAT_BOX_TOAST_SURFACE.fg, under)
      expect(ratio, `底 = ${under} 时对比 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_BODY_MIN)
    }
  })

  it('③ 缺陷对照:旧取法 surface.light 在深色档案下 < 4.5:1(证明缺陷可达、判据有牙)', () => {
    const darkRatio = fgVsToastBg(rnDarkTokens.surface.light, rnDarkTokens.surface.bg)
    expect(darkRatio).toBeLessThan(WCAG_BODY_MIN)
    // 而同一档在浅色档案是够的 —— 这就是"只在深色模式复现、长期没人归因到色档"的机制。
    const lightRatio = fgVsToastBg(rnLightTokens.surface.light, rnLightTokens.surface.bg)
    expect(lightRatio).toBeGreaterThanOrEqual(WCAG_BODY_MIN)
  })

  it('④ 不变量:前景档两态同值;surface.light 两态异值(所以它不配当固定深底的前景)', () => {
    expect(rnLightTokens.gray[50]).toBe(rnDarkTokens.gray[50])
    expect(FLOAT_BOX_TOAST_SURFACE.fg).toBe(rnLightTokens.gray[50])
    expect(rnLightTokens.surface.light).not.toBe(rnDarkTokens.surface.light)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
