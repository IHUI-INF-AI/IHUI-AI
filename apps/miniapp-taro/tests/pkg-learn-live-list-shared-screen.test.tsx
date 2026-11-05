// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 页面级回归:`pkg-learn/live/list` 转薄壳后,渲染真的落在共享屏上,且每个 prop 都到齐。
// 判据:① 哨兵 testid 真的出现(不是 import 字符串);② prop 名集合精确相等 + 值语义逐条;
// ③ 阴性对照:删 quickActions / colorScheme / items / activeTab 时必须红。
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
    getCurrentInstance: () => ({ router: { params: {} } }),
    stopPullDownRefresh: vi.fn(),
    navigateBack: h.navigateBack,
    navigateTo: h.navigateTo,
  },
  usePullDownRefresh: vi.fn(),
  useReachBottom: vi.fn(),
  useShareAppMessage: vi.fn(),
  useShareTimeline: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/live-list/LiveListScreen', () => ({
  LiveListScreen: (props: Record<string, unknown>) => {
    h.screen.props = props
    h.screen.renders += 1
    return createElement('div', { 'data-testid': 'shared-live-list-screen' })
  },
}))

vi.mock('@/api', () => ({
  get: vi.fn(async () => ({ list: [], total: 0 })),
}))

vi.mock('@/i18n', () => {
  const TEXT: Record<string, string> = {
    'live.startLiveBtn': '我要开播',
    'live.calendarBtn': '日历',
    'live.mySubscriptionBtn': '我的订阅',
    'common.failed': '加载失败',
  }
  const t = (key: string, fallback?: string): string => TEXT[key] ?? fallback ?? key
  return { useI18n: () => ({ t }), useTt: () => t, t }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
vi.mock('@/components/ThemeRoot', () => ({
  default: (props: { children?: ReactNode }) => createElement('div', null, props.children),
}))

import LiveList from '../src/pkg-learn/live/list'

const EXPECTED_KEYS = [
  't',
  'items',
  'activeTab',
  'onSelectTab',
  'tabs',
  'loading',
  'refreshing',
  'error',
  'onRefresh',
  'onPressItem',
  'onBack',
  'onEndReached',
  'loadingMore',
  'onRetry',
  'colorScheme',
  'onNavigate',
  'quickActions',
]

function assertSharedScreenProps(props: Record<string, unknown>): void {
  expect(Object.keys(props).sort()).toEqual([...EXPECTED_KEYS].sort())
  expect(props.items).toEqual([])
  expect(props.activeTab).toBe('all')
  expect(props.tabs).toEqual(['all', 'ongoing', 'ended'])
  expect(props.loading).toBe(false)
  expect(props.refreshing).toBe(false)
  expect(props.loadingMore).toBe(false)
  expect(props.error).toBe('')
  expect(props.colorScheme).toBe('dark')
  // props 逐键是函数;onBack 真落 Taro.navigateBack
  for (const key of [
    'onSelectTab',
    'onRefresh',
    'onPressItem',
    'onBack',
    'onEndReached',
    'onRetry',
    'onNavigate',
  ]) {
    expect(typeof props[key]).toBe('function')
  }
  ;(props.onBack as () => void)()
  expect(h.navigateBack).toHaveBeenCalledTimes(1)
  // onNavigate 端口真的映射到端内详情页
  ;(props.onNavigate as (target: string, params?: Record<string, unknown>) => void)('LiveDetail', {
    id: 'lv-1',
  })
  expect(h.navigateTo).toHaveBeenCalledWith({ url: '/pkg-learn/live/detail?id=lv-1' })
  // quickActions:三枚文案取到真实词条,三个 handler 可点,日历是本端独有
  const qa = props.quickActions as {
    labels: Record<string, string>
    onPressHost: () => void
    onPressCalendar?: () => void
    onPressSubscriptions: () => void
  }
  expect(qa.labels).toEqual({ host: '我要开播', calendar: '日历', subscriptions: '我的订阅' })
  expect(typeof qa.onPressHost).toBe('function')
  expect(typeof qa.onPressCalendar).toBe('function')
  expect(typeof qa.onPressSubscriptions).toBe('function')
}

describe('pkg-learn/live/list 真渲染共享屏', () => {
  it('渲染的是共享屏(按组件 testid,而非 import 字符串)', () => {
    const html = renderToStaticMarkup(createElement(LiveList as never))
    expect(html).toContain('data-testid="shared-live-list-screen"')
    expect(h.screen.renders).toBe(1)
    expect(h.screen.props).not.toBeNull()
  })

  it('17 个 prop 逐个到达,值语义与页内事实一致', () => {
    h.navigateBack.mockClear()
    h.navigateTo.mockClear()
    renderToStaticMarkup(createElement(LiveList as never))
    assertSharedScreenProps(h.screen.props as Record<string, unknown>)
  })

  it('阴性对照:删 quickActions / colorScheme / items / activeTab 时断言必须红', () => {
    renderToStaticMarkup(createElement(LiveList as never))
    const good = { ...(h.screen.props as Record<string, unknown>) }
    const noQuick = { ...good }
    delete noQuick.quickActions
    expect(() => assertSharedScreenProps(noQuick)).toThrow()
    expect(() => assertSharedScreenProps({ ...good, quickActions: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, colorScheme: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, items: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, activeTab: undefined })).toThrow()
    expect(() =>
      assertSharedScreenProps({
        ...good,
        quickActions: {
          labels: { host: '我要开播', calendar: '日历' },
          onPressHost: () => {},
          onPressSubscriptions: () => {},
        },
      }),
    ).toThrow()
  })
})
