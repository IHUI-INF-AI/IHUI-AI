// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D196 Mermaid 缩放控件 + D198 图表「复制为图片」接线测试:
// mermaid 渲染仍走 mock(不依赖真实渲染),缩放断言倍率数值与 transform 挂载,
// 复制图片断言 svgElementToPngBlob → ClipboardItem → clipboard.write 链路。

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'

// mock next-themes,避免 ThemeProvider 上下文缺失
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// mock next-intl:直接回键名,断言 aria-label 走的是 i18n 键
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// mock mermaid 模块,避免依赖真实渲染
const mockMermaidRender = vi.fn()
const mockMermaidInitialize = vi.fn()
vi.mock('mermaid', () => ({
  default: {
    initialize: mockMermaidInitialize.mockResolvedValue(undefined),
    render: mockMermaidRender,
  },
}))

// D198:落盘层 mock,接线测试只验调用链
const mockSvgToPng = vi.fn()
vi.mock('@/lib/copy-as-image', () => ({
  svgElementToPngBlob: (...args: unknown[]) => mockSvgToPng(...args),
}))

import { MermaidDiagram } from '../MermaidDiagram'

class ClipboardItemStub {
  data: Record<string, Blob>
  constructor(data: Record<string, Blob>) {
    this.data = data
  }
}

const writeMock = vi.fn()

async function renderSvg(): Promise<ReturnType<typeof render>> {
  mockMermaidRender.mockResolvedValue({ svg: '<svg><text>mocked</text></svg>' })
  const view = render(<MermaidDiagram code="graph TD;A-->B" />)
  await waitFor(() => {
    expect(view.container.querySelector('svg')).not.toBeNull()
  })
  return view
}

function levelText(view: ReturnType<typeof render>): string {
  return view.getByTestId('mermaid-zoom-level').textContent ?? ''
}

describe('MermaidDiagram — D196 缩放控件', () => {
  beforeEach(() => {
    mockMermaidRender.mockReset()
    mockMermaidInitialize.mockReset()
    mockMermaidInitialize.mockResolvedValue(undefined)
    mockSvgToPng.mockReset()
    writeMock.mockReset()
  })

  afterEach(() => {
    // vitest 未开 globals → RTL 不自动清理,必须显式 cleanup(仓内惯例)
    cleanup()
    vi.unstubAllGlobals()
    delete (window.navigator as unknown as Record<string, unknown>).clipboard
  })

  it('渲染成功挂工具条:缩放档位显示 100%,zoom=1 时无 transform(渲染路径与无缩放版一致)', async () => {
    const view = await renderSvg()
    expect(view.getByTestId('mermaid-zoom-toolbar')).toBeTruthy()
    expect(view.getByTestId('mermaid-scroll')).toBeTruthy()
    expect(levelText(view)).toBe('100%')
    const zoomed = view.container.querySelector('[data-testid="mermaid-scroll"] > div') as HTMLElement
    expect(zoomed.getAttribute('style')).toBeNull()
  })

  it('放大 → 120%,transform 挂 scale(1.2);再缩小回 100%,transform 移除', async () => {
    const view = await renderSvg()
    fireEvent.click(view.getByTestId('mermaid-zoom-in'))
    expect(levelText(view)).toBe('120%')
    const zoomed = view.container.querySelector('[data-testid="mermaid-scroll"] > div') as HTMLElement
    expect(zoomed.getAttribute('style')).toContain('scale(1.2)')
    expect(zoomed.getAttribute('style')).toContain('transform-origin')

    fireEvent.click(view.getByTestId('mermaid-zoom-out'))
    expect(levelText(view)).toBe('100%')
    // React 清空 style 后会残留空的 style="" 属性,断言「不再含 scale」而非属性消失
    expect(zoomed.getAttribute('style') ?? '').not.toContain('scale')
  })

  it('倍率钳制:连续放大封顶 400%,连续缩小触底 40%', async () => {
    const view = await renderSvg()
    for (let i = 0; i < 16; i += 1) fireEvent.click(view.getByTestId('mermaid-zoom-in'))
    expect(levelText(view)).toBe('400%')
    for (let i = 0; i < 24; i += 1) fireEvent.click(view.getByTestId('mermaid-zoom-out'))
    expect(levelText(view)).toBe('40%')
  })

  it('重置缩放 → 100% 且移除 transform', async () => {
    const view = await renderSvg()
    fireEvent.click(view.getByTestId('mermaid-zoom-in'))
    fireEvent.click(view.getByTestId('mermaid-zoom-reset'))
    expect(levelText(view)).toBe('100%')
    const zoomed = view.container.querySelector('[data-testid="mermaid-scroll"] > div') as HTMLElement
    expect(zoomed.getAttribute('style') ?? '').not.toContain('scale')
  })

  it('适应屏幕:无测量数据(jsdom gBCR=0)时安全回落 100%,不猜尺寸不崩溃', async () => {
    const view = await renderSvg()
    fireEvent.click(view.getByTestId('mermaid-zoom-in'))
    expect(levelText(view)).toBe('120%')
    fireEvent.click(view.getByTestId('mermaid-zoom-fit'))
    expect(levelText(view)).toBe('100%')
  })

  it('动作按钮 aria-label 走 i18n 键(重置缩放/缩放比例/适应屏幕/放大/缩小)', async () => {
    const view = await renderSvg()
    expect(view.getByTestId('mermaid-zoom-in').getAttribute('aria-label')).toBe('mermaidZoomIn')
    expect(view.getByTestId('mermaid-zoom-out').getAttribute('aria-label')).toBe('mermaidZoomOut')
    expect(view.getByTestId('mermaid-zoom-reset').getAttribute('aria-label')).toBe('mermaidZoomReset')
    expect(view.getByTestId('mermaid-zoom-fit').getAttribute('aria-label')).toBe('mermaidZoomToFit')
    expect(view.getByTestId('mermaid-zoom-level').getAttribute('aria-label')).toBe('mermaidZoomLevel')
  })
})

describe('MermaidDiagram — D198 复制为图片', () => {
  beforeEach(() => {
    mockMermaidRender.mockReset()
    mockMermaidInitialize.mockReset()
    mockMermaidInitialize.mockResolvedValue(undefined)
    mockSvgToPng.mockReset()
    writeMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    delete (window.navigator as unknown as Record<string, unknown>).clipboard
  })

  it('点击复制 → svgElementToPngBlob 收到 svg 元素,PNG 以 ClipboardItem 写入剪贴板', async () => {
    const view = await renderSvg()
    vi.stubGlobal('ClipboardItem', ClipboardItemStub)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { write: writeMock.mockResolvedValue(undefined) },
      configurable: true,
    })
    const fakeBlob = new Blob(['png'], { type: 'image/png' })
    mockSvgToPng.mockResolvedValue(fakeBlob)

    fireEvent.click(view.getByTestId('mermaid-copy-image'))
    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1)
    })
    expect(mockSvgToPng).toHaveBeenCalledTimes(1)
    const svgArg = mockSvgToPng.mock.calls[0]?.[0] as SVGSVGElement | undefined
    expect(svgArg?.tagName.toLowerCase()).toBe('svg')
    const item = (writeMock.mock.calls[0]?.[0] as unknown as ClipboardItemStub[])?.[0]
    expect(item).toBeInstanceOf(ClipboardItemStub)
    expect(item?.data['image/png']).toBe(fakeBlob)
  })

  it('环境不支持 ClipboardItem 时点击不产生任何调用(静默降级)', async () => {
    const view = await renderSvg()
    // jsdom 30 其实自带 ClipboardItem,这里 stub 成 undefined 模拟不支持的环境
    vi.stubGlobal('ClipboardItem', undefined)
    expect(typeof ClipboardItem).toBe('undefined')
    fireEvent.click(view.getByTestId('mermaid-copy-image'))
    // 让微任务队列清空
    await waitFor(() => expect(mockSvgToPng).not.toHaveBeenCalled())
    expect(writeMock).not.toHaveBeenCalled()
  })
})
