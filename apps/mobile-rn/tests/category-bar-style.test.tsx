// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 统一分类条的"选中态到底有没有落色"取证。
//
// 起因:2026-09-23 真机 release 包像素直方图实测到选中 chip 前景 = 深色 brand.foreground #16262E,
// 而底色仍是容器同色 #1A1A1A —— 也就是 itemTextActive 生效、itemActive 没生效,选中态看不见。
// 手机不在线上时,这条测试是同一判据的可重复版本:vitest 的 react-native stub 会把 style
// 对象透传成 jsdom 内联样式(dark-mode.test.tsx 已依赖该性质),因此"颜色有没有挂到元素上"
// 在本地就能判红/判绿,不需要等设备。
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { CategoryInlineBar } from '../../../packages/app/src/components/category/CategoryInlineBar'
import { getTokens } from '../../../packages/app/src/theme/tokens'

const ITEMS = [
  { id: '', label: 'ALL' },
  { id: 'tech', label: 'TECH' },
] as const

const rgbOf = (hex: string): string => {
  const v = hex.replace('#', '')
  const n =
    v.length === 3
      ? v
          .split('')
          .map((c) => c + c)
          .join('')
      : v
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`
}

const bgColors = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[style]'))
    .map((el) => el.style.backgroundColor)
    .filter((v) => v !== '')

const textColors = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[style]'))
    .map((el) => el.style.color)
    .filter((v) => v !== '')

describe('CategoryInlineBar 选中态配色真的落到元素上', () => {
  it('深色档:选中 chip 有 brand.cta 底 + brand.ctaForeground 字,二者成对出现', () => {
    const tk = getTokens('dark')
    const { container } = render(
      <CategoryInlineBar
        items={ITEMS.map((i) => ({ ...i }))}
        selectedId=""
        onSelect={() => {}}
        colorScheme="dark"
      />,
    )
    // 档位 = AGENTS §4 的 2026-09-24 定稿:主 CTA 唯一写法是 brand.cta(底)+ brand.ctaForeground(字)。
    // 本文件此前断言的是旧档 brand.DEFAULT/foreground —— 组件已迁走而测试没跟着改,于是
    // "按规矩写"的组件在这里恒红(而守门 83 的 R1/R3/R5 认 cta 配对合法,两边都不红的那一型)。
    const fill = rgbOf(tk.brand.cta)
    const text = rgbOf(tk.brand.ctaForeground)

    expect(bgColors(container)).toContain(fill)
    expect(textColors(container)).toContain(text)
    // 反向对照:选中态底色绝不能等于弹层/页面容器底色,否则就是真机那次"深字压深底"
    expect(fill).not.toBe(rgbOf(tk.surface.card))
    expect(fill).not.toBe(rgbOf(tk.surface.bg))
    // 前景同样不得掉回容器档(白底白字/深底深字两种形态都在这里被拦住)
    expect(text).not.toBe(rgbOf(tk.surface.card))
    expect(text).not.toBe(rgbOf(tk.surface.bg))
  })

  it('深色档:未选中 chip 底色与容器不同档(否则整条没有可点性)', () => {
    const tk = getTokens('dark')
    const { container } = render(
      <CategoryInlineBar
        items={ITEMS.map((i) => ({ ...i }))}
        selectedId=""
        onSelect={() => {}}
        colorScheme="dark"
      />,
    )
    const idle = rgbOf(tk.surface.muted)
    expect(bgColors(container)).toContain(idle)
    expect(idle).not.toBe(rgbOf(tk.surface.card))
  })

  it('浅色档同样成对,且 cta 档明暗同值(不随主题翻成纯白底纯白字)', () => {
    const tk = getTokens('light')
    const { container } = render(
      <CategoryInlineBar
        items={ITEMS.map((i) => ({ ...i }))}
        selectedId="tech"
        onSelect={() => {}}
        colorScheme="light"
      />,
    )
    expect(bgColors(container)).toContain(rgbOf(tk.brand.cta))
    expect(textColors(container)).toContain(rgbOf(tk.brand.ctaForeground))
    // "不随主题反转"是 cta 档的定义(§4:明暗同值 #4A7A96 / #FFFFFF),旧档 brand.DEFAULT 恰恰
    // 会反转(亮=纯黑/暗=纯白)。把它写成判据:谁给某一侧单独改色,这里当场红 ——
    // 否则"浅色一大片黑 / 深色一大片白"那笔账会被重新记回主 CTA。
    const dark = getTokens('dark')
    expect(rgbOf(dark.brand.cta)).toBe(rgbOf(tk.brand.cta))
    expect(rgbOf(dark.brand.ctaForeground)).toBe(rgbOf(tk.brand.ctaForeground))
    expect(rgbOf(tk.brand.cta)).not.toBe(rgbOf(tk.surface.bg))
  })

  it('空 items 不渲染任何节点(占位归调用方)', () => {
    const { container } = render(
      <CategoryInlineBar items={[]} selectedId={null} onSelect={() => {}} colorScheme="dark" />,
    )
    expect(container.innerHTML).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
