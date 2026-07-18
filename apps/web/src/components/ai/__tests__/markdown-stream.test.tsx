// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

// Mock react-syntax-highlighter 的 Prism 为可检测的 <pre>(避免加载真实高亮库)
vi.mock('react-syntax-highlighter', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    Prism: ({ language, children }: { language?: string; children?: string }) =>
      React.createElement(
        'pre',
        { 'data-testid': 'syntax-highlighter', className: `language-${language ?? ''}` },
        children,
      ),
  }
})

// Mock 主题对象(避免加载真实样式表)
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
}))

// Mock MermaidDiagram,避免依赖真实 mermaid(测试不依赖真实渲染)
vi.mock('@/components/media/MermaidDiagram', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({ code }: { code: string }) =>
      React.createElement('div', { 'data-testid': 'mermaid' }, code),
  }
})

import { MarkdownStream } from '../markdown-stream'

describe('MarkdownStream - P2-1 流式 Markdown 增强', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    // jsdom 默认无 clipboard,这里注入 mock
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  it('未闭合代码块能渲染为 <pre>(而非段落)', async () => {
    // 流式中的代码块,未闭合(只有一个 ```)
    const content = '前文\n```js\nconst x = 1'

    const { container } = render(<MarkdownStream content={content} isStreaming />)

    // 应该渲染出 <pre>(代码块),且包含代码内容
    // 代码块走 SyntaxHighlighter(动态加载),需等待内容渲染
    await waitFor(() => {
      expect(container.querySelector('pre')).toBeTruthy()
      expect(container.textContent).toContain('const x = 1')
    })
    // 流式中的代码块带 opacity-60 标记(临时闭合位置)
    const pre = container.querySelector('pre')
    expect(pre?.className).toContain('opacity-60')
  })

  it('完整代码块渲染语法高亮(SyntaxHighlighter 被调用 + className 含 language-)', async () => {
    const content = '```js\nconst x = 1\n```'

    const { container } = render(<MarkdownStream content={content} />)

    // 等待动态加载的 SyntaxHighlighter 渲染完成
    await waitFor(() => {
      const sh = container.querySelector('[data-testid="syntax-highlighter"]')
      expect(sh).toBeTruthy()
    })
    const sh = container.querySelector('[data-testid="syntax-highlighter"]')
    // className 应包含 language-js
    expect(sh?.className).toContain('language-js')
    // 代码内容应渲染
    expect(sh?.textContent).toContain('const x = 1')
  })

  it('复制按钮点击后调用 navigator.clipboard.writeText', () => {
    const content = '```js\nconst x = 1\n```'

    const { container } = render(<MarkdownStream content={content} />)

    // 复制按钮同步渲染(在 <pre> 中)
    const button = container.querySelector(
      'button[data-testid="copy-button"]',
    ) as HTMLButtonElement
    expect(button).toBeTruthy()

    fireEvent.click(button)

    expect(writeText).toHaveBeenCalledTimes(1)
    // 代码内容(可能带尾换行,用 stringContaining 兼容)
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('const x = 1'))
  })

  it('复制按钮 hover 有视觉变化(className 含 hover:bg-,不含蓝光/纯黑边框)', () => {
    const content = '```js\nconst x = 1\n```'

    const { container } = render(<MarkdownStream content={content} />)

    const button = container.querySelector('button[data-testid="copy-button"]')
    expect(button).toBeTruthy()
    // hover 状态用浅色背景变化(项目 UI 规范:不要蓝光边框,不要纯黑边框)
    expect(button?.className).toMatch(/hover:bg-/)
    expect(button?.className).not.toMatch(/hover:border-blue/)
    expect(button?.className).not.toMatch(/hover:border-black/)
    // 按钮尺寸 h-7 w-7,圆角 rounded-md
    expect(button?.className).toContain('h-7')
    expect(button?.className).toContain('w-7')
    expect(button?.className).toContain('rounded-md')
  })

  it('纯文本语言(text/plain)不走 SyntaxHighlighter,直接渲染 <pre>', () => {
    const content = '```text\nplain code here\n```'

    const { container } = render(<MarkdownStream content={content} />)

    // 不应渲染 SyntaxHighlighter(避免开销)
    expect(container.querySelector('[data-testid="syntax-highlighter"]')).toBeNull()
    // 应该渲染 <pre>(纯文本)
    const pre = container.querySelector('pre')
    expect(pre).toBeTruthy()
    expect(pre?.textContent).toContain('plain code here')
    // 纯文本代码块也应有复制按钮
    expect(container.querySelector('button[data-testid="copy-button"]')).toBeTruthy()
  })

  it('增量解析:content 扩展时已渲染代码块的 DOM 节点保留(key 稳定 + memo)', async () => {
    // 用 > 20 字符的代码,确保 code.slice(0, 20) 在两次渲染间稳定
    const code1 = 'const a = 1\nconst b = 2\nconst c = 3\n'
    const code2 = 'const d = 4\nconst e = 5\nconst f = 6\n'
    const content1 = '```js\n' + code1 + '```'
    const content2 = content1 + '\n```ts\n' + code2 + '```'

    const { container, rerender } = render(<MarkdownStream content={content1} />)

    // 等待第一个代码块的 SyntaxHighlighter 加载完成
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="syntax-highlighter"]')).toHaveLength(1)
    })
    const firstBlock = container.querySelector('[data-testid="syntax-highlighter"]')!

    // 扩展 content(在末尾追加新代码块,不改变已有结构)
    rerender(<MarkdownStream content={content2} />)

    // 等待第二个代码块加载完成
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="syntax-highlighter"]')).toHaveLength(2)
    })

    // 第一个代码块的 DOM 节点应该被保留(说明 key 稳定 + React.memo 生效)
    const firstBlockAfter = container.querySelectorAll(
      '[data-testid="syntax-highlighter"]',
    )[0]!
    expect(firstBlockAfter).toBe(firstBlock)
  })

  it('mermaid 代码块仍交给 MermaidDiagram 渲染(不动 mermaid 分支)', async () => {
    const content = '```mermaid\ngraph TD;A-->B\n```'

    const { container } = render(<MarkdownStream content={content} />)

    // 应渲染 MermaidDiagram(mock 后为 data-testid="mermaid")
    await waitFor(() => {
      expect(container.querySelector('[data-testid="mermaid"]')).toBeTruthy()
    })
    // 不应渲染 SyntaxHighlighter
    expect(container.querySelector('[data-testid="syntax-highlighter"]')).toBeNull()
  })
})
