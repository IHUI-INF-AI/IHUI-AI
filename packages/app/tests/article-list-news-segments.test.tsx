// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 资讯语义复用锁(packages/app/src/features/article-list/ArticleListScreen.tsx)。
//
// 该屏同时服务两套语义:
//   通用文章域(RN ArticleListScreen,只传 items/onRefresh 等既有 props)
//   资讯域(小程序 news/list + RN NewsScreen,额外显式传 keyword/categories/pinnedItem/readIds)
// 判据落在渲染结果上,防止「为了复用把资讯语义丢掉」:
//   ① 显式传搜索/分类/置顶/已读 ⇒ 四段全渲染,且回调真接上
//   ② 不传这些 props ⇒ 四段一律不存在(通用文章形态不被污染) —— 阴性对照
//   ③ 置顶条目不得在列表里重复出现

import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

vi.mock('lucide-react-native', () => {
  const icon = (name: string) => () => createElement('i', { 'data-icon': name })
  return { ChevronLeft: icon('ChevronLeft'), Search: icon('Search'), X: icon('X') }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: (p: { label: string }) => createElement('button', { 'data-back': p.label }),
}))

vi.mock('../src/components/category/CategoryInlineBar', () => ({
  CategoryInlineBar: (p: {
    items: { id: string; label: string }[]
    selectedId: string | null
    onSelect: (id: string) => void
  }) =>
    createElement(
      'div',
      { 'data-categories': p.items.map((i) => i.id).join(','), 'data-selected': p.selectedId },
      p.items.map((i) =>
        createElement(
          'button',
          { key: i.id, 'data-chip': i.id, onClick: () => p.onSelect(i.id) },
          i.label,
        ),
      ),
    ),
}))

vi.mock('../src/components/SearchInput', () => ({
  SearchInput: (p: {
    value: string
    placeholder?: string
    onChangeText: (v: string) => void
    onSubmit?: () => void
  }) =>
    createElement('input', {
      value: p.value,
      placeholder: p.placeholder,
      onChange: (e: { target: { value: string } }) => p.onChangeText(e.target.value),
      onKeyDown: (e: { key: string }) => {
        if (e.key === 'Enter') p.onSubmit?.()
      },
    }),
}))

vi.mock('../src/components/ScrollJumpButton', () => ({
  ScrollJumpButton: (p: { onPress: () => void; label: string }) =>
    createElement('button', { 'data-jump': p.label, onClick: p.onPress }, p.label),
}))

vi.mock('../src/components/ScreenStates', () => ({
  EmptyState: (p: { title: string }) => createElement('div', { 'data-empty': p.title }),
  ErrorState: (p: { message: string }) => createElement('div', { 'data-error': p.message }),
  ScreenSkeleton: () => createElement('div', { 'data-skeleton': '' }),
  PressableCard: (p: { style?: unknown; onPress?: () => void; children?: ReactNode }) =>
    createElement(
      'button',
      { 'data-card': '', 'data-style': JSON.stringify(p.style ?? {}), onClick: p.onPress },
      p.children,
    ),
}))

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const DROP = new Set([
    'numberOfLines',
    'maxFontSizeMultiplier',
    'refreshControl',
    'contentContainerStyle',
    'onEndReached',
    'onEndReachedThreshold',
    'onScroll',
    'scrollEventThrottle',
    'ItemSeparatorComponent',
    'ListHeaderComponent',
    'ListFooterComponent',
    'ListEmptyComponent',
    'keyExtractor',
    'ref',
  ])
  const rnEl = (tag: string) => (p: Record<string, unknown>) => {
    const { style, children, onPress, ...rest } = p
    const dom: Record<string, unknown> = { 'data-style': JSON.stringify(flatten(style)) }
    for (const [k, v] of Object.entries(rest)) {
      if (DROP.has(k) || k.startsWith('accessibility') || k.startsWith('on')) continue
      dom[k] = v
    }
    if (typeof onPress === 'function') dom.onClick = onPress
    return createElement(tag, dom, children as never)
  }
  return {
    View: rnEl('div'),
    Text: rnEl('span'),
    Pressable: rnEl('button'),
    ActivityIndicator: () => createElement('div', { 'data-spinner': '' }),
    RefreshControl: () => null,
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
          createElement('div', { key: index }, p.renderItem({ item, index })),
        ),
        (p.data ?? []).length > 0
          ? (p.ListFooterComponent ?? null)
          : (p.ListEmptyComponent ?? null),
      ),
    StyleSheet: { create: (s: unknown) => s, flatten },
    Platform: { OS: 'web' },
  }
})

import { ArticleListScreen } from '../src/features/article-list/ArticleListScreen'

type Item = {
  id: string
  title: string
  author: string
  views: number
  publishedAt: string
  summary?: string
  category?: string
  source?: string
  pinned?: boolean
}

const t = (key: string, params?: { count?: number }) =>
  params?.count === undefined ? key : `${key}:${params.count}`

const ITEMS: Item[] = [
  {
    id: 'n1',
    title: '资讯甲',
    author: '编辑部',
    views: 12,
    publishedAt: '2026-11-01',
    summary: '摘要甲',
    category: '公告',
    source: '官网',
  },
  {
    id: 'n2',
    title: '资讯乙',
    author: '编辑部',
    views: 3,
    publishedAt: '2026-11-02',
  },
]

const PINNED: Item = {
  id: 'p1',
  title: '置顶资讯',
  author: '官方',
  views: 99,
  publishedAt: '2026-10-31',
  summary: '置顶摘要',
}

const base = {
  t,
  items: ITEMS,
  loading: false,
  refreshing: false,
  error: '',
  onRefresh: () => {},
  onPressItem: () => {},
  onBack: () => {},
  onEndReached: () => {},
  onToast: vi.fn(),
}

const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'announce', label: '公告' },
]

const styleOf = (el: Element) => {
  const raw = JSON.parse(el.getAttribute('data-style') || '{}') as unknown
  if (Array.isArray(raw))
    return raw.reduce<Record<string, unknown>>(
      (acc, s) => Object.assign(acc, (s ?? {}) as Record<string, unknown>),
      {},
    )
  return raw as Record<string, unknown>
}

describe('资讯语义复用锁', () => {
  it('① 显式传搜索/分类/置顶/已读 ⇒ 四段全渲染,置顶不在列表重复', () => {
    const onKeywordChange = vi.fn()
    const onSearch = vi.fn()
    const onSelectCategory = vi.fn()
    const onPressItem = vi.fn()
    const { container } = render(
      createElement(ArticleListScreen, {
        ...base,
        onPressItem,
        keyword: 'ai',
        searchPlaceholder: '搜索资讯',
        onKeywordChange,
        onSearch,
        categories: CATEGORIES,
        selectedCategory: 'announce',
        onSelectCategory,
        pinnedItem: PINNED,
        readIds: ['n1'],
      } as never),
    )

    // 搜索段
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    expect(input?.value).toBe('ai')
    expect(input?.getAttribute('placeholder')).toBe('搜索资讯')
    fireEvent.change(input as HTMLInputElement, { target: { value: 'ai2' } })
    expect(onKeywordChange).toHaveBeenCalledWith('ai2')
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' })
    expect(onSearch).toHaveBeenCalledTimes(1)

    // 分类段
    const bar = container.querySelector('[data-categories]')
    expect(bar?.getAttribute('data-categories')).toBe('all,announce')
    expect(bar?.getAttribute('data-selected')).toBe('announce')
    fireEvent.click(container.querySelector('[data-chip="announce"]') as Element)
    expect(onSelectCategory).toHaveBeenCalledWith('announce')

    // 置顶段 + 列表不重复
    expect(container.textContent).toContain('news.pinned')
    expect(container.textContent).toContain('置顶资讯')
    expect(container.textContent).not.toContain('p1')

    // 已读态:已读卡片弱化,未读卡片不弱化
    const cards = Array.from(container.querySelectorAll('[data-card]'))
    const readCard = cards.find((c) => (c.textContent || '').includes('资讯甲'))
    const unreadCard = cards.find((c) => (c.textContent || '').includes('资讯乙'))
    expect(styleOf(readCard as Element).opacity).toBe(0.55)
    expect(styleOf(unreadCard as Element).opacity).toBeUndefined()

    // 点击回调
    fireEvent.click(cards.find((c) => (c.textContent || '').includes('置顶资讯')) as Element)
    expect(onPressItem).toHaveBeenCalledWith(PINNED)
    fireEvent.click(unreadCard as Element)
    expect(onPressItem).toHaveBeenCalledWith(ITEMS[1])
  })

  it('② 阴性对照:不传搜索/分类/置顶/已读 ⇒ 四段一律不存在,通用文章形态不被污染', () => {
    const { container } = render(createElement(ArticleListScreen, base as never))
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('[data-categories]')).toBeNull()
    expect(container.textContent).not.toContain('news.pinned')
    expect(container.textContent).not.toContain('置顶资讯')
    // 未读点/已读弱化也不应出现(没有 readIds 就没有已读态)
    const cards = Array.from(container.querySelectorAll('[data-card]'))
    for (const c of cards) expect(styleOf(c).opacity).toBeUndefined()
  })

  it('③ 置顶条目从列表剔除 ⇒ 同 id 只出现一次', () => {
    const { container } = render(
      createElement(ArticleListScreen, {
        ...base,
        items: [ITEMS[0], PINNED, ITEMS[1]],
        pinnedItem: PINNED,
      } as never),
    )
    const hits = Array.from(container.querySelectorAll('[data-card]')).filter((c) =>
      (c.textContent || '').includes('置顶资讯'),
    )
    expect(hits).toHaveLength(1)
  })
})
