// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 装车证明:搜索面板段间「既不画线,也不留占位空 div」(AGENTS.md §4 禁纯分隔线,
// 该条给的替代口径正是 space-y-*)——段间节奏唯一来源 = SearchBar 传给面板容器的间距档。
// 断言面(裸 DOM 匹配器,本包未装 @testing-library/jest-dom):
// ① search-suggestions 模块不得再导出 SectionDivider(线或 spacer 一旦回来就红);
// ② SearchBar 的面板容器必须自带 space-y-* 节奏,且直接子节点**只有**两个 role="group" 分段
//    —— 多一个裸节点(占位 div)就红,段间节点带发丝尺寸 h-px/w-px、背景色档 bg-*、
//    单边描边 border-*、divide-* 也红(§4「段间不得再出现任何背景线/单边 border」的锁);
// ③ 分组语义由 role="group" + 与可见段标题同文的无障碍名承载,面板内不得有 separator 角色;
// ④ 去掉线/占位节点后,词条行点击链路仍通。
// 用例不写中文文案字面量:无障碍名一律与 DOM 里真实渲染出的标题文本对照(§19 语种纯度不受影响)。
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (_ns: string) => (key: string) => key,
}))

// 搜索框与浮层定位属 DOM 基建,不在本票射程:
// SearchInput 退化成受控 input(只为能 fireEvent.focus 打开面板);
// PortalPanel 只保留「open 才渲染内容 + className 原样落在容器上」这一契约,
// 于是段间节奏与直接子节点结构可在真实生产接线上判(而非夹具里手写死的 class)。
vi.mock('@ihui/ui-react', () => ({
  SearchInput: ({
    value,
    onChange,
    onFocus,
    placeholder,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onFocus?: () => void
    placeholder?: string
  }): React.ReactElement => (
    <input
      type="search"
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      placeholder={placeholder}
      data-testid="search-input"
    />
  ),
}))

vi.mock('@/components/feedback/portal-panel', () => ({
  PortalPanel: ({
    open,
    className,
    children,
  }: {
    open?: boolean
    className?: string
    children?: React.ReactNode
  }): React.ReactElement | null =>
    open ? (
      <div data-testid="search-panel" className={className}>
        {children}
      </div>
    ) : null,
}))

import * as SearchSuggestions from '../search-suggestions'
import { HistorySection, PopularSection } from '../search-suggestions'
import { SearchBar } from '../SearchBar'

/** 段间节点的合法形状:只有分组本身,不带任何"线"的书写形态 */
const HAIRLINE_OR_BORDER_CLASS = /h-px|w-px|(^|\s)bg-|(^|\s)border-|(^|\s)divide-/

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('search-suggestions 段间分隔', () => {
  it('占位节点已退役:模块不再导出 SectionDivider', () => {
    expect(Object.prototype.hasOwnProperty.call(SearchSuggestions, 'SectionDivider')).toBe(false)
  })

  it('SearchBar 面板容器:节奏来自 space-y-*,段间无第三种节点/线/单边 border', () => {
    render(<SearchBar history={['alpha']} suggestions={[]} />)
    fireEvent.focus(screen.getByTestId('search-input'))

    const panel = screen.getByTestId('search-panel')
    // 节奏来源必须显式存在(删掉占位节点后不能靠段标题自己凑出来的巧合间距)
    expect(panel.className).toMatch(/(^|\s)space-y-\d/)

    const sections = Array.from(panel.children) as HTMLElement[]
    expect(sections).toHaveLength(2)
    for (const section of sections) {
      // 直接子节点只能是有名字的分组;裸 spacer/线节点一律红
      expect(section.getAttribute('role')).toBe('group')
      expect(section.className).not.toMatch(HAIRLINE_OR_BORDER_CLASS)
    }
    expect(panel.querySelector('hr')).toBeNull()
    expect(panel.querySelectorAll('[role="separator"]')).toHaveLength(0)
  })

  it('两段并列时分组语义由 role=group + 同文无障碍名承载,且面板内无 separator', () => {
    render(
      <div>
        <HistorySection items={['alpha']} onItemClick={() => {}} />
        <PopularSection items={['beta']} onItemClick={() => {}} />
      </div>,
    )

    const groups = screen.getAllByRole('group')
    expect(groups).toHaveLength(2)
    for (const group of groups) {
      const visibleLabel = group.querySelector('span')
      expect(visibleLabel).not.toBeNull()
      // 无障碍名必须等于这一组自己渲染出来的段标题文本
      expect(group.getAttribute('aria-label')).toBe(visibleLabel?.textContent)
      expect(group.getAttribute('aria-label')).not.toBeNull()
    }
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('每段内的词条行仍可点击(去线不影响交互链路)', () => {
    const clicked: string[] = []
    render(
      <div>
        <HistorySection items={['alpha']} onItemClick={(v) => clicked.push(v)} />
        <PopularSection items={['beta']} onItemClick={(v) => clicked.push(v)} />
      </div>,
    )

    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(2)
    rows[0]?.click()
    rows[1]?.click()
    expect(clicked).toEqual(['alpha', 'beta'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
