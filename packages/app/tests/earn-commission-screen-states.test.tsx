// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * EarnCommissionScreen 状态锁:
 *  ① loading 时不得把 null overview 渲染成 ¥0.00/0 人,必须走共享骨架;
 *  ② error 时走共享 ErrorState,重试真的调到 onRetry;
 *  ③ 成功态才展示真实 overview 与分佣比例。
 */
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

vi.mock('react-native', () => {
  const el = (tag: string) => (p: Record<string, unknown>) => {
    const { style: _style, children, onPress, ...rest } = p
    const dom: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rest)) {
      if (k.startsWith('accessibility') || k === 'testID') {
        dom[k === 'testID' ? 'data-testid' : k] = v as never
      }
    }
    if (typeof onPress === 'function') dom.onClick = onPress
    return createElement(tag, dom, children as never)
  }
  return {
    View: el('div'),
    Text: el('span'),
    Pressable: el('button'),
    ScrollView: el('div'),
    StyleSheet: { create: <T,>(s: T) => s, flatten: (s: unknown) => s },
  }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: ({ onPress }: { onPress?: () => void }) =>
    createElement('button', { onClick: onPress, 'data-back': '' }, 'back'),
}))

vi.mock('../src/components/ScreenStates', () => ({
  ScreenSkeleton: () => createElement('div', { 'data-test': 'skeleton' }),
  ErrorState: ({
    message,
    onRetry,
    retryLabel,
  }: {
    message: string
    onRetry?: () => void
    retryLabel?: string
  }) =>
    createElement(
      'div',
      { 'data-test': 'error' },
      createElement('span', null, message),
      onRetry ? createElement('button', { onClick: onRetry }, retryLabel) : null,
    ),
}))

import { EarnCommissionScreen } from '../src/features/earn-commission/EarnCommissionScreen'

const t = ((key: string) => key) as never

afterEach(cleanup)

describe('EarnCommissionScreen states', () => {
  it('loading 不把空 overview 当 0 收益展示', () => {
    const { container } = render(
      createElement(EarnCommissionScreen, {
        t,
        onBack: vi.fn(),
        onOpenVip: vi.fn(),
        overview: null,
        loading: true,
      }),
    )
    expect(container.querySelector('[data-test="skeleton"]')).toBeTruthy()
    expect(container.textContent).not.toContain('¥0.00')
  })

  it('error 走 ErrorState,重试调到 onRetry,并保留返回与标题', () => {
    const onRetry = vi.fn()
    const { container } = render(
      createElement(EarnCommissionScreen, {
        t,
        onBack: vi.fn(),
        onOpenVip: vi.fn(),
        overview: null,
        error: '加载失败',
        onRetry,
      }),
    )
    expect(container.querySelector('[data-test="error"]')).toBeTruthy()
    expect(container.textContent).toContain('加载失败')
    expect(container.querySelector('[data-back]')).toBeTruthy()
    const retry = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'common.retry',
    )
    expect(retry).toBeTruthy()
    fireEvent.click(retry as HTMLButtonElement)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('成功态展示真实 overview 与分佣比例', () => {
    const { container } = render(
      createElement(EarnCommissionScreen, {
        t,
        onBack: vi.fn(),
        onOpenVip: vi.fn(),
        overview: { totalCommission: 1234, invitedCount: 7 },
        rates: [{ level: 'VIP', rate: '20%' }],
      }),
    )
    expect(container.textContent).toContain('¥12.34')
    expect(container.textContent).toContain('7')
    expect(container.textContent).toContain('20%')
    expect(container.querySelector('[data-test="skeleton"]')).toBeNull()
    expect(container.querySelector('[data-test="error"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
