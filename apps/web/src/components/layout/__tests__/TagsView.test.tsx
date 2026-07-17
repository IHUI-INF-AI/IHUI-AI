// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'

// Mock next/link:渲染为原生 a 标签,避免 RSC 边界
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    className,
    href,
  }: {
    children: React.ReactNode
    className?: string
    href: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock next/navigation:返回固定 pathname,触发 addTag
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => null,
  useRouter: () => ({ push: () => {} }),
}))

// Mock Dropdown:仅渲染 trigger,避免 Radix 依赖
vi.mock('@/components/feedback', () => ({
  Dropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}))

import { TagsView } from '../TagsView'
import { useTagsViewStore } from '@/stores/tags-view'

/**
 * TagsView 视觉守门单元测试。
 *
 * 防止以下回归(2026-07-18 用户要求):
 *   - 标签容器丢失圆角(rounded-lg)
 *   - 标签容器与父级工作展示区顶部/左右无间距(mx-2 mt-2 被误删)
 *   - 标签容器背景丢失(bg-muted/40)
 *
 * 设计说明:
 *   - 单元测试相比 E2E 优势:不依赖后端/登录态/完整页面渲染,
 *     / 路由当前因 "Tooltip must be used within TooltipProvider" bug 无法跑 E2E,
 *     单元测试绕开此问题,直接渲染组件验证 className。
 *   - className 是样式的"事实来源",Tailwind 编译后会原样输出 token 到 class 属性。
 */
describe('TagsView 视觉守门', () => {
  beforeEach(() => {
    // 重置 store,确保每个 test 独立
    useTagsViewStore.setState({ tags: [], activePath: null })
  })

  afterEach(() => {
    cleanup()
  })

  /**
   * 渲染 TagsView 并返回外层容器(第一个子 div)。
   * 前置条件:store 里有至少 1 个 tag,否则 TagsView return null。
   */
  function renderWithTags() {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: '首页' })
    })
    const { container } = render(<TagsView />)
    // TagsView 根 div(外层带 bg-muted/40)
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv, 'TagsView 应渲染外层 div').not.toBeNull()
    expect(outerDiv.tagName, '外层应为 div').toBe('DIV')
    return outerDiv
  }

  it('容器 className 包含 rounded-lg(防止圆角被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 rounded-lg').toContain('rounded-lg')
  })

  it('容器 className 包含 mx-2(防止左右间距被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 mx-2').toContain('mx-2')
  })

  it('容器 className 包含 mt-2(防止顶部间距被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 mt-2').toContain('mt-2')
  })

  it('容器 className 包含 bg-muted/40(防止背景色被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 bg-muted/40').toContain('bg-muted/40')
  })

  it('容器 className 包含 h-9(防止高度被误改)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 h-9').toContain('h-9')
  })
})
