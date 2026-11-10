// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 文章列表「返回顶部」共享屏契约锁(packages/app/src/features/article-list/ArticleListScreen.tsx:249-256)。
//
// ① 阳:showBackTop + onBackToTop + onListRef 三者真实接通 ⇒ 滚动过 200 后按钮渲染,
//    点击时消费端拿到的句柄真被 scrollToOffset({ offset: 0, animated: true }) 驱动;
// ② 阴:不传这三项 ⇒ 同一滚动现场不渲染回顶按钮(摘掉小程序端接线,①同一断言必红)。

import { createElement, forwardRef, type ReactNode, useImperativeHandle } from 'react'
import { expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

const scrollSpy = vi.hoisted(() => ({ scrollToOffset: vi.fn() }))

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
  const renderItems = (data: unknown[], props: Record<string, unknown>) => [
    props.ListHeaderComponent ?? null,
    ...data.map((item, index) =>
      createElement(
        'div',
        { key: index },
        (props.renderItem as (a: unknown) => ReactNode)({ item, index }),
      ),
    ),
    data.length > 0 ? (props.ListFooterComponent ?? null) : (props.ListEmptyComponent ?? null),
  ]
  const FlatList = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    useImperativeHandle(ref, () => ({ scrollToOffset: scrollSpy.scrollToOffset }), [])
    return createElement(
      'div',
      { 'data-list': '' },
      createElement('button', {
        'data-scroll': '',
        onClick: () =>
          (props.onScroll as (e: unknown) => void)({
            nativeEvent: { contentOffset: { y: 300 } },
          }),
      }),
      // 小程序 Taro 事件形态:没有 nativeEvent,只有 detail.scrollTop
      createElement('button', {
        'data-scroll-taro': '',
        onClick: () => (props.onScroll as (e: unknown) => void)({ detail: { scrollTop: 300 } }),
      }),
      renderItems(props.data as unknown[], props),
    )
  })
  FlatList.displayName = 'FlatListStub'
  return {
    View: rnEl('div'),
    Text: rnEl('span'),
    Pressable: rnEl('button'),
    ActivityIndicator: () => createElement('div', { 'data-spinner': '' }),
    RefreshControl: () => null,
    FlatList,
    StyleSheet: { create: (s: unknown) => s, flatten },
    Platform: { OS: 'web' },
  }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: (p: { label: string }) => createElement('button', { 'data-back': p.label }),
}))

vi.mock('../src/components/ScrollJumpButton', () => ({
  ScrollJumpButton: (p: { onPress: () => void; label: string }) =>
    createElement('button', { 'data-jump': p.label, onClick: p.onPress }, p.label),
}))

vi.mock('../src/components/ScreenStates', () => ({
  EmptyState: (p: { title: string }) => createElement('div', { 'data-empty': p.title }),
  ErrorState: (p: { message: string }) => createElement('div', { 'data-error': p.message }),
  ScreenSkeleton: () => createElement('div', { 'data-skeleton': '' }),
  PressableCard: (p: { children?: ReactNode }) =>
    createElement('button', { 'data-card': '' }, p.children),
}))

import { ArticleListScreen } from '../src/features/article-list/ArticleListScreen'

const t = (key: string) => key

const base = {
  t,
  items: [{ id: 'a1', title: '甲', author: '编辑部', views: 1, publishedAt: '2026-11-01' }],
  loading: false,
  refreshing: false,
  error: '',
  onRefresh: () => {},
  onPressItem: () => {},
  onBack: () => {},
  onEndReached: () => {},
  onToast: vi.fn(),
}

type Handle = { scrollToOffset: (params: { offset: number; animated?: boolean }) => void }

it('阳:滚动过 200 后回顶按钮渲染,点击经句柄真调用 scrollToOffset', () => {
  scrollSpy.scrollToOffset.mockClear()
  let handle: Handle | null = null
  const { container } = render(
    createElement(ArticleListScreen, {
      ...base,
      showBackTop: true,
      onListRef: (ref: unknown) => {
        handle = ref as Handle | null
      },
      onBackToTop: () => handle?.scrollToOffset({ offset: 0, animated: true }),
    } as never),
  )

  expect(container.querySelector('[data-jump]')).toBeNull()
  fireEvent.click(container.querySelector('[data-scroll]') as Element)
  expect(container.querySelector('[data-jump]')).not.toBeNull()

  fireEvent.click(container.querySelector('[data-jump]') as Element)
  expect(scrollSpy.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true })
})

it('阳性(小程序事件形态):detail.scrollTop 也能点亮回顶按钮', () => {
  const { container } = render(
    createElement(ArticleListScreen, {
      ...base,
      showBackTop: true,
      onBackToTop: () => {},
      onListRef: () => {},
    } as never),
  )
  fireEvent.click(container.querySelector('[data-scroll-taro]') as Element)
  expect(container.querySelector('[data-jump]')).not.toBeNull()
})

it('阴:不传 showBackTop/onBackToTop/onListRef ⇒ 同一滚动现场无回顶按钮', () => {
  const { container } = render(createElement(ArticleListScreen, base as never))
  fireEvent.click(container.querySelector('[data-scroll]') as Element)
  expect(container.querySelector('[data-jump]')).toBeNull()
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
