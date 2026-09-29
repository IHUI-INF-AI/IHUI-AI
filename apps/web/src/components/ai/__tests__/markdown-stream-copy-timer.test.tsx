// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-834:「已复制」态的 timer 句柄必须在卸载时回收。
// 被测面 = apps/web markdown-stream 的 useCopy(修复写法照仓内先例
// apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:347-368:
// 句柄收进 copyTimerRef + 卸载 useEffect clearTimeout + 再复制先清旧句柄)。
// ⚠️ ui-react 侧 code-block.tsx 的同型修复在本文件**不被覆盖** —— 该包无可跑测试入口
// (无 vitest.config.ts、package.json 无 test 脚本),只能 typecheck,交付报告如实标「行为未测试」。
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'

// 以下 mock 面与既有 markdown-stream.test.tsx 保持一致(next-intl / Tooltip /
// 高亮库 / next-themes / mermaid),不在这里另立第二套环境语义。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
const { mockUseTheme } = vi.hoisted(() => ({
  mockUseTheme: vi.fn((): { resolvedTheme: 'light' | 'dark' } => ({ resolvedTheme: 'light' })),
}))
vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))
vi.mock('react-syntax-highlighter', async () => ({
  Prism: ({ children }: { children?: string }) =>
    React.createElement('pre', { 'data-testid': 'syntax-highlighter' }, children),
}))
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { __styleKey: 'oneDark' },
  oneLight: { __styleKey: 'oneLight' },
}))
vi.mock('@/components/media/MermaidDiagram', async () => ({
  default: ({ code }: { code?: string }) =>
    React.createElement('div', { 'data-testid': 'mermaid' }, code),
}))

import { MarkdownStream } from '../markdown-stream'

/**
 * 计时器取证替身:包装真 setTimeout/clearTimeout(行为不变),旁路记录
 * scheduled = 全部 delay===1500 的返回值(本组件里「已复制」回退是唯一的 1500ms 档:
 * useDebounce=300、节流 trailing=50/150/400;apply 的 1500 档只在点「应用到文件」时产生,
 * 而本文件用例只点复制按钮),cleared = 全部被 clearTimeout 的句柄。
 * 两条实测教训(b834-1 首跑 readback,失败归因都在这把尺子自身而非被测件):
 * ① 不读 spy.mock.results —— vitest 大版本间 results 形状不保证;
 * ② 不押注句柄是 number —— vitest v4+jsdom 下 window.setTimeout 实际返回 Node Timeout 对象
 *   (断言 typeof==='number' 因此误红;而 Timeout._destroyed:true 恰是组件卸载时真的
 *   clearTimeout 了的直接证据 ⇒ 修复有效,取证工具类型假设错了)。
 * ⇒ scheduled/cleared 按原值(unknown)记录,比对「同一句柄」引用。
 */
function installTimerSpies() {
  const scheduled: unknown[] = []
  const cleared: unknown[] = []
  const originalSet = window.setTimeout as unknown as (...args: unknown[]) => unknown
  const originalClear = window.clearTimeout as unknown as (...args: unknown[]) => void
  vi.spyOn(window, 'setTimeout').mockImplementation(
    ((...args: unknown[]) => {
      const id = originalSet(...args)
      if (args[1] === 1500) scheduled.push(id)
      return id
    }) as unknown as typeof window.setTimeout,
  )
  vi.spyOn(window, 'clearTimeout').mockImplementation(
    ((...args: unknown[]) => {
      if (args[0] !== undefined) cleared.push(args[0])
      return originalClear(...args)
    }) as unknown as typeof window.clearTimeout,
  )
  return { scheduled, cleared }
}

describe('MarkdownStream「已复制」timer 生命周期(G-834)', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    // jsdom 默认无 clipboard,注入 mock(同 markdown-stream.test.tsx 的 beforeEach)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /** 点复制并冲掉 writeText 的微任务链,让「.then 里挂 timer」真实执行 */
  async function clickCopy(container: HTMLElement): Promise<void> {
    const button = container.querySelector(
      'button[data-testid="copy-button"]',
    ) as HTMLButtonElement
    expect(button).toBeTruthy()
    fireEvent.click(button)
    await act(async () => {})
  }

  const plainTextBlock = '```text\nconst y = 2\n```'

  it('对照:未点复制时不排任何 1500ms「已复制」timer', () => {
    const { scheduled } = installTimerSpies()
    render(<MarkdownStream content={plainTextBlock} />)
    expect(scheduled).toHaveLength(0)
  })

  it('卸载回收:点复制后卸载,clearTimeout 恰好收到该 1500ms 句柄', async () => {
    const { scheduled, cleared } = installTimerSpies()
    const { container, unmount } = render(<MarkdownStream content={plainTextBlock} />)
    await clickCopy(container)

    // 先证「点击真的走了 clipboard」再证「挂了 timer」——
    // 否则 scheduled 为空时无法区分「timer 没回收」与「点击根本没生效」,用例失去归因力
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(scheduled).toHaveLength(1)

    unmount()
    expect(cleared).toContain(scheduled[0])
  })

  it('再复制回收:第二次复制先清上一句柄;卸载时再清当前句柄', async () => {
    const { scheduled, cleared } = installTimerSpies()
    const { container, unmount } = render(<MarkdownStream content={plainTextBlock} />)
    await clickCopy(container)
    expect(scheduled).toHaveLength(1)
    const first = scheduled[0]
    expect(first).toBeDefined()

    await clickCopy(container)
    expect(scheduled).toHaveLength(2)
    expect(cleared).toContain(first)

    unmount()
    expect(cleared).toContain(scheduled[1])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
