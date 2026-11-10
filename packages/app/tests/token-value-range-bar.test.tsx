// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// TokenValue 共享屏「记录时间范围条」注入点锁。
//
// 立因: 范围条原在 RN 壳页内(apps/mobile-rn/src/screens/TokenValueScreen.tsx)自绘,
// 页内业务 JSX 5 段;下沉共享屏后由数据型注入点三件套驱动:
//   rangeItems(选项) + rangeId(当前) + onSelectRange(回调)。
// 判据落在渲染结果与 props 对上:
//   ① 三件套齐备 ⇒ 范围条渲染,选项标签/选中值/内容内边距/配色逐个匹配,点击回调接上
//   ② 缺 onSelectRange ⇒ 范围条不渲染(阴性对照,证明不是「有 items 就画」)
//   ③ 缺 rangeItems ⇒ 范围条不渲染(阴性对照)
//   ④ 不传注入点 ⇒ 记录类型条与记录行照旧渲染(迁移前行为回归)

import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: (p: { label: string }) => createElement('button', { 'data-back': p.label }),
}))

vi.mock('../src/components/ScreenStates', () => ({
  EmptyState: (p: { title: string }) => createElement('div', { 'data-empty': p.title }),
  ScreenSkeleton: () => createElement('div', { 'data-skeleton': '' }),
}))

vi.mock('../src/components/category/CategoryInlineBar', () => ({
  CategoryInlineBar: (p: {
    items: readonly { id: string; label: string }[]
    selectedId: string
    onSelect: (id: string) => void
    colorScheme?: string
    contentPaddingHorizontal?: number
    itemGap?: number
  }) => {
    // 记录类型条传 itemGap,范围条不传 ⇒ 用 itemGap 区分两条分类条
    const range = p.itemGap === undefined
    return createElement(
      'div',
      {
        'data-category-bar': '',
        'data-kind': range ? 'range' : 'tabs',
        'data-selected': p.selectedId,
        'data-scheme': p.colorScheme ?? '',
        'data-padding': String(p.contentPaddingHorizontal),
      },
      ...p.items.map((item) =>
        createElement(
          'button',
          {
            key: item.id,
            [range ? 'data-range-item' : 'data-tab-item']: item.id,
            onClick: () => p.onSelect(item.id),
          },
          item.label,
        ),
      ),
    )
  },
}))

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const rnEl = (tag: string) => (p: Record<string, unknown>) => {
    const { style, children, onPress, ...rest } = p
    const dom: Record<string, unknown> = { 'data-style': JSON.stringify(flatten(style)) }
    for (const [k, v] of Object.entries(rest)) {
      if (k.startsWith('accessibility') || k.startsWith('on')) continue
      dom[k] = v
    }
    if (typeof onPress === 'function') dom.onClick = onPress
    return createElement(tag, dom, children as never)
  }
  return {
    View: rnEl('div'),
    Text: rnEl('span'),
    Pressable: (p: { children?: ReactNode; onPress?: () => void; style?: unknown }) =>
      createElement(
        'div',
        {
          'data-pressable': '',
          'data-style': JSON.stringify(flatten(p.style)),
          onClick: p.onPress,
        },
        p.children,
      ),
    TouchableOpacity: (p: { children?: ReactNode; onPress?: () => void; style?: unknown }) =>
      createElement(
        'button',
        {
          'data-touchable': '',
          'data-style': JSON.stringify(flatten(p.style)),
          onClick: p.onPress,
        },
        p.children,
      ),
    ActivityIndicator: () => createElement('div', { 'data-spinner': '' }),
    RefreshControl: () => null,
    ScrollView: (p: { children?: ReactNode }) =>
      createElement('div', { 'data-scroll': '' }, p.children),
    FlatList: (p: {
      data: unknown[]
      renderItem: (a: { item: unknown; index: number }) => ReactNode
      ListHeaderComponent?: ReactNode
      ListFooterComponent?: ReactNode
      ListEmptyComponent?: ReactNode
    }) =>
      createElement(
        'div',
        { 'data-list': '' },
        p.ListHeaderComponent ?? null,
        ...(p.data ?? []).map((item, index) =>
          createElement(
            'div',
            { key: index, 'data-row': (item as { id?: string }).id ?? `row-${index}` },
            p.renderItem({ item, index }),
          ),
        ),
        (p.data ?? []).length > 0
          ? (p.ListFooterComponent ?? null)
          : (p.ListEmptyComponent ?? null),
      ),
    StyleSheet: { create: (s: unknown) => s, flatten },
    Platform: { OS: 'web' },
  }
})

import {
  TokenValueScreen,
  type TokenValueScreenProps,
} from '../src/features/token-value/TokenValueScreen'

const RANGE_ITEMS = [
  { id: 'w', label: '7天' },
  { id: 'm', label: '一个月' },
  { id: 'y', label: '近一年' },
  { id: 'a', label: '全部' },
]

const RECORDS = [
  {
    id: 'r1',
    type: 'cost' as const,
    title: 'Agent · Model',
    amount: -120,
    time: '2026-11-06 10:00',
  },
  {
    id: 'r2',
    type: 'recharge' as const,
    title: '充值 ¥9.9',
    amount: 9.9,
    time: '2026-11-05 09:00',
  },
]

function baseProps(overrides: Partial<TokenValueScreenProps> = {}): TokenValueScreenProps {
  return {
    t: (key: string) => key,
    balance: { balance: 1000, frozen: 0, totalUsed: 500 },
    records: RECORDS,
    loading: false,
    refreshing: false,
    error: '',
    activeTab: 'all',
    onSelectTab: vi.fn(),
    onRefresh: vi.fn(),
    onRecharge: vi.fn(),
    onBack: vi.fn(),
    colorScheme: 'dark',
    ...overrides,
  }
}

describe('TokenValueScreen 记录时间范围条注入点', () => {
  it('① 三件套齐备:范围条渲染,选项/选中值/内边距/配色逐项匹配,点击回调接上', () => {
    const onSelectRange = vi.fn()
    const { container } = render(
      createElement(
        TokenValueScreen,
        baseProps({ rangeItems: RANGE_ITEMS, rangeId: 'm', onSelectRange }),
      ),
    )
    const bar = container.querySelector('[data-kind="range"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('data-selected')).toBe('m')
    expect(bar?.getAttribute('data-padding')).toBe('0')
    expect(bar?.getAttribute('data-scheme')).toBe('dark')

    const buttons = Array.from(container.querySelectorAll('[data-range-item]'))
    expect(buttons.map((b) => b.getAttribute('data-range-item'))).toEqual(['w', 'm', 'y', 'a'])
    expect(buttons.map((b) => b.textContent)).toEqual(['7天', '一个月', '近一年', '全部'])

    fireEvent.click(buttons[3]!)
    expect(onSelectRange).toHaveBeenCalledWith('a')
  })

  it('② 阴性对照:缺 onSelectRange ⇒ 范围条不渲染', () => {
    const { container } = render(
      createElement(TokenValueScreen, baseProps({ rangeItems: RANGE_ITEMS, rangeId: 'w' })),
    )
    expect(container.querySelector('[data-range-item]')).toBeNull()
    // 记录类型条仍在(不能整体吞掉分类条)
    expect(container.querySelector('[data-kind="tabs"]')).not.toBeNull()
  })

  it('③ 阴性对照:缺 rangeItems ⇒ 范围条不渲染', () => {
    const { container } = render(
      createElement(TokenValueScreen, baseProps({ rangeId: 'w', onSelectRange: vi.fn() })),
    )
    expect(container.querySelector('[data-range-item]')).toBeNull()
  })

  it('④ 回归:不传注入点 ⇒ 记录类型条与记录行照旧渲染', () => {
    const { container } = render(createElement(TokenValueScreen, baseProps()))
    const rows = Array.from(container.querySelectorAll('[data-row]'))
    expect(rows.map((r) => r.getAttribute('data-row'))).toEqual(['r1', 'r2'])
    expect(container.querySelector('[data-kind="tabs"]')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
