// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * FloatBox toast 的"语义色底 × 白字"配对回归(2026-11 改版:统一对齐 web sonner richColors)。
 *
 * 旧版(固定深底 rgba(0,0,0,0.85) + 浅字)的坑:前景取了随主题翻转的档,深色档案下整条文案隐形,
 * 屏幕上只剩状态图标坐在黑块里。2026-11 改为**按 type 的语义色实底 + 恒白前景**,既消除
 * "深色模式看不见字",又让 RN 的弹窗与 web 的彩色 sonner 一致。
 *
 * 判法:把"文字能不能读"变成一个算得出的数(WCAG 相对亮度比),并用渲染面证明这个值
 * 真的挂到了那个文字节点与容器上(不是只存在于常量里)。四态:
 *  ① 装车证明:每种 type 的 message 节点 color == 该型 fg,容器 backgroundColor == 该型 bg;
 *  ② 判据:该型 fg 对 bg 的对比 ≥ 4.5:1(底为实色不透明,无需再叠页面合成);
 *  ③ 不变量:四种底都足够暗(相对亮度 < 0.2),不会回到"深色模式看不见字";
 *  ④ 向后兼容:FLOAT_BOX_TOAST_SURFACE 仍指向 info 面。
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

/**
 * 本端共享的 react-native 替身只覆盖到"列表屏不跑动画"的那一格:`Animated.timing` 是
 * `() => ({ start: () => {} })`,既没有 `Easing`,`Value` 也没有 `stopAnimation` ——
 * 而 FloatBox 的滑入/滑出两条都会碰。刻意**不改共享替身**(它被 40+ 套件用,加一项就是
 * 给别人的套件换地基),在本文件内做一层"替身的替身":先取同一份实现,只补这两格。
 */
vi.mock('react-native', async (importOriginal) => {
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
  floatBoxSurface,
  FloatBox,
  type FloatBoxType,
} from '../src/components/FloatBox'

const WCAG_BODY_MIN = 4.5

/** #RGB / #RRGGBB → [r,g,b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
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

function cssColor(value: string): string {
  const [r, g, b] = hexToRgb(value)
  return `rgb(${r}, ${g}, ${b})`
}

const TYPES: FloatBoxType[] = ['success', 'error', 'warning', 'info']

describe('FloatBox 语义色底×白字配对(任意页面/主题下 ≥4.5:1)', () => {
  for (const type of TYPES) {
    it(`① 装车:${type} 的成对常量真的挂到了 message 与容器上`, () => {
      const { getByText, container } = render(
        <FloatBox visible type={type} message="登录已过期,请重新登录" duration={3000} />,
      )
      const el = getByText('登录已过期,请重新登录')
      expect(el.style.color).toBe(cssColor(floatBoxSurface(type).fg))
      // 底色挂在容器上(RN 替身把 style 摊成 jsdom 内联样式,颜色会被规范化,
      // 所以比对时抹掉空白 —— 空格差异是序列化格式,不是取值差异)
      const norm = (v: string): string => v.replace(/\s+/g, '')
      const bgs = Array.from(container.querySelectorAll<HTMLElement>('[style]'))
        .map((n) => norm(n.style.backgroundColor))
        .filter((v) => v !== '')
      // 底色常量是 hex,jsdom 会把内联样式规范化成 rgb(...),故先转成同一形态再比。
      expect(bgs).toContain(norm(cssColor(floatBoxSurface(type).bg)))
    })

    it(`② 判据:${type} 前景对底色 ≥ 4.5:1`, () => {
      const ratio = contrast(hexToRgb(floatBoxSurface(type).fg), hexToRgb(floatBoxSurface(type).bg))
      expect(ratio, `type=${type} 对比 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_BODY_MIN)
    })
  }

  it('③ 不变量:四种底都足够暗(亮度 < 0.2),不会回到"深色模式看不见字"', () => {
    for (const type of TYPES) {
      expect(luminance(hexToRgb(floatBoxSurface(type).bg)), `type=${type}`).toBeLessThan(0.2)
    }
  })

  it('④ 向后兼容:FLOAT_BOX_TOAST_SURFACE 仍指向 info 面', () => {
    expect(FLOAT_BOX_TOAST_SURFACE).toEqual(floatBoxSurface('info'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
