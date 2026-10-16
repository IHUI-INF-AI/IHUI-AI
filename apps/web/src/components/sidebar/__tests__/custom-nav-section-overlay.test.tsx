// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import type * as ApiClientModule from '@ihui/api-client'

/**
 * P0 回归:自定义项右侧的浮层(拖拽手柄 + 移除)在隐藏时必须**不可点**。
 *
 * 病灶(2026-10-16 埋、10-17 修):浮层只有 `opacity-0`,没有 `pointer-events-none`。
 * opacity 不影响命中测试 ⇒ 行右侧约 54px 是一排隐形但可点的按钮,最右 24px 是「移除」
 * ⇒ 点条目右侧空白 = 静默删除收藏(无确认无撤销);再左 24px 是拖拽手柄 ⇒ 点击被吞、
 * 行毫无反应。160px 侧栏里这占了近 1/3 行宽,且触屏上按钮永远看不见。
 *
 * 判据(缺一条就是没牙):
 *  ① 隐藏态:浮层容器带 pointer-events-none(不可点)
 *  ② hover / 键盘聚焦:pointer-events-auto 恢复(否则按钮永远点不了)
 *  ③ 触屏(hover:none):pointer-events-auto 常开 + touch-reveal 常显
 *     —— 手机上没有 hover,只写 group-hover 等于按钮看得见摸不着
 *  ④ 触屏常显:浮层带 touch-reveal(项目既有口径,animations.css)
 *
 * 假环境边界:jsdom 不做 CSS 计算,也不模拟 :hover / 媒体查询,所以这里断言的是
 * **类名契约**(那是 Tailwind 编译后真正决定行为的唯一来源),不是浏览器实测行为。
 */

vi.mock('next-intl', () => ({
  __esModule: true,
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<'a'>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  __esModule: true,
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, prefetch: () => {} }),
}))

vi.mock('@/components/feedback', () => ({
  __esModule: true,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/stores/navigation', () => ({
  __esModule: true,
  useOptimisticNavStore: (selector: (s: { optimisticHref: string | null }) => unknown) =>
    selector({ optimisticHref: null }),
}))

vi.mock('@/stores/auth', () => ({
  __esModule: true,
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'u-test' } }),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>()
  return {
    ...actual,
    getSidebarNavPreference: async () => ({ success: true, data: { hrefs: ['/models'], exists: true } }),
    updateSidebarNavPreference: async () => ({ success: true, data: { hrefs: [], exists: true } }),
  }
})

import { CustomNavSection } from '../CustomNavSection'
import type { NavItem } from '../types'

const Icon = () => <svg />

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'hotGroupLabel',
    items: [{ href: '/models', labelKey: 'models', icon: Icon }],
  },
]

function renderSection() {
  return render(
    <CustomNavSection
      collapsed={false}
      onCloseMobile={() => {}}
      registerRef={() => {}}
      groups={groups}
    />,
  )
}

/** 浮层 = 移除按钮的父容器 */
function overlay(): HTMLElement {
  const remove = document.querySelector('[data-testid="nav-custom-remove-/models"]')
  if (!remove?.parentElement) throw new Error('浮层未渲染 —— 判据无从谈起')
  return remove.parentElement
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('sidebar-custom-nav-u-test', JSON.stringify(['/models']))
})

afterEach(cleanup)

describe('CustomNavSection 右侧浮层命中契约(P0)', () => {
  it('隐藏态不可点,hover/聚焦才恢复,触屏常开', async () => {
    const { findByTestId } = renderSection()
    await findByTestId('nav-custom-remove-/models')
    const cls = overlay().className

    // ① 隐藏态必须不可点(这条没了 = 点条目右侧静默删除收藏)
    expect(cls).toContain('pointer-events-none')
    // ② 恢复路径:悬停与键盘聚焦
    expect(cls).toContain('group-hover/citem:pointer-events-auto')
    expect(cls).toContain('has-[:focus-visible]:pointer-events-auto')
    // ③ 触屏:没有 hover,必须常开(否则手机上按钮看得见摸不着)
    expect(cls).toContain('[@media(hover:none)]:pointer-events-auto')
    // ④ 触屏常显
    expect(cls).toContain('touch-reveal')
  })

  it('移除按钮语义完整(可聚焦、有可读名、点了就回传 href)', async () => {
    const { findByTestId } = renderSection()
    const remove = await findByTestId('nav-custom-remove-/models')
    expect(remove.getAttribute('aria-label')).toBe('nav.customRemove')
    expect(remove.getAttribute('title')).toBe('nav.customRemove')
    // 原生 button ⇒ 天然可聚焦,且不会触发导航
    expect(remove.tagName).toBe('BUTTON')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
