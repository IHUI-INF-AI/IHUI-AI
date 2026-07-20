// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, act, fireEvent, cleanup } from '@testing-library/react'

// 用 ref 捕获 GlobalShell 传给 Sidebar 的 mobileOpen / onCloseMobile,避免 DOM 结构歧义。
// 2026-07-20 备注:MainShell 在重构后已精简,不再渲染浮动菜单按钮;
// 菜单按钮已迁移到 GlobalShell(挂载于根 layout.tsx),所以本测试改用 GlobalShell
// 验证移动端菜单的 toggle / Esc / onCloseMobile 行为,保持原有 3 个用例覆盖度。
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

// Mock next-intl:GlobalShell 用 useTranslations('a11y') 解析菜单按钮的 aria-label。
// 单元测试不依赖真实 messages 文件,直接提供 a11y.menu 字面值,使 getByRole 能按 name 定位。
// 同时提供 ja/ko 翻译,验证跨语言环境下菜单按钮依然能按翻译后的名称被找到。
const { MESSAGES_BY_LOCALE, currentLocale } = vi.hoisted(() => {
  const map: Record<string, Record<string, Record<string, string>>> = {
    'zh-CN': { a11y: { menu: '菜单' } },
    en: { a11y: { menu: 'Menu' } },
    ja: { a11y: { menu: 'メニュー' } },
    ko: { a11y: { menu: '메뉴' } },
    'zh-TW': { a11y: { menu: '選單' } },
  }
  return {
    MESSAGES_BY_LOCALE: map,
    currentLocale: { value: 'zh-CN' as keyof typeof map },
  }
})

function __setMockLocale(locale: keyof typeof MESSAGES_BY_LOCALE) {
  currentLocale.value = locale
}

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const msgs = MESSAGES_BY_LOCALE[currentLocale.value]?.[ns] ?? {}
    return (key: string) => msgs[key] ?? key
  },
}))

import { GlobalShell } from '../GlobalShell'

describe('GlobalShell 移动端菜单 toggle 行为', () => {
  beforeEach(() => {
    localStorage.clear()
    capturedCloseMobile = null
    capturedMobileOpen = false
    __setMockLocale('zh-CN')
  })

  afterEach(() => {
    cleanup()
  })

  it('浮动菜单按钮点击:打开 → 再点击关闭(toggle,非单向 setTrue)', () => {
    const { getByRole } = render(
      <GlobalShell>
        <div>content</div>
      </GlobalShell>,
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
      <GlobalShell>
        <div>content</div>
      </GlobalShell>,
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
      <GlobalShell>
        <div>content</div>
      </GlobalShell>,
    )
    const menuBtn = getByRole('button', { name: '菜单' })
    act(() => fireEvent.click(menuBtn))
    expect(capturedMobileOpen).toBe(true)

    expect(capturedCloseMobile, 'Sidebar 应收到 onCloseMobile').not.toBeNull()
    act(() => capturedCloseMobile!())
    expect(capturedMobileOpen, 'onCloseMobile 应关闭').toBe(false)
  })

  it('ja 环境:菜单按钮 aria-label 翻译为 "メニュー",按翻译后 name 仍能定位', () => {
    __setMockLocale('ja')
    const { getByRole } = render(
      <GlobalShell>
        <div>content</div>
      </GlobalShell>,
    )
    const menuBtn = getByRole('button', { name: 'メニュー' })
    expect(menuBtn, 'ja 环境应渲染 "メニュー" 按钮').not.toBeNull()
    expect(menuBtn.getAttribute('aria-label')).toBe('メニュー')
  })

  it('ko 环境:菜单按钮 aria-label 翻译为 "메뉴",按翻译后 name 仍能定位', () => {
    __setMockLocale('ko')
    const { getByRole } = render(
      <GlobalShell>
        <div>content</div>
      </GlobalShell>,
    )
    const menuBtn = getByRole('button', { name: '메뉴' })
    expect(menuBtn, 'ko 环境应渲染 "메뉴" 按钮').not.toBeNull()
    expect(menuBtn.getAttribute('aria-label')).toBe('메뉴')
  })
})
