// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, act, cleanup } from '@testing-library/react'

// 2026-11-10 回归:「右侧工作区向上偏移」根治验证。
// main 是全站唯一持久滚动容器,路由切换(pathname 变化)必须在绘制前把 scrollTop 归零,
// 否则上一页滚动位置带到新页面,顶部内容被顶出可视区。

const { mockPathname } = vi.hoisted(() => ({ mockPathname: { value: '/admin/a' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}))

vi.mock('@/components/common/GlobalErrorBanner', () => ({
  GlobalErrorBanner: () => null,
}))

vi.mock('@/components/layout/ConnectivityBanner', () => ({
  ConnectivityBanner: () => null,
}))

import { MainShell } from '../MainShell'

// jsdom 无布局,scrollTop 写进去读不回来(同 diagram-preview-modal.test.tsx 先例),
// 在 main 元素上定义可读写自有属性模拟真实滚动容器。
function installScrollTopStore(el: HTMLElement, initial = 0) {
  let value = initial
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (v: number) => {
      value = v
    },
  })
}

function renderShell() {
  const { container, rerender } = render(
    <MainShell>
      <div data-testid="page">page content</div>
    </MainShell>,
  )
  const main = container.querySelector<HTMLElement>('#main')
  if (!main) throw new Error('main 滚动容器未渲染')
  return { main, rerender }
}

describe('MainShell 路由切换滚动归零(工作区向上偏移根治)', () => {
  beforeEach(() => {
    mockPathname.value = '/admin/a'
  })
  afterEach(() => {
    cleanup()
  })

  it('pathname 变化时把 main.scrollTop 归零', () => {
    const { main, rerender } = renderShell()
    installScrollTopStore(main)

    act(() => {
      main.scrollTop = 500
    })
    expect(main.scrollTop).toBe(500)

    act(() => {
      mockPathname.value = '/admin/relay/account-pool'
      rerender(
        <MainShell>
          <div data-testid="page">page content</div>
        </MainShell>,
      )
    })
    expect(main.scrollTop, '路由切换后 scrollTop 必须归零,新页面顶部不得被顶出可视区').toBe(0)
  })

  it('pathname 不变时不得动用户滚动位置', () => {
    const { main, rerender } = renderShell()
    installScrollTopStore(main)

    act(() => {
      main.scrollTop = 300
    })

    act(() => {
      rerender(
        <MainShell>
          <div data-testid="page">page content</div>
        </MainShell>,
      )
    })
    expect(main.scrollTop, '同路由重渲染(如筛选/翻页)不得重置滚动位置').toBe(300)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
