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
    useTagsViewStore.setState({ tags: [], activePath: null, dirtyPaths: new Set() })
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

  it('容器 className 包含 bg-muted/70(防止背景色被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 bg-muted/70').toContain('bg-muted/70')
  })

  it('容器 className 包含 dark:bg-white/[0.07](深色模式更偏白)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 dark:bg-white/[0.07]').toContain('dark:bg-white/[0.07]')
  })

  it('标签 Link 包含 border 描边(active 状态用 primary/30,非 active 状态用 border/40)', () => {
    const outerDiv = renderWithTags()
    const link = outerDiv.querySelector('a')
    expect(link, '应有 a 标签').not.toBeNull()
    expect(link!.className, '应有 border').toContain('border')
    // 当前 tag 是 active(addTag 后默认激活),实际渲染用 primary/30 描边
    expect(link!.className, 'active tag 应用 primary/30 描边').toContain('border-primary/30')
  })

  it('关闭按钮 X 默认占位 w-5 + opacity-0(hover 不拉伸标签宽度,加大到接近文字大小)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭标签"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    expect(closeBtn!.className, 'X 按钮应始终占位 w-5(加大与文字匹配)').toContain('w-5')
    expect(closeBtn!.className, 'X 按钮应始终占位 h-5(加大与文字匹配)').toContain('h-5')
    expect(closeBtn!.className, 'X 按钮默认透明').toContain('opacity-0')
    expect(closeBtn!.className, 'X 按钮 hover 时显示').toContain('group-hover:opacity-100')
  })

  it('关闭按钮 X 减少动画偏好的用户始终可见(motion-reduce a11y)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭标签"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    expect(
      closeBtn!.className,
      'X 按钮在 prefers-reduced-motion 偏好下应常驻 60% 不透明',
    ).toContain('motion-reduce:opacity-60')
  })

  it('关闭按钮 X 键盘焦点态可见(focus-visible a11y)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭标签"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    expect(closeBtn!.className, 'X 按钮键盘焦点应显示').toContain('focus-visible:opacity-100')
    expect(closeBtn!.className, 'X 按钮应无默认 outline').toContain('focus-visible:outline-none')
    expect(closeBtn!.className, 'X 按钮应有焦点环').toContain('focus-visible:ring-1')
    expect(closeBtn!.className, 'X 按钮焦点环使用 ring token').toContain('focus-visible:ring-ring')
  })

  it('标签 Link 左右 padding 对称(文字视觉居中, X 紧贴右侧)', () => {
    const outerDiv = renderWithTags()
    const link = outerDiv.querySelector('a')
    expect(link, '应有 a 标签').not.toBeNull()
    // 右侧 = gap-1(4px) + X w-5(20px) + pr-1(4px) = 28px
    // 左侧 pl-7(28px) 与右侧总占位对称,文字几何居中
    // gap-1 + pr-1 让 X 紧贴标签右侧(pr 仅 4px padding)
    expect(link!.className, '应有 pl-7').toContain('pl-7')
    expect(link!.className, '应有 pr-1(X 紧贴右侧)').toContain('pr-1')
    expect(link!.className, '应有 gap-1(X 与文字紧贴)').toContain('gap-1')
  })

  it('关闭按钮 X 图标加大到 h-3.5(与文字大小匹配)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭标签"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    const icon = closeBtn!.querySelector('svg')
    expect(icon, '应有 X 图标').not.toBeNull()
    // lucide-react SVG 在 jsdom 下 className 属性可能为空,用 getAttribute('class') 兜底
    const iconClass =
      icon!.className.baseVal || icon!.getAttribute('class') || icon!.className || ''
    expect(iconClass, 'X 图标应加大到 h-3.5(检查 class 属性)').toContain('h-3.5')
    expect(iconClass, 'X 图标应加大到 w-3.5(检查 class 属性)').toContain('w-3.5')
  })

  it('容器 className 包含 h-9(防止高度被误改)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 h-9').toContain('h-9')
  })

  // ─── Feature 5: 未保存状态指示点 ───
  it('默认不渲染未保存指示点(dirtyPaths 为空)', () => {
    const outerDiv = renderWithTags()
    const dot = outerDiv.querySelector('[data-testid="tag-dirty-dot"]')
    expect(dot, '未 dirty 时不应有指示点').toBeNull()
  })

  it('dirty 状态时渲染未保存指示点,使用 amber-500 与主色区分', () => {
    act(() => {
      useTagsViewStore.getState().setDirty('/', true)
    })
    const outerDiv = renderWithTags()
    const dot = outerDiv.querySelector('[data-testid="tag-dirty-dot"]')
    expect(dot, '应有未保存指示点').not.toBeNull()
    expect(dot!.getAttribute('aria-label'), '指示点应有无障碍标签').toBe('未保存')
    expect(dot!.className, '指示点应使用 amber-500 区分主色').toContain('bg-amber-500')
    expect(dot!.className, '指示点应为小圆点').toContain('rounded-full')
  })

  it('dirty 取消后指示点自动消失(无残留)', () => {
    act(() => {
      useTagsViewStore.getState().setDirty('/', true)
    })
    const { container, rerender } = render(<TagsView />)
    expect(
      container.querySelector('[data-testid="tag-dirty-dot"]'),
      'dirty=true 时应有指示点',
    ).not.toBeNull()
    act(() => {
      useTagsViewStore.getState().setDirty('/', false)
    })
    rerender(<TagsView />)
    expect(
      container.querySelector('[data-testid="tag-dirty-dot"]'),
      'dirty=false 时应无指示点',
    ).toBeNull()
  })

  it('closeOther 应清理被关闭标签的脏状态,只保留目标标签', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
      useTagsViewStore.getState().addTag({ path: '/b', title: 'B' })
      useTagsViewStore.getState().addTag({ path: '/c', title: 'C' })
      useTagsViewStore.getState().setDirty('/a', true)
      useTagsViewStore.getState().setDirty('/b', true)
      useTagsViewStore.getState().setDirty('/c', true)
    })
    act(() => {
      useTagsViewStore.getState().closeOther('/b')
    })
    const state = useTagsViewStore.getState()
    expect(state.tags.map((t) => t.path)).toEqual(['/b'])
    expect(state.dirtyPaths.has('/b'), '目标 dirty 应保留').toBe(true)
    expect(state.dirtyPaths.has('/a'), '/a dirty 应清理').toBe(false)
    expect(state.dirtyPaths.has('/c'), '/c dirty 应清理').toBe(false)
  })

  it('removeTag 应同步清理对应 path 的脏状态', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/x', title: 'X' })
      useTagsViewStore.getState().setDirty('/x', true)
    })
    act(() => {
      useTagsViewStore.getState().removeTag('/x')
    })
    expect(useTagsViewStore.getState().dirtyPaths.has('/x'), 'removeTag 后 dirty 应清掉').toBe(
      false,
    )
  })

  it('closeAll 应清空所有脏状态', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
      useTagsViewStore.getState().addTag({ path: '/b', title: 'B' })
      useTagsViewStore.getState().setDirty('/a', true)
      useTagsViewStore.getState().setDirty('/b', true)
    })
    act(() => {
      useTagsViewStore.getState().closeAll()
    })
    expect(useTagsViewStore.getState().dirtyPaths.size, 'closeAll 后 dirtyPaths 应为空').toBe(0)
  })
})
