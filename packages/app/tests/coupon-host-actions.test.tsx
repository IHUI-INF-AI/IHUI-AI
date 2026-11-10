// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 优惠券屏宿主动作契约锁(packages/app/src/features/coupon/CouponScreen.tsx:117-140)。
//
// ① 阴:不传 onUseCoupon / onOpenCouponCenter ⇒ 「立即使用」「领券中心」按钮一律不渲染;
// ② 阳:传入后点击真触发宿主动作(使用回调带当前券项,领券中心回调无参)。

import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

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
    TouchableOpacity: rnEl('button'),
    RefreshControl: () => null,
    FlatList: (p: {
      data: unknown[]
      renderItem: (a: { item: unknown; index: number }) => ReactNode
      ListEmptyComponent?: ReactNode
    }) =>
      createElement(
        'div',
        { 'data-list': '' },
        ...(p.data ?? []).map((item, index) =>
          createElement('div', { key: index }, p.renderItem({ item, index })),
        ),
      ),
    StyleSheet: { create: (s: unknown) => s, flatten },
  }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: (p: { label: string }) => createElement('button', { 'data-back': p.label }),
}))

vi.mock('../src/components/ScreenStates', () => ({
  EmptyState: (p: { title: string }) => createElement('div', { 'data-empty': p.title }),
  ScreenSkeleton: () => createElement('div', { 'data-skeleton': '' }),
}))

import { CouponScreen } from '../src/features/coupon/CouponScreen'

const t = (key: string) => key

const ITEM = {
  id: 'c1',
  name: '新人券',
  amount: 10,
  minSpend: 50,
  validUntil: '2026-12-31',
  status: 'available',
}

const base = {
  t,
  items: [ITEM],
  activeTab: 'available',
  onSelectTab: () => {},
  loading: false,
  refreshing: false,
  error: '',
  onRefresh: () => {},
  onBack: () => {},
}

const byText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find(
    (b) => (b.textContent || '').trim() === text,
  ) ?? null

describe('优惠券宿主动作', () => {
  it('阴性对照:不传回调 ⇒ 两个动作按钮都不渲染', () => {
    const { container } = render(createElement(CouponScreen, base as never))
    expect(byText(container, 'coupon.use')).toBeNull()
    expect(byText(container, 'coupon.couponCenter')).toBeNull()
  })

  it('阳性:传入回调 ⇒ 点击真触发,使用回调带当前券项', () => {
    const onUseCoupon = vi.fn()
    const onOpenCouponCenter = vi.fn()
    const { container } = render(
      createElement(CouponScreen, { ...base, onUseCoupon, onOpenCouponCenter } as never),
    )

    fireEvent.click(byText(container, 'coupon.use') as Element)
    expect(onUseCoupon).toHaveBeenCalledWith(ITEM)

    fireEvent.click(byText(container, 'coupon.couponCenter') as Element)
    expect(onOpenCouponCenter).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
