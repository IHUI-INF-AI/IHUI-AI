// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'

// 用 ref 捕获 MainShell 传给 Header 的 onMenuClick 回调,避免 DOM 结构歧义。
let capturedMenuClick: (() => void) | null = null
let capturedCloseMobile: (() => void) | null = null
let capturedMobileOpen = false

vi.mock('@/components/sidebar', () => ({
  Sidebar: (props: { mobileOpen: boolean; onCloseMobile: () => void }) => {
    capturedMobileOpen = props.mobileOpen
    capturedCloseMobile = props.onCloseMobile
    return <div data-testid="sidebar" data-open={String(props.mobileOpen)} />
  },
}))
vi.mock('@/components/header', () => ({
  Header: (props: { onMenuClick: () => void }) => {
    capturedMenuClick = props.onMenuClick
    return <div data-testid="header" />
  },
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
    capturedMenuClick = null
    capturedCloseMobile = null
    capturedMobileOpen = false
  })

  it('菜单按钮点击:打开 → 再点击关闭(toggle,非单向 setTrue)', () => {
    render(
      <MainShell>
        <div>content</div>
      </MainShell>,
    )
    expect(capturedMenuClick, 'Header 应收到 onMenuClick 回调').not.toBeNull()
    expect(capturedMobileOpen, '初始应关闭').toBe(false)

    act(() => capturedMenuClick!())
    expect(capturedMobileOpen, '第一次点击应打开').toBe(true)

    act(() => capturedMenuClick!())
    expect(capturedMobileOpen, '第二次点击应关闭(toggle)').toBe(false)
  })

  it('Esc 键关闭移动端侧边栏', () => {
    render(
      <MainShell>
        <div>content</div>
      </MainShell>,
    )
    act(() => capturedMenuClick!())
    expect(capturedMobileOpen).toBe(true)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(capturedMobileOpen, 'Esc 应关闭').toBe(false)
  })

  it('onCloseMobile 关闭抽屉', () => {
    render(
      <MainShell>
        <div>content</div>
      </MainShell>,
    )
    act(() => capturedMenuClick!())
    expect(capturedMobileOpen).toBe(true)

    expect(capturedCloseMobile, 'Sidebar 应收到 onCloseMobile').not.toBeNull()
    act(() => capturedCloseMobile!())
    expect(capturedMobileOpen, 'onCloseMobile 应关闭').toBe(false)
  })
})
