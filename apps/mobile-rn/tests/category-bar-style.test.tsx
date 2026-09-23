// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 统一分类条的"选中态到底有没有落色"取证。
//
// 起因:2026-09-23 真机 release 包像素直方图实测到选中 chip 前景 = 深色 ctaText #16262E,
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
  it('深色档:选中 chip 有 ctaFill 底 + ctaText 字,二者成对出现', () => {
    const tk = getTokens('dark')
    const { container } = render(
      <CategoryInlineBar
        items={ITEMS.map((i) => ({ ...i }))}
        selectedId=""
        onSelect={() => {}}
        colorScheme="dark"
      />,
    )
    const fill = rgbOf(tk.brand.ctaFill)
    const text = rgbOf(tk.brand.ctaText)

    expect(bgColors(container)).toContain(fill)
    expect(textColors(container)).toContain(text)
    // 反向对照:选中态底色绝不能等于弹层/页面容器底色,否则就是真机那次"深字压深底"
    expect(fill).not.toBe(rgbOf(tk.surface.card))
    expect(fill).not.toBe(rgbOf(tk.surface.bg))
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

  it('浅色档同样成对,且不随主题翻成纯白底纯白字', () => {
    const tk = getTokens('light')
    const { container } = render(
      <CategoryInlineBar
        items={ITEMS.map((i) => ({ ...i }))}
        selectedId="tech"
        onSelect={() => {}}
        colorScheme="light"
      />,
    )
    expect(bgColors(container)).toContain(rgbOf(tk.brand.ctaFill))
    expect(textColors(container)).toContain(rgbOf(tk.brand.ctaText))
  })

  it('空 items 不渲染任何节点(占位归调用方)', () => {
    const { container } = render(
      <CategoryInlineBar items={[]} selectedId={null} onSelect={() => {}} colorScheme="dark" />,
    )
    expect(container.innerHTML).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
