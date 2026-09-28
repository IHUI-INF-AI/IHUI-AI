// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// @vitest-environment jsdom
/**
 * MermaidDiagram 的预算闸与可见性闸(组件面)。
 *
 * 断言的是"render 到底有没有被调用",不是组件自证:
 * 预算的意义在于**不进** mermaid.render,所以 mock 调用次数才是判据;
 * 降级块则断言"显示了提示 + 源码",防止回退成静默空白。
 */
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup, act } from '@testing-library/react'

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// 按 key 原样回值:既证明"文案走语言包",又能断言"组件里没有硬编码中文"
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockMermaidRender = vi.fn()
const mockMermaidInitialize = vi.fn()
vi.mock('mermaid', () => ({
  default: {
    initialize: mockMermaidInitialize.mockResolvedValue(undefined),
    render: mockMermaidRender,
  },
}))

import { MermaidDiagram } from '../MermaidDiagram'
import { MERMAID_RENDER_BUDGET } from '@/components/ai/mermaid-render-budget'

/** 超结构档但不超字符/行档的一段图(与纯函数面同一夹具口径)。 */
function overComplexitySource(): string {
  const lines = ['graph TD']
  for (let i = 0; i < MERMAID_RENDER_BUDGET.maxStructuralComplexity / 2 + 5; i++) {
    lines.push(`  N${i}[n${i}] --> N${i + 1}`)
  }
  return lines.join('\n')
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

/**
 * 让"本该被拦掉的那次 render"有时间真的发生。
 *
 * 不加这一步,`expect(render).not.toHaveBeenCalled()` 是**恒真**的 —— run() 里
 * render 之前还有 `await import('mermaid')`,同步断言时它必然还没跑到。
 * 这条是本项目最容易复现的假绿型:用例看着在判"没渲染",其实只判了"还没到时候"。
 */
async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  })
}

describe('MermaidDiagram 预算闸', () => {
  beforeEach(() => {
    mockMermaidRender.mockReset()
    mockMermaidInitialize.mockReset()
    mockMermaidInitialize.mockResolvedValue(undefined)
    setVisibility('visible')
  })
  afterEach(() => {
    cleanup()
  })

  it('正常图:照旧进 mermaid.render', async () => {
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>ok</text></svg>' })
    const { container } = render(<MermaidDiagram code="graph TD;A-->B" />)
    await waitFor(() => expect(container.innerHTML).toContain('<svg'))
    expect(mockMermaidRender).toHaveBeenCalledTimes(1)
  })

  it('超预算:一次都不进 render,且回落成「提示 + 源码」而不是空白', async () => {
    mockMermaidRender.mockResolvedValue({ svg: '<svg>should-never-appear</svg>' })
    const code = overComplexitySource()
    const { container } = render(<MermaidDiagram code={code} />)

    expect(container.innerHTML).toContain('mermaidSkipComplexityTooLarge')
    // 源码可见(不是静默变空白)
    expect(container.querySelector('pre')?.textContent).toContain('graph TD')
    expect(container.innerHTML).not.toContain('should-never-appear')

    // 让任何可能的异步渲染有机会真的发生之后,仍然没被调用过
    await flushAsyncWork()
    expect(mockMermaidRender).not.toHaveBeenCalled()
  })

  it('降级提示走语言包:提示位不得出现硬编码中文(守门 §19)', () => {
    const { container } = render(<MermaidDiagram code={overComplexitySource()} />)
    const notice = container.querySelector('p')?.textContent ?? ''
    expect(/[\u3400-\u9fff]/.test(notice)).toBe(false)
    expect(notice.length).toBeGreaterThan(0)
  })

  it('页面在后台:不进 render,也不显示"已降级"(那是调度延迟不是内容问题)', async () => {
    setVisibility('hidden')
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>hidden-work</text></svg>' })
    const { container } = render(<MermaidDiagram code="graph TD;A-->B" />)
    await flushAsyncWork()
    expect(mockMermaidRender).not.toHaveBeenCalled()
    // 占位取的是既有 a11y.diagramRendering(mock 原样回显键名),不是降级提示
    expect(container.textContent).toContain('diagramRendering')
    expect(container.innerHTML).not.toContain('mermaidSkip')
    expect(container.innerHTML).not.toContain('hidden-work')
  })

  it('从后台回到前台:补上这一次渲染,且不因反复切换而重复渲染', async () => {
    setVisibility('hidden')
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>late</text></svg>' })
    const { container } = render(<MermaidDiagram code="graph TD;A-->B" />)
    await flushAsyncWork()
    expect(mockMermaidRender).not.toHaveBeenCalled()

    act(() => {
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(mockMermaidRender).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(container.innerHTML).toContain('late'))

    // 再切走 / 切回:图已在,不该再付一次全量布局
    act(() => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => {
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await flushAsyncWork()
    await flushAsyncWork()
    expect(mockMermaidRender).toHaveBeenCalledTimes(1)
  })
})
