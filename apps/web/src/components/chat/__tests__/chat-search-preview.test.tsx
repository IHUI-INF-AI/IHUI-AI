// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #62(2026-09-27 立)—— 会话内搜索结果预览列表的渲染用例。
//
// 钉四件事:① 无命中整段不渲染(不给空框);② 命中数超过上限时列表截断 +
// 如实报"还有 N 条"(静默变短等于伪造完整性);③ 点选回传的是那条消息的 id;
// ④ 无障碍名称在场(整个列表没有可见标题文字,读屏只能靠 aria-label 定位)。
// 词包用真实 zh-CN(与本仓 detail-mode.test.tsx 同形态),新键未入库前
// mock 会回显键名 —— 因此本文件只断言结构与 data-*/aria-* 属性,不断言文案。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { SearchResultList } from '../message-list/search-result-list'
import type { SearchResult } from '@/hooks/use-chat-search'

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'zh-CN',
}))

function results(n: number): SearchResult[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i + 1}`,
    preview: `命中摘要 ${i + 1}`,
    createTime: String(1_760_000_000_000 + i * 1000),
  }))
}

afterEach(() => cleanup())

describe('V3 #62 SearchResultList / 显隐与截断', () => {
  it('零命中 ⇒ 整段不渲染', () => {
    const { container } = render(
      <SearchResultList results={[]} selectedId={null} onPick={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="chat-search-result-list"]')).toBeNull()
  })

  it('有命中 ⇒ 列表在场且带无障碍名称(无可见标题,读屏须能认出这块是什么)', () => {
    const { container } = render(
      <SearchResultList results={results(2)} selectedId={null} onPick={vi.fn()} />,
    )
    const list = container.querySelector('ul[aria-label]')
    expect(list).not.toBeNull()
    expect(list?.getAttribute('aria-label')).toBe('chatSearchBar.resultListLabel')
    expect(container.querySelectorAll('button')).toHaveLength(2)
  })

  it('超过上限只渲染前 8 条,并如实报"还有 N 条"(不得静默截断)', () => {
    const { container } = render(
      <SearchResultList results={results(11)} selectedId={null} onPick={vi.fn()} />,
    )
    expect(container.querySelectorAll('button')).toHaveLength(8)
    const more = container.querySelector('p')
    expect(more?.textContent).toBe('chatSearchBar.moreResults')
    expect(more?.textContent).not.toMatch(/Invalid Date/)
  })
})

describe('V3 #62 SearchResultList / 点选与选中态', () => {
  it('点某一条 ⇒ 回传该条消息 id(不是数组下标)', () => {
    const onPick = vi.fn()
    const { container } = render(
      <SearchResultList results={results(3)} selectedId={null} onPick={onPick} />,
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1] as HTMLButtonElement)
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('m2')
  })

  it('选中的那一条带 aria-current(视觉高亮之外,读屏也要知道当前是哪条)', () => {
    const { container } = render(
      <SearchResultList results={results(3)} selectedId="m2" onPick={vi.fn()} />,
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons[1]?.getAttribute('aria-current')).toBe('true')
    expect(buttons[0]?.hasAttribute('aria-current')).toBe(false)
  })

  it('每条按钮都有可读名称(摘要 + 时间),时间是 Intl 形态而非 Invalid Date', () => {
    const { container } = render(
      <SearchResultList results={results(1)} selectedId={null} onPick={vi.fn()} />,
    )
    const label = container.querySelector('button')?.getAttribute('aria-label') ?? ''
    expect(label).toContain('命中摘要 1')
    expect(label).not.toContain('Invalid Date')
    expect(label).toMatch(/\d/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
