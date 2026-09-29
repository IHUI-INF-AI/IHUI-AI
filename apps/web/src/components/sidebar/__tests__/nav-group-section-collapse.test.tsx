// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, fireEvent, act } from '@testing-library/react'

/**
 * G-815942 —— 折叠不得只裁剪高度:收起的组内链接必须撤出 Tab 序(回归测试)。
 *
 * 病灶:`NavGroupSection` 用 `grid-rows-[0fr]` + 内层 `overflow-hidden` 折叠,那只裁高度,
 * 组内 `<Link>` 依旧挂载 ⇒ 键盘 Tab 会停在看不见的链接上;同时 header 有 `aria-expanded`
 * 却没有 `aria-controls`,内容侧也没有 `id`。
 *
 * 口径(上游 `packages/ui/src/workspace-grouped-tasks/group-item.tsx`):
 * **收起动画跑完之后才卸载**组内内容,而不是"折叠即消失"(那会把动画做没),
 * 也不是"一直挂载"(那就是本票的病灶)。
 *
 * 四条判据各钉一件事,少一条就是没牙:
 *  ① 折叠 + 时间前进过动画时长 ⇒ 组内链接不在 DOM(卸载真的发生)
 *  ② 正向对照:展开态 ⇒ 链接在 DOM 且可聚焦(不许做成"永不挂焦点"的恒哑实现)
 *  ③ 折叠但动画未跑完 ⇒ 内容仍在(卸载等满时长,不是折叠即消失)
 *  ⑤ aria-controls ↔ 内容 id 由同一个 useId() 配对(折叠后容器仍在,id 目标不会指空)
 *
 * 假环境边界(如实声明):jsdom 不实现 `inert` 的焦点语义,也不做 CSS 布局,
 * 所以本测试**只按"在不在 DOM"判**Tab 序,不押在任何无障碍属性存在性上。
 * 卸载式判据在假环境里是真断言 —— DOM 里没有那个节点,Tab 就一定走不进去。
 */

// ── Mock:next/link 渲染成真实 a 标签(断言 Tab 序需要真 <a>,且避开 RSC 边界) ──
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
    'aria-label': ariaLabel,
    'data-testid': testId,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    className?: string
    'aria-label'?: string
    'data-testid'?: string
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
  }) => (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}))

// 叶子项只在 tooltip 里用得到浮层;折叠判定与浮层无关,换成透传避免拉 Radix 进来。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Dropdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/stores/navigation', () => ({
  // NavLink/ExpandableNavItem 都按 selector 订阅;href:null = 当前无在途导航 ⇒ 回落真实 active
  useOptimisticNavStore: (selector: (s: { href: string | null }) => unknown) =>
    selector({ href: null }),
  useNavigateWithProgress: () => () => {},
}))

vi.mock('@/stores/notification', () => ({
  useNotificationStore: (selector: (s: { unreadCount: number }) => unknown) =>
    selector({ unreadCount: 0 }),
}))

import { NavGroupSection } from '../NavGroupSection'

/** 与 NavGroupSection 的动画时长常量同值(写在测试里是"档位漂移即红"的独立尺子,不是复制实现)。 */
const COLLAPSE_ANIMATION_MS = 200

const DummyIcon = () => <span />

const group = {
  label: 'aiGroupLabel', // 命中 defaultOpen 白名单 ⇒ 首帧即展开
  items: [
    { href: '/ai/chat', labelKey: 'aiChat', icon: DummyIcon },
    { href: '/ai/agents', labelKey: 'aiAgents', icon: DummyIcon },
  ],
}

function renderGroup() {
  return render(
    <NavGroupSection
      group={group}
      collapsed={false}
      activeHref={undefined}
      onCloseMobile={() => {}}
      registerRef={() => {}}
      t={(key) => key}
      scope="desktop"
      isFirst
    />,
  )
}

function toggleHeader() {
  const header = document.querySelector('[data-testid="nav-group-aiGroupLabel-toggle"]')
  if (!header) throw new Error('分组标题(header)未渲染 —— 判据无从谈起')
  return header as HTMLElement
}

function linksInDocument() {
  return Array.from(document.querySelectorAll('a'))
}

beforeEach(() => {
  vi.useFakeTimers()
  try {
    window.localStorage.clear()
  } catch {
    // 假环境没有 localStorage 时,组件的只读 effect 自己会兜住
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('NavGroupSection 折叠的可访问性(G-815942)', () => {
  it('② 正向对照:展开态组内链接在 DOM 且可聚焦', () => {
    renderGroup()

    const links = linksInDocument()
    expect(links).toHaveLength(2)
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/ai/chat', '/ai/agents'])

    // 可聚焦:真的把焦点给它并读回 —— "看起来是链接"不等于"Tab 走得进去"
    const first = links[0]
    if (!first) throw new Error('展开态组内链接没渲染出来 ⇒ 本用例无从判可聚焦')
    first.focus()
    expect(document.activeElement).toBe(first)

    expect(toggleHeader().getAttribute('aria-expanded')).toBe('true')
  })

  it('③ 折叠但动画未跑完:内容仍在 DOM(卸载等满时长,不是折叠即消失)', () => {
    renderGroup()

    fireEvent.click(toggleHeader())
    expect(toggleHeader().getAttribute('aria-expanded')).toBe('false')

    // 一秒都没推进 ⇒ 必须还在
    expect(linksInDocument()).toHaveLength(2)
    // 推进到差 1ms ⇒ 仍然在(证明卸载点是"动画时长",不是"任意一帧")
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_ANIMATION_MS - 1)
    })
    expect(linksInDocument()).toHaveLength(2)
  })

  it('① 折叠 + 时间前进过动画时长:组内链接从 DOM 卸载,撤出 Tab 序', () => {
    renderGroup()
    expect(linksInDocument()).toHaveLength(2)

    fireEvent.click(toggleHeader())
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_ANIMATION_MS)
    })

    // 卸载 ⇒ 键盘 Tab 结构上不可能再走进这些链接(假环境不实现 inert 焦点语义,所以判据只押这里)
    expect(linksInDocument()).toHaveLength(0)
    expect(document.querySelector('a[href="/ai/chat"]')).toBeNull()

    // 卸载后不留 visibility/opacity 假隐藏(整棵内容子树不在,而不是被藏起来)
    expect(document.querySelector('.overflow-hidden')?.childElementCount).toBe(0)
    expect(toggleHeader().getAttribute('aria-expanded')).toBe('false')
  })

  it('⑤ header 的 aria-controls 与内容容器 id 由同一个 useId() 配对,折叠后仍指得到', () => {
    const { container } = renderGroup()

    const controls = toggleHeader().getAttribute('aria-controls')
    expect(controls, 'header 缺 aria-controls ⇒ 辅助技术跟着不了折叠状态').toBeTruthy()

    const target = container.querySelector(`[id="${controls}"]`)
    expect(target, 'aria-controls 指向的 id 在 DOM 里不存在').not.toBeNull()

    // 折叠 + 动画跑完:内容卸载了,但配对的那个容器仍在(id 目标不得指空)
    fireEvent.click(toggleHeader())
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_ANIMATION_MS)
    })
    expect(container.querySelector(`[id="${controls}"]`)).not.toBeNull()
    expect(linksInDocument()).toHaveLength(0)
  })

  it('重新展开:立刻渲染组内链接(卸载不是一次性的)', () => {
    renderGroup()

    fireEvent.click(toggleHeader())
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_ANIMATION_MS)
    })
    expect(linksInDocument()).toHaveLength(0)

    fireEvent.click(toggleHeader())
    // 展开 ⇒ 立刻渲染,不需要推进任何计时器
    expect(linksInDocument()).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
