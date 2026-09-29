// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D198 代码块「复制为图片」接线测试:按钮 → codeTextToPngBlob(dark 注入)
// → ClipboardItem('image/png') → clipboard.write,mock 头与 code-block-wrap.test.tsx 一致。

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'

const { mockCodeToPng, writeMock } = vi.hoisted(() => ({
  mockCodeToPng: vi.fn(),
  writeMock: vi.fn(),
}))

vi.mock('@/lib/copy-as-image', () => ({
  codeTextToPngBlob: (...args: unknown[]) => mockCodeToPng(...args),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { language?: string; children?: string }) =>
    React.createElement('pre', { 'data-testid': 'syntax-highlighter' }, children),
}))
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { __styleKey: 'oneDark' },
  oneLight: { __styleKey: 'oneLight' },
}))
vi.mock('@/components/media/MermaidDiagram', () => ({
  default: ({ code }: { code?: string }) =>
    React.createElement('div', { 'data-testid': 'mermaid' }, code),
}))

import { MarkdownStream } from '../markdown-stream'

class ClipboardItemStub {
  data: Record<string, Blob>
  constructor(data: Record<string, Blob>) {
    this.data = data
  }
}

const JS_BLOCK = ['```js', 'const a = 1', '```'].join('\n')

describe('D198 — 代码块复制为图片', () => {
  beforeEach(() => {
    mockCodeToPng.mockReset()
    writeMock.mockReset()
  })

  afterEach(() => {
    // vitest 未开 globals → RTL 不自动清理,必须显式 cleanup(仓内惯例)
    cleanup()
    vi.unstubAllGlobals()
  })

  function stubClipboard(): void {
    vi.stubGlobal('ClipboardItem', ClipboardItemStub)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { write: writeMock.mockResolvedValue(undefined) },
      configurable: true,
    })
  }

  it('按钮在位,aria-label 走 codeBlock.copyImage 键', () => {
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    const btn = container.querySelector('[data-testid="copy-image-button"]') as HTMLElement
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toBe('codeBlock.copyImage')
  })

  it('点击 → codeTextToPngBlob 收到完整代码,PNG 以 ClipboardItem 写入剪贴板,按钮转 Check 反馈', async () => {
    stubClipboard()
    const fakeBlob = new Blob(['png'], { type: 'image/png' })
    mockCodeToPng.mockResolvedValue(fakeBlob)
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    const btn = container.querySelector('[data-testid="copy-image-button"]') as HTMLElement

    fireEvent.click(btn)
    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1)
    })
    expect(mockCodeToPng).toHaveBeenCalledTimes(1)
    expect(mockCodeToPng.mock.calls[0]?.[0]).toBe('const a = 1')
    const item = (writeMock.mock.calls[0]?.[0] as unknown as ClipboardItemStub[])?.[0]
    expect(item).toBeInstanceOf(ClipboardItemStub)
    expect(item?.data['image/png']).toBe(fakeBlob)
    // 成功反馈:图标短暂切为 Check(lucide-check 类)
    await waitFor(() => {
      expect(btn.querySelector('svg.lucide-check')).not.toBeNull()
    })
    vi.unstubAllGlobals()
  })

  it('无 ClipboardItem 环境:点击零调用(静默降级,不报错)', async () => {
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    // jsdom 30 自带 ClipboardItem,stub 成 undefined 模拟不支持的环境
    vi.stubGlobal('ClipboardItem', undefined)
    expect(typeof ClipboardItem).toBe('undefined')
    fireEvent.click(container.querySelector('[data-testid="copy-image-button"]') as HTMLElement)
    await waitFor(() => expect(mockCodeToPng).not.toHaveBeenCalled())
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('落盘失败(拒绝)时静默吞错,不写剪贴板不崩页面', async () => {
    stubClipboard()
    mockCodeToPng.mockRejectedValue(new Error('canvas unavailable'))
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    fireEvent.click(container.querySelector('[data-testid="copy-image-button"]') as HTMLElement)
    await waitFor(() => {
      expect(mockCodeToPng).toHaveBeenCalledTimes(1)
    })
    await Promise.resolve()
    expect(writeMock).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="copy-image-button"]')).toBeTruthy()
    vi.unstubAllGlobals()
  })
})
