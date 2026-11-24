// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 页面级回归:`pkg-content/category-detail` 转薄壳后,渲染落在共享屏上,prop 逐个到齐;
// 另加映射级断言:avatar/useCount 必须由 toAgentItem 带出(摘掉即红)。
// 判据:① 哨兵 testid;② prop 名集合精确相等 + 值语义;③ 阴性对照(title/tabLabels/colorScheme/items 缺失必红);
//      ④ toAgentItem 的 avatar/useCount + sortItems 三档行为。
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  navigateBack: vi.fn(),
  navigateTo: vi.fn(),
  screen: { props: null as Record<string, unknown> | null, renders: 0 },
}))

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Stub = (props: { children?: ReactNode }) => createElement(tag, null, props.children)
    Stub.displayName = `Taro${tag}`
    return Stub
  }
  return { View: make('div'), Text: make('span'), ScrollView: make('div') }
})

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentPages: () => [{ options: {} }],
    navigateBack: h.navigateBack,
    navigateTo: h.navigateTo,
  },
  useDidShow: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/category-detail/CategoryDetailScreen', () => ({
  CategoryDetailScreen: (props: Record<string, unknown>) => {
    h.screen.props = props
    h.screen.renders += 1
    return createElement('div', { 'data-testid': 'shared-category-detail-screen' })
  },
}))

vi.mock('@/api', () => ({
  getAgentList: vi.fn(async () => ({ list: [] })),
}))

vi.mock('@/i18n', () => {
  const TEXT: Record<string, string> = {
    'categoryDetail.allCategories': '全部分类',
    'categoryDetail.recommended': '推荐',
    'categoryDetail.hot': '热门',
    'categoryDetail.new': '最新',
  }
  const t = (key: string, fallback?: string): string => TEXT[key] ?? fallback ?? key
  return { useI18n: () => ({ t }), useTt: () => t, t }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
vi.mock('@/components/ThemeRoot', () => ({
  default: (props: { children?: ReactNode }) => createElement('div', null, props.children),
}))

import CategoryDetailPage, {
  sortItems,
  toAgentItem,
} from '../src/pkg-content/category-detail/index'

const EXPECTED_KEYS = [
  't',
  'items',
  'activeTab',
  'title',
  'tabLabels',
  'loading',
  'hasMore',
  'error',
  'onTabChange',
  'onLoadMore',
  'onAgentPress',
  'onBack',
  'onRetry',
  'colorScheme',
]

function assertSharedScreenProps(props: Record<string, unknown>): void {
  expect(Object.keys(props).sort()).toEqual([...EXPECTED_KEYS].sort())
  expect(props.items).toEqual([])
  expect(props.activeTab).toBe('热门')
  expect(props.title).toBe('全部分类')
  expect(props.tabLabels).toEqual(['推荐', '热门', '最新'])
  expect(props.loading).toBe(true)
  expect(props.hasMore).toBe(false)
  expect(props.error).toBe('')
  expect(props.colorScheme).toBe('dark')
  for (const key of ['onTabChange', 'onLoadMore', 'onAgentPress', 'onBack', 'onRetry']) {
    expect(typeof props[key]).toBe('function')
  }
  ;(props.onBack as () => void)()
  expect(h.navigateBack).toHaveBeenCalledTimes(1)
  ;(props.onAgentPress as (id: string) => void)('ag-1')
  expect(h.navigateTo).toHaveBeenCalledWith({ url: '/pkg-ai/ai/agent-detail?id=ag-1' })
}

describe('pkg-content/category-detail 真渲染共享屏', () => {
  it('渲染的是共享屏(按组件 testid,而非 import 字符串)', () => {
    const html = renderToStaticMarkup(createElement(CategoryDetailPage as never))
    expect(html).toContain('data-testid="shared-category-detail-screen"')
    expect(h.screen.renders).toBe(1)
    expect(h.screen.props).not.toBeNull()
  })

  it('14 个 prop 逐个到达,值语义与页内事实一致', () => {
    h.navigateBack.mockClear()
    h.navigateTo.mockClear()
    renderToStaticMarkup(createElement(CategoryDetailPage as never))
    assertSharedScreenProps(h.screen.props as Record<string, unknown>)
  })

  it('阴性对照:删 title / tabLabels / colorScheme / items 时断言必须红', () => {
    renderToStaticMarkup(createElement(CategoryDetailPage as never))
    const good = { ...(h.screen.props as Record<string, unknown>) }
    const noTitle = { ...good }
    delete noTitle.title
    expect(() => assertSharedScreenProps(noTitle)).toThrow()
    expect(() => assertSharedScreenProps({ ...good, title: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, tabLabels: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, colorScheme: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, items: undefined })).toThrow()
  })
})

describe('category-detail 条目映射(avatar/useCount 不能静默丢)', () => {
  it('toAgentItem 带出 avatar 与 useCount', () => {
    const item = toAgentItem({
      id: 'ag-1',
      name: '画师',
      desc: '描述',
      avatar: 'https://x/a.png',
      uses: 12,
    })
    expect(item).toEqual({
      id: 'ag-1',
      name: '画师',
      description: '描述',
      avatar: 'https://x/a.png',
      useCount: 12,
    })
  })

  it('阴性对照:摘掉 avatar / useCount 的映射对象不能通过同一断言', () => {
    const good = toAgentItem({
      id: 'ag-1',
      name: '画师',
      desc: '描述',
      avatar: 'https://x/a.png',
      uses: 12,
    })
    const expected = {
      id: 'ag-1',
      name: '画师',
      description: '描述',
      avatar: 'https://x/a.png',
      useCount: 12,
    }
    expect(good).toEqual(expected)
    const noAvatar = { ...good } as Record<string, unknown>
    delete noAvatar.avatar
    expect(() => expect(noAvatar).toEqual(expected)).toThrow()
    const noUseCount = { ...good } as Record<string, unknown>
    delete noUseCount.useCount
    expect(() => expect(noUseCount).toEqual(expected)).toThrow()
  })

  it('sortItems 三档:热门=useCount 降序 / 最新=反转 / 推荐=原序', () => {
    const list = [
      toAgentItem({ id: 'a', name: 'A', uses: 3 }),
      toAgentItem({ id: 'b', name: 'B', uses: 9 }),
      toAgentItem({ id: 'c', name: 'C', uses: 5 }),
    ]
    expect(sortItems(list, '热门').map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(sortItems(list, '最新').map((x) => x.id)).toEqual(['c', 'b', 'a'])
    expect(sortItems(list, '推荐').map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})
