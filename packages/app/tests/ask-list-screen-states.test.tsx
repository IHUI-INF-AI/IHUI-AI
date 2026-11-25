// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AskListScreen 状态锁:
 *  ① 首屏 loading 走共享 ScreenSkeleton,不再自绘居中 loader;
 *  ② error + 空列表走共享 ErrorState,重试真的调到 onRefresh;
 *  ③ 错误态仍保留标题与返回,不把用户困在无导航页。
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
    TouchableOpacity: el('button'),
    FlatList: el('div'),
    RefreshControl: () => null,
    StyleSheet: { create: <T,>(s: T) => s, flatten: (s: unknown) => s },
  }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: ({ onPress }: { onPress?: () => void }) =>
    createElement('button', { onClick: onPress, 'data-back': '' }, 'back'),
}))

vi.mock('../src/components/ScreenStates', () => ({
  ScreenSkeleton: () => createElement('div', { 'data-test': 'skeleton' }),
  EmptyState: () => createElement('div', { 'data-test': 'empty' }),
  PressableCard: ({ children }: { children?: unknown }) =>
    createElement('div', null, children as never),
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

import { AskListScreen } from '../src/features/ask-list/AskListScreen'

const t = ((key: string) => key) as never

function baseProps() {
  return {
    t,
    items: [] as never[],
    loading: false,
    refreshing: false,
    error: '',
    onRefresh: vi.fn(),
    onLoadMore: vi.fn(),
    onPressItem: vi.fn(),
    onCreate: vi.fn(),
    onBack: vi.fn(),
    colorScheme: 'light' as const,
  }
}

afterEach(cleanup)

describe('AskListScreen states', () => {
  it('首屏 loading 用共享骨架', () => {
    const props = { ...baseProps(), loading: true }
    const { container } = render(createElement(AskListScreen, props))
    expect(container.querySelector('[data-test="skeleton"]')).toBeTruthy()
    expect(container.querySelector('[data-test="error"]')).toBeNull()
  })

  it('空列表失败走 ErrorState,重试调到 onRefresh,并保留返回与标题', () => {
    const props = { ...baseProps(), error: '加载失败' }
    const { container } = render(createElement(AskListScreen, props))
    expect(container.querySelector('[data-test="error"]')).toBeTruthy()
    expect(container.textContent).toContain('加载失败')
    expect(container.textContent).toContain('askList.title')
    expect(container.querySelector('[data-back]')).toBeTruthy()
    const retry = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'common.retry',
    )
    expect(retry).toBeTruthy()
    fireEvent.click(retry as HTMLButtonElement)
    expect(props.onRefresh).toHaveBeenCalledTimes(1)
  })

  it('有数据时错误不占据整页,不清空已有列表', () => {
    const props = {
      ...baseProps(),
      error: '刷新失败',
      items: [{ id: '1', title: '已有数据', author: 'a', answerCount: 1, views: 2, createdAt: '' }],
    }
    const { container } = render(createElement(AskListScreen, props))
    expect(container.querySelector('[data-test="error"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
