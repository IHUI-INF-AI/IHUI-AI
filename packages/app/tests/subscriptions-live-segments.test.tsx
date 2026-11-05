// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 订阅共享屏直播语义复用锁(packages/app/src/features/subscriptions/SubscriptionsScreen.tsx)。
//
// 同一屏服务两套语义:
//   通用订阅(RN/miniapp 既有:targetType / targetId / createdAt / 取消)
//   直播订阅(targetType === 'live':封面 / 标题 / 讲师 / 开播时间 / 状态徽标 / 段计数 / 提醒卡 / 行点击)
// 判据落在渲染结果上:
//   ① 直播字段齐全 + 开关 + CTA 回调 ⇒ 各段渲染且回调接上
//   ② 直播项缺字段 ⇒ 对应段不存在;不传 onToggleReminder ⇒ 无提醒卡(阴性对照)
//   ③ 非直播项即便携带直播字段也不得渲染直播段 —— 分支判据必须是 targetType
//   ④ 不传 onPressItem ⇒ 直播行不可点(阴性对照)
//   ⑤ 非直播行输出与迁移前完全一致(回归)

import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: (p: { label: string }) => createElement('button', { 'data-back': p.label }),
}))

vi.mock('../src/components/ScreenStates', () => ({
  EmptyState: (p: { title: string; actionLabel?: string; onAction?: () => void }) =>
    createElement(
      'div',
      { 'data-empty': p.title },
      p.actionLabel
        ? createElement(
            'button',
            { 'data-action': p.actionLabel, onClick: p.onAction },
            p.actionLabel,
          )
        : null,
    ),
  ScreenSkeleton: () => createElement('div', { 'data-skeleton': '' }),
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
    'ItemSeparatorComponent',
    'ListHeaderComponent',
    'ListFooterComponent',
    'ListEmptyComponent',
    'keyExtractor',
    'hitSlop',
    'source',
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
    Image: (p: { source?: { uri?: string }; style?: unknown }) =>
      createElement('img', {
        'data-image': '',
        src: p.source?.uri,
        'data-style': JSON.stringify(flatten(p.style)),
      }),
    Switch: (p: { value?: boolean; onValueChange?: (v: boolean) => void }) =>
      createElement('input', {
        type: 'checkbox',
        'data-switch': '',
        checked: p.value,
        onChange: (e: { target: { checked: boolean } }) => p.onValueChange?.(e.target.checked),
      }),
    ActivityIndicator: () => createElement('div', { 'data-spinner': '' }),
    RefreshControl: () => null,
    FlatList: (p: {
      data: unknown[]
      renderItem: (a: { item: unknown; index: number }) => ReactNode
      ListFooterComponent?: ReactNode
      ListEmptyComponent?: ReactNode
    }) =>
      createElement(
        'div',
        { 'data-list': '' },
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

import { SubscriptionsScreen } from '../src/features/subscriptions/SubscriptionsScreen'

type Item = {
  id: string
  targetType: string
  targetId: string
  createdAt: string
  title?: string
  coverUrl?: string | null
  anchor?: string | null
  status?: 'upcoming' | 'living' | 'ended'
  startTime?: string
}

const t = (key: string) => key

const LIVE: Item = {
  id: 'live-1',
  targetType: 'live',
  targetId: '555',
  createdAt: '',
  title: '直播甲',
  coverUrl: 'https://img.example/cover.png',
  anchor: '李老师',
  startTime: '2026-11-05 20:00',
  status: 'living',
}

const NON_LIVE: Item = {
  id: 'sub-1',
  targetType: 'course',
  targetId: 'course-9',
  createdAt: '2026-10-01',
}

const base = {
  t,
  items: [] as Item[],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: '',
  onRefresh: () => {},
  onLoadMore: () => {},
  onCancel: () => {},
  colorScheme: 'light' as const,
}

const renderScreen = (props: Record<string, unknown>) =>
  render(createElement(SubscriptionsScreen, { ...base, ...props } as never))

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-row="${id}"]`) as HTMLElement

describe('订阅共享屏直播语义复用锁', () => {
  it('① 直播字段齐全 ⇒ 封面/讲师/开播时间/状态徽标/计数行/提醒卡,行点击与开关回调接上', () => {
    const onPressItem = vi.fn()
    const onToggleReminder = vi.fn()
    const onGoDiscover = vi.fn()
    const onCancel = vi.fn()
    const { container } = renderScreen({
      items: [LIVE, NON_LIVE],
      onPressItem,
      onToggleReminder,
      reminderEnabled: true,
      onGoDiscover,
      onCancel,
    })

    const text = container.textContent || ''
    expect(text).toContain('live.subscribe.count')
    expect(text).toContain('live.subscribe.unit')
    expect(text).toContain('live.subscribe.reminder')
    expect(text).toContain('live.subscribe.reminderDesc')
    expect(text).toContain('live.ongoing')
    expect(text).toContain('直播甲')
    expect(text).toContain('李老师')
    expect(text).toContain('2026-11-05 20:00')
    expect(container.querySelector('img')?.getAttribute('src')).toBe(LIVE.coverUrl)

    // 提醒开关值来自 props,拨动回调直连
    const sw = container.querySelector('[data-switch]') as HTMLInputElement
    expect(sw.checked).toBe(true)
    fireEvent.click(sw)
    expect(onToggleReminder).toHaveBeenCalledWith(false)

    // 直播行可点
    fireEvent.click(rowOf(container, 'live-1').querySelector('[data-pressable]') as Element)
    expect(onPressItem).toHaveBeenCalledWith(LIVE)

    // 非直播行仍为通用形态 + 取消可用
    expect(rowOf(container, 'sub-1').textContent).toContain('course')
    expect(rowOf(container, 'sub-1').textContent).toContain('course-9')
    expect(rowOf(container, 'sub-1').textContent).toContain('2026-10-01')
    fireEvent.click(rowOf(container, 'sub-1').querySelector('[data-touchable]') as Element)
    expect(onCancel).toHaveBeenCalledWith(NON_LIVE)
  })

  it('② 阴性对照:直播项缺 title/coverUrl/anchor/status ⇒ 对应段不存在;不传 onToggleReminder ⇒ 无提醒卡', () => {
    const { container } = renderScreen({
      items: [{ id: 'live-2', targetType: 'live', targetId: '777', createdAt: '' }],
    })
    const text = container.textContent || ''
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-switch]')).toBeNull()
    expect(text).not.toContain('live.ongoing')
    expect(text).not.toContain('live.upcoming')
    expect(text).not.toContain('live.ended')
    expect(text).not.toContain('live.subscribe.reminder')
    expect(text).not.toContain('live.subscribe.reminderDesc')
    // 缺 title 时回退 targetId;计数行仍渲染
    expect(text).toContain('777')
    expect(text).toContain('live.subscribe.count')
  })

  it('③ 非直播项即便携带直播字段也不渲染直播段(分支判据必须是 targetType)', () => {
    const disguised = { ...LIVE, id: 'sub-2', targetType: 'course' }
    const { container } = renderScreen({ items: [disguised] })
    const text = container.textContent || ''
    expect(container.querySelector('img')).toBeNull()
    expect(text).not.toContain('直播甲')
    expect(text).not.toContain('李老师')
    expect(text).not.toContain('live.ongoing')
    expect(text).toContain('course')
    expect(text).toContain('555')
  })

  it('④ 阴性对照:不传 onPressItem ⇒ 直播行不可按压', () => {
    const { container } = renderScreen({ items: [LIVE] })
    const row = rowOf(container, 'live-1')
    // 行容器直接子节点不是 Pressable(可点时会包一层)
    expect(row.querySelector(':scope > [data-pressable]')).toBeNull()
    expect(row.querySelector('img')).not.toBeNull()
  })

  it('⑤ 回归:非直播行输出与迁移前完全一致(文本顺序固定、无额外片段)', () => {
    const { container } = renderScreen({ items: [NON_LIVE] })
    const row = rowOf(container, 'sub-1')
    expect(row.textContent).toBe(
      'coursecourse-92026-10-01memberSubscriptionPage.cancelSubscription',
    )
    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('[data-switch]')).toBeNull()
    expect(container.textContent).not.toContain('live.subscribe.count')
  })

  it('⑥ 无 onBack 不渲染页头(小程序原生导航栏);有 onBack 才渲染', () => {
    const without = renderScreen({ items: [] })
    expect(without.container.querySelector('[data-back]')).toBeNull()
    without.unmount()
    const withBack = renderScreen({ items: [], onBack: () => {} })
    expect(withBack.container.querySelector('[data-back]')).not.toBeNull()
  })
})
