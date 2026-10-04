// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * GlobalShell · AI 面板占位必须是**骨架屏**(2026-09-30 升级)防回归测试
 *
 * 2026-10-05 重定取样前提(红的不是几何被改坏,是**取样路径没了**):
 *   原测法靠"`@/components/ai/ai-side-panel` 被 mock 成 null + next/dynamic({ssr:false}) 首帧
 *   处于 loading ⇒ 从 GlobalShell 的冷加载快照里抓那个占位节点"。但 2026-09-30 用户强制
 *   「面板 0ms 在场,不允许任何空白/骨架过渡」之后,AISidePanel 已回归**静态 import**
 *   (GlobalShell.tsx:18),Suspense 在冷帧不再挂起 —— 占位节点根本不在 DOM 里,S1/S2/S3
 *   三条一起红。该架构改动是有意为之且已有尺子:守门 171
 *   `scripts/check-ai-panel-mount-guards.mjs` 的 R1 写死「静态 import 必须在、dynamic 必须无」,
 *   其 GOOD 夹具注释原文即「AISidePanel 静态 import(0ms 在场不变量)+ Suspense fallback 复用
 *   AiPanelPlaceholder 组件本体」。所以本票只改**怎么取样**,一条断言都没放宽。
 *
 * 现在测什么(两组各自独立,不得互相顶账):
 *   P1-P3 占位本体的契约 —— 直接 render(<AiPanelPlaceholder />)。骨架屏的几何与内部结构是
 *     历史 0.21 CLS 事故的锁(占位与真实容器不同宽 ⇒ 面板落地时把内容区推走),与"它此刻
 *     是否恰好被渲染"无关,所以按组件本身测,不再依赖加载时序。
 *   P4 「0ms 在场」反保证 —— render(<GlobalShell>) 的**同步首帧**里必须真有面板本体,且
 *     **不得**出现等宽占位(出现 = 有人把面板改回 dynamic 懒加载,首帧又变成一块空白)。
 *
 * 宽度锚点不再写死数字(这一型本仓吃过多次):P1 把占位的 CSS 变量 fallback 与
 *   `app/layout.tsx` 内联脚本预设的 `--ai-panel-width` **逐字对账**。两处必须是同一个值
 *   (挂载时不跳变的全部理由),而写死 380 或 480 都只能盯住其中一侧 —— 原测试写死 380,
 *   源码现值已是 480,所以它连"另一端被人改过"都报不出来。
 */
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
// P4 问的是「面板本体在不在首帧」,所以 mock 成带 testid 的标记节点而不是 null
// —— 旧的 `() => null` 是为"抓占位"服务的:那时面板必须不出现,占位才会被渲染出来。
vi.mock('@/components/ai/ai-side-panel', () => ({
  AISidePanel: () => <div data-testid="ai-side-panel-marker" />,
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

import { AiPanelPlaceholder, GlobalShell } from '../GlobalShell'
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

/**
 * 取出 AI 面板占位容器:aria-hidden 且内联 style 引用 --ai-panel-width。
 * 这里**刻意只认变量名、不认具体 px** —— 变量身份是这一族的指纹,而"fallback 该等于多少"
 * 归 P1 单独判(并去和 layout.tsx 对账)。 finder 里写死数字 = 换值时整族找不到,
 * 表现成"没有占位"而不是"占位改宽了"。
 */
function findAiPanelPlaceholder(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden]')).find((el) =>
    (el.getAttribute('style') ?? '').replace(/\s+/g, '').includes('--ai-panel-width'),
  )
}

/**
 * `app/layout.tsx` 内联脚本给 `--ai-panel-width` 预设的**字面**值(读不到 localStorage 或
 * 值越界时的兜底)。只匹配字面量那一处:同文件里另有 `setProperty('--ai-panel-width', w+'px')`
 * 是持久化值的正常路径,不参与对账。取不到 ⇒ 抛(判据失明),不得当成通过。
 */
function layoutPanelWidthPreset(): string {
  const src = readFileSync(resolve(process.cwd(), 'app/layout.tsx'), 'utf8')
  const preset = src.match(/setProperty\('--ai-panel-width',\s*'(\d+)px'\)/)?.[1]
  if (preset === undefined) {
    throw new Error('判据失明:app/layout.tsx 里没解析到 --ai-panel-width 的字面预设值,不判为通过')
  }
  return preset
}

/** jsdom 缺的两件(GlobalShell 与其子组件都会问),两个 describe 共用 */
function installDomShims() {
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
}

describe('GlobalShell · AI 面板加载占位(骨架屏本体契约 P1-P3)', () => {
  /** 直接渲染占位本体拿到的节点(见文件头:P1-P3 不再依赖加载时序) */
  let placeholder: HTMLElement | undefined

  beforeAll(() => {
    installDomShims()
    const { container } = render(<AiPanelPlaceholder />)
    placeholder = findAiPanelPlaceholder(container)
  })

  afterAll(() => {
    cleanup()
  })

  it('P1 几何一字不动:aria-hidden + --ai-panel-width 与 layout.tsx 预设同值 + 响应式/间距 class', () => {
    expect(placeholder, '应渲染出 AI 面板占位容器').toBeTruthy()

    const el = placeholder as HTMLElement
    expect(el.getAttribute('aria-hidden'), '骨架不得被读屏/a11y 断言命中').toBe('true')

    const preset = layoutPanelWidthPreset()
    expect(
      el.getAttribute('style'),
      `宽度必须引用 --ai-panel-width,且 fallback 与 app/layout.tsx 的预设同值(${preset}px)—— 两处不同值就是历史 0.21 CLS 复发`,
    ).toContain(`var(--ai-panel-width, ${preset}px)`)

    const cls = el.className
    for (const token of ['hidden', 'min-[768px]:block', 'shrink-0', 'mr-1.5', 'py-2', 'h-full']) {
      expect(cls.split(/\s+/), `占位 class 应含 ${token}`).toContain(token)
    }
  })

  it('P2 占位内部真的画出骨架(≥5 个 animate-pulse 元素,而非空白 div)', () => {
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

  it('P3 占位不是自闭合空节点(有子节点)', () => {
    const el = placeholder as HTMLElement
    expect(el.childElementCount, '占位容器内应有骨架结构').toBeGreaterThan(0)
    expect(el.innerHTML.trim().length, '占位容器不应是空节点').toBeGreaterThan(0)
  })
})

describe('GlobalShell · 「面板 0ms 在场」反保证(2026-09-30 用户强制)', () => {
  beforeAll(() => {
    installDomShims()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  afterAll(() => {
    cleanup()
  })

  it('P4 同步首帧:面板本体在位,且不得出现骨架占位(出现 = 被改回 dynamic 懒加载)', () => {
    const { container, getByTestId } = render(
      <GlobalShell>
        <div />
      </GlobalShell>,
      { wrapper: Wrapper },
    )
    // 中间不 await、不 act:这里问的就是**首帧**。
    expect(getByTestId('ai-side-panel-marker'), '首帧没有面板本体').not.toBeNull()
    expect(
      findAiPanelPlaceholder(container),
      '首帧出现了等宽占位 ⇒ 面板又变成"先空白一会儿再冒出",违反 0ms 在场',
    ).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
