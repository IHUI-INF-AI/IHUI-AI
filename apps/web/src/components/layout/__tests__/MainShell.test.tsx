// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, act, fireEvent, cleanup } from '@testing-library/react'

// 用 ref 捕获 MainShell 传给 Sidebar 的 mobileOpen / onCloseMobile,避免 DOM 结构歧义。
let capturedCloseMobile: (() => void) | null = null
let capturedMobileOpen = false

vi.mock('@/components/sidebar', () => ({
  Sidebar: (props: { mobileOpen: boolean; onCloseMobile: () => void }) => {
    capturedMobileOpen = props.mobileOpen
    capturedCloseMobile = props.onCloseMobile
    return <div data-testid="sidebar" data-open={String(props.mobileOpen)} />
  },
  // TagsView 经由 path-labels.ts 间接导入 FLAT_NAV_ITEMS,需要在 mock 中提供
  FLAT_NAV_ITEMS: [],
  ALL_NAV_HREFS: [],
  NAV_GROUPS: [],
}))
vi.mock('@/components/common', () => ({
  PWAInstallPrompt: () => null,
  PWAUpdatePrompt: () => null,
}))
vi.mock('@/components/ai/ai-side-panel', () => ({
  AISidePanel: () => null,
}))

import { MainShell } from '../MainShell'

describe('MainShell 移动端菜单 toggle 行为', () => {
  beforeEach(() => {
    localStorage.clear()
    capturedCloseMobile = null
    capturedMobileOpen = false
  })

  afterEach(() => {
    cleanup()
  })

  it('浮动菜单按钮点击:打开 → 再点击关闭(toggle,非单向 setTrue)', () => {
    const { getByRole } = render(
      <MainShell>
        <div>content</div>
      </MainShell>,
    )
    const menuBtn = getByRole('button', { name: '菜单' })
    expect(capturedMobileOpen, '初始应关闭').toBe(false)

    act(() => fireEvent.click(menuBtn))
    expect(capturedMobileOpen, '第一次点击应打开').toBe(true)

    act(() => fireEvent.click(menuBtn))
    expect(capturedMobileOpen, '第二次点击应关闭(toggle)').toBe(false)
  })

  it('Esc 键关闭移动端侧边栏', () => {
    const { getByRole } = render(
      <MainShell>
        <div>content</div>
      </MainShell>,
    )
    const menuBtn = getByRole('button', { name: '菜单' })
    act(() => fireEvent.click(menuBtn))
    expect(capturedMobileOpen).toBe(true)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(capturedMobileOpen, 'Esc 应关闭').toBe(false)
  })

  it('onCloseMobile 关闭抽屉', () => {
    const { getByRole } = render(
      <MainShell>
        <div>content</div>
      </MainShell>,
    )
    const menuBtn = getByRole('button', { name: '菜单' })
    act(() => fireEvent.click(menuBtn))
    expect(capturedMobileOpen).toBe(true)

    expect(capturedCloseMobile, 'Sidebar 应收到 onCloseMobile').not.toBeNull()
    act(() => capturedCloseMobile!())
    expect(capturedMobileOpen, 'onCloseMobile 应关闭').toBe(false)
  })
})
