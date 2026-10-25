// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 分类栏收口(台账「RN 分类栏统一收口」)的取证:渲染 / 切换 / 选中态 / 滚入视野时序。
//
// 收口后的结构是:一份平台无关核心(category-bar-core)+ 一份 RN 原语注入(rn-primitives)
// + 形态 A 横滑条 / 形态 B 下拉窗两个壳。因此这里既钉形态 A 的用户可见行为,也直接钉核心的
// 滚动时序 —— 后者无法从 DOM 判定(FlatList 替身没有 scrollToIndex,ref 落到的 div 上也没有),
// 只能对核心 hook 做受控渲染,断言"滚不滚、滚到第几项"。
import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { CategoryInlineBar } from '../../../packages/app/src/components/category/CategoryInlineBar'
import { CategoryDropdown } from '../../../packages/app/src/components/category/CategoryDropdown'
import { getTokens } from '../../../packages/app/src/theme/tokens'
import {
  categoryItemA11yLabel,
  useCategorySelectedIndex,
  useScrollCategoryIntoView,
} from '../../../packages/app/src/components/category/category-bar-core'
import type { CategoryItem } from '../../../packages/app/src/components/category/types'

const ITEMS: CategoryItem[] = [
  { id: 'a', label: 'AAA' },
  { id: 'b', label: 'BBB' },
  { id: 'c', label: 'CCC' },
]

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

/** 取某个文案节点上真正落到的 `color`(React DOM 把 RN style 摊成内联样式)。 */
const colorOfLabel = (container: HTMLElement, label: string): string => {
  const el = Array.from(container.querySelectorAll<HTMLElement>('[style]')).find(
    (n) => n.textContent === label && n.style.color !== '',
  )
  return el?.style.color ?? ''
}

const bgColors = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[style]'))
    .map((el) => el.style.backgroundColor)
    .filter((v) => v !== '')

function StatefulBar({ items = ITEMS }: { items?: CategoryItem[] }) {
  const [selectedId, setSelectedId] = useState('a')
  return (
    <CategoryInlineBar
      items={items.map((i) => ({ ...i }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  )
}

describe('分类栏渲染(形态 A)', () => {
  it('全部 chip 与计数徽章都落到节点上(不是空壳)', () => {
    const { container } = render(
      <CategoryInlineBar
        items={[...ITEMS, { id: 'd', label: 'DDD', count: 7 }]}
        selectedId="a"
        onSelect={() => {}}
      />,
    )
    expect(container.textContent).toContain('AAA')
    expect(container.textContent).toContain('BBB')
    expect(container.textContent).toContain('CCC')
    // 计数走尾槽,与文案同一条 chip(收口前这段结构在两个形态里各抄一遍)
    expect(container.textContent).toContain('DDD')
    expect(container.textContent).toContain('7')
  })

  it('无障碍名称:显式 a11yLabel 优先,缺省复用可见文案(不拼后缀)', () => {
    expect(categoryItemA11yLabel({ id: 'x', label: 'VISIBLE', a11yLabel: 'A11Y' })).toBe('A11Y')
    expect(categoryItemA11yLabel({ id: 'x', label: 'VISIBLE' })).toBe('VISIBLE')
  })
})

describe('分类栏交互(形态 A)', () => {
  it('点击未选中 chip → onSelect(id),选中态随之迁移(底色 + 字色成对)', () => {
    const onSelect = vi.fn()
    const { container, getByText } = render(
      <CategoryInlineBar items={ITEMS} selectedId="a" onSelect={onSelect} />,
    )
    const tk = getTokens('light')
    expect(colorOfLabel(container, 'BBB')).toBe(rgbOf(tk.text.secondary))

    fireEvent.click(getByText('BBB'))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('受控切换:选中态从 AAA 迁到 BBB,两边的字色同时换档', () => {
    const { container, getByText } = render(<StatefulBar />)
    const tk = getTokens('light')
    expect(colorOfLabel(container, 'AAA')).toBe(rgbOf(tk.brand.ctaForeground))
    expect(colorOfLabel(container, 'BBB')).toBe(rgbOf(tk.text.secondary))

    fireEvent.click(getByText('BBB'))
    expect(colorOfLabel(container, 'AAA')).toBe(rgbOf(tk.text.secondary))
    expect(colorOfLabel(container, 'BBB')).toBe(rgbOf(tk.brand.ctaForeground))
    // 选中底仍走 brand.cta(与字色成对;单独改一头这里当场红)
    expect(bgColors(container)).toContain(rgbOf(tk.brand.cta))
  })

  it('形态 B 复用同一核心:面板选项的选中项同时落底与加粗', () => {
    const tk = getTokens('light')
    const { container } = render(
      <CategoryDropdown items={ITEMS} selectedId="b" onSelect={() => {}} visible hideTrigger />,
    )
    expect(container.textContent).toContain('AAA')
    expect(container.textContent).toContain('CCC')
    expect(bgColors(container)).toContain(rgbOf(tk.brandAccent.light))
  })
})

const scrollSpy = vi.fn()

function ScrollHarness({
  items,
  selectedId,
  scrollTo = scrollSpy,
}: {
  items: CategoryItem[]
  selectedId: string | null
  scrollTo?: (index: number) => void
}) {
  const index = useCategorySelectedIndex(items, selectedId)
  useScrollCategoryIntoView(index, scrollTo)
  return <span data-testid="index">{index}</span>
}

describe('分类栏滚动(核心时序)', () => {
  it('选中项滚入视野:首次滚到选中下标;items 换身份但不换选中项时不再滚', () => {
    scrollSpy.mockClear()
    const { rerender } = render(<ScrollHarness items={ITEMS} selectedId="b" />)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenLastCalledWith(1)

    // 父层一次 setState 生成新数组 —— 这是「每轮把条拽回选中项」那一型 bug 的触发条件
    rerender(<ScrollHarness items={ITEMS.map((i) => ({ ...i }))} selectedId="b" />)
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    // 选中项真的变了才再滚
    rerender(<ScrollHarness items={ITEMS.map((i) => ({ ...i }))} selectedId="c" />)
    expect(scrollSpy).toHaveBeenCalledTimes(2)
    expect(scrollSpy).toHaveBeenLastCalledWith(2)
  })

  it('selectedId 为 null 时下标 -1,且不发起滚动', () => {
    scrollSpy.mockClear()
    const { getByTestId } = render(<ScrollHarness items={ITEMS} selectedId={null} />)
    expect(getByTestId('index').textContent).toBe('-1')
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('未布局完成时 scrollTo 抛错被吞掉(挂载不崩)', () => {
    const boom = () => {
      throw new Error('scrollToIndex unavailable')
    }
    expect(() =>
      render(<ScrollHarness items={ITEMS} selectedId="a" scrollTo={boom} />),
    ).not.toThrow()
  })
})
