// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * GlobalShell · AI 面板加载占位必须是**骨架屏**(2026-09-30 升级)防回归测试
 *
 * 为什么单独立这份:
 *   AiPanelPlaceholder 是 next/dynamic({ ssr:false }) 的 loading 插槽 —— 首帧到面板分包
 *   到位之间,用户看到的就是它。此前它是一个纯空白 div:几何对(所以 CLS 探针抓不到),
 *   但体感是"右侧一块空白,过一会突然冒出面板"。升级为骨架屏后,几何 class/宽度**一字
 *   不能动**(动了就是历史 CLS bug 复发),内部必须真的画出骨架(空 div 就是回退)。
 *
 * 测的是**占位本身**:`@/components/ai/ai-side-panel` 被 mock 成 `() => null`,
 * 且 dynamic 首帧处于 loading 态,所以渲染出来的就是 AiPanelPlaceholder(不是真实面板)。
 *
 * 为什么只在**冷加载首帧**取样(beforeAll 里 render 一次,三个用例共用同一次快照):
 *   next/dynamic 的 loading 插槽只在分包未到位时渲染;本文件里该模块被 mock,第一次
 *   render 后 promise 立刻在微任务里 resolve,后续任何一次 render 都会直接渲染真实
 *   组件(mock = null)—— 占位就没了。所以这里**同步**抓住首帧那个节点再逐个断言;
 *   节点被 React 卸载后仍保有完整子树(骨架结构不变),断言依旧成立。
 *
 * 判据分组:
 *   S1 几何仍在(aria-hidden + width: var(--ai-panel-width, 380px) + 响应式/间距 class)
 *   S2 内部真的有骨架(≥5 个 animate-pulse 元素,不是空白 div)
 *   S3 占位不是自闭合空节点
 */
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// —— 与 MainShell.test.tsx 同一套 mock(照抄,保证 GlobalShell 能被轻量渲染)——
vi.mock('@/components/sidebar', () => ({
  Sidebar: (props: { mobileOpen: boolean; onCloseMobile: () => void }) => (
    <div data-testid="sidebar" data-open={String(props.mobileOpen)} />
  ),
  FLAT_NAV_ITEMS: [],
  ALL_NAV_HREFS: [],
  NAV_GROUPS: [],
}))
vi.mock('@/components/common/PageSkeleton', () => ({
  PageSkeleton: () => null,
}))
vi.mock('@/components/common', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    PWAInstallPrompt: () => null,
    PWAUpdatePrompt: () => null,
    NavigationProgress: () => null,
    UpdatePrompt: () => null,
  }
})
// 关键:真实面板 mock 成 null → dynamic 的 loading 插槽(即 AiPanelPlaceholder)被渲染
vi.mock('@/components/ai/ai-side-panel', () => ({
  AISidePanel: () => null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const translate = (key: string) => key
    return Object.assign(translate, { has: () => true })
  },
  useLocale: () => 'zh-CN',
}))

import { GlobalShell } from '../GlobalShell'
import { TooltipProvider } from '@/components/feedback'

// GlobalShell 间接挂载 workspace-permission-request-dialog → usePermissionRequest → useQueryClient
let queryClient: QueryClient
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}

/** 取出 AI 面板占位容器:aria-hidden 且内联 style 引用 --ai-panel-width 变量 */
function findAiPanelPlaceholder(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden]')).find((el) =>
    (el.getAttribute('style') ?? '').replace(/\s+/g, '').includes('var(--ai-panel-width,380px)'),
  )
}

describe('GlobalShell · AI 面板加载占位(骨架屏)', () => {
  /** 冷加载首帧抓到的占位节点(见文件头说明) */
  let placeholder: HTMLElement | undefined

  beforeAll(() => {
    if (typeof window !== 'undefined' && !window.matchMedia) {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
    }
    if (
      typeof globalThis !== 'undefined' &&
      !(globalThis as { ResizeObserver?: unknown }).ResizeObserver
    ) {
      class MockResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      ;(globalThis as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver
    }
    localStorage.clear()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    // 同步取样:render 返回时 dynamic 仍处于 loading,此刻 DOM 里就是 AiPanelPlaceholder
    const { container } = render(
      <GlobalShell>
        <div />
      </GlobalShell>,
      { wrapper: Wrapper },
    )
    placeholder = findAiPanelPlaceholder(container)
  })

  afterAll(() => {
    cleanup()
  })

  it('S1 占位几何一字不动:aria-hidden + --ai-panel-width + 响应式/间距 class', () => {
    expect(placeholder, '应渲染出 AI 面板占位容器').toBeTruthy()

    const el = placeholder as HTMLElement
    expect(el.getAttribute('aria-hidden'), '骨架不得被读屏/a11y 断言命中').toBe('true')
    expect(
      el.getAttribute('style'),
      '宽度必须引用 --ai-panel-width(与真实容器同一变量,挂载时不跳变)',
    ).toContain('var(--ai-panel-width, 380px)')

    const cls = el.className
    for (const token of ['hidden', 'min-[768px]:block', 'shrink-0', 'mr-1.5', 'py-2', 'h-full']) {
      expect(cls.split(/\s+/), `占位 class 应含 ${token}`).toContain(token)
    }
  })

  it('S2 占位内部真的画出骨架(≥5 个 animate-pulse 元素,而非空白 div)', () => {
    expect(placeholder, '应渲染出 AI 面板占位容器').toBeTruthy()

    const pulses = (placeholder as HTMLElement).querySelectorAll('.animate-pulse')
    expect(
      pulses.length,
      '骨架屏内部应有 header + 消息区 + 输入区等骨架块(空白 div 就是回退)',
    ).toBeGreaterThanOrEqual(5)

    // 骨架块还应带 muted 底色(只有 animate-pulse 而无底色 = 看不见的骨架,同样算回退)
    const muted = (placeholder as HTMLElement).querySelectorAll('.bg-muted')
    expect(muted.length, '骨架块应带 bg-muted 底色').toBeGreaterThanOrEqual(5)
  })

  it('S3 占位不是自闭合空节点(有子节点)', () => {
    const el = placeholder as HTMLElement
    expect(el.childElementCount, '占位容器内应有骨架结构').toBeGreaterThan(0)
    expect(el.innerHTML.trim().length, '占位容器不应是空节点').toBeGreaterThan(0)
  })
})
