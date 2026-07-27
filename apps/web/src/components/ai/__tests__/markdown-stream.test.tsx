// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

// next-intl 在 vitest 下不接 NextIntlClientProvider 上下文,直接 mock 掉 useTranslations
// 用 key 直接当 label 返回(测试不依赖 i18n 文案正确性,只验证 aria-label 渲染逻辑)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const renderWithIntl = (ui: React.ReactElement) => render(ui)

// 提升 vi.fn 引用,便于在 mock 工厂和测试用例中共享(支持运行时改主题)
// 返回类型用 union 形式,允许测试动态切换 light/dark
const { mockUseTheme } = vi.hoisted(() => ({
  mockUseTheme: vi.fn((): { resolvedTheme: 'light' | 'dark' } => ({ resolvedTheme: 'light' })),
}))

// Mock react-syntax-highlighter 的 Prism 为可检测的 <pre>(避免加载真实高亮库)
vi.mock('react-syntax-highlighter', async () => {
  return {
    Prism: ({
      language,
      style,
      children,
    }: {
      language?: string
      style?: unknown
      children?: string
    }) => {
      // P2 中期增强测试:把传入的 style 序列化到 data-* 属性,用于验证主题切换
      const styleAttr = style ? `__style__:${JSON.stringify(style)}` : ''
      return React.createElement(
        'pre',
        {
          'data-testid': 'syntax-highlighter',
          'data-style-key': styleAttr,
          className: `language-${language ?? ''}`,
        },
        children,
      )
    },
  }
})

// Mock next-themes:用 vi.hoisted 提供的 vi.fn,支持在用例中动态切换 resolvedTheme
vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))

// Mock 主题对象(避免加载真实样式表)
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { __styleKey: 'oneDark' },
  oneLight: { __styleKey: 'oneLight' },
}))

// Mock MermaidDiagram,避免依赖真实 mermaid(测试不依赖真实渲染)
vi.mock('@/components/media/MermaidDiagram', async () => {
  return {
    default: ({ code }: { code?: string }) =>
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

    const { container } = renderWithIntl(<MarkdownStream content={content} isStreaming />)

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
    const button = container.querySelector('button[data-testid="copy-button"]') as HTMLButtonElement
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
    const firstBlockAfter = container.querySelectorAll('[data-testid="syntax-highlighter"]')[0]!
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

/**
 * P2 中期增强:oneDark → oneLight 主题切换测试。
 *
 * 验证项:
 *   - resolvedTheme='light' 时,SyntaxHighlighter 收到 oneLight 样式对象
 *   - resolvedTheme='dark' 时,SyntaxHighlighter 收到 oneDark 样式对象
 *   - <pre> 容器背景在 light/dark 下使用不同 bg 类(bg-zinc-100 / dark:bg-zinc-950)
 */
describe('MarkdownStream - P2 中期增强 oneDark → oneLight 主题切换', () => {
  beforeEach(() => {
    // 每个用例前重置为 light
    // 用 mockReturnValue(不用 Once),因为单个 render 中 useTheme 会被调用多次
    // (MarkdownStream 一次 + ThemedCodeBlock 一次),Once 模式只能命中一次
    mockUseTheme.mockReturnValue({ resolvedTheme: 'light' } as ReturnType<typeof mockUseTheme>)
  })

  it('resolvedTheme=light 时,SyntaxHighlighter 收到的 style 是 oneLight 对象', async () => {
    const content = '```js\nconst x = 1\n```'
    const { container } = render(<MarkdownStream content={content} />)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="syntax-highlighter"]')).toBeTruthy()
    })

    const sh = container.querySelector('[data-testid="syntax-highlighter"]') as HTMLElement
    const styleKey = sh.getAttribute('data-style-key') ?? ''
    expect(styleKey).toContain('oneLight')
    expect(styleKey).not.toContain('oneDark')
  })

  it('resolvedTheme=dark 时,SyntaxHighlighter 收到的 style 是 oneDark 对象', async () => {
    // 覆盖为 dark(mockReturnValue 覆盖整个 render 期间所有 useTheme 调用)
    mockUseTheme.mockReturnValue({ resolvedTheme: 'dark' } as ReturnType<typeof mockUseTheme>)

    const content = '```js\nconst x = 1\n```'
    const { container } = render(<MarkdownStream content={content} />)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="syntax-highlighter"]')).toBeTruthy()
    })

    const sh = container.querySelector('[data-testid="syntax-highlighter"]') as HTMLElement
    const styleKey = sh.getAttribute('data-style-key') ?? ''
    expect(styleKey).toContain('oneDark')
    expect(styleKey).not.toContain('oneLight')
  })

  it('主题从 light 切到 dark 时,样式对象引用切换(触发 SyntaxHighlighter 重渲染)', async () => {
    // 第一次:light
    mockUseTheme.mockReturnValue({ resolvedTheme: 'light' } as ReturnType<typeof mockUseTheme>)
    const content = '```js\nconst x = 1\n```'
    const { container, rerender } = render(<MarkdownStream content={content} />)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="syntax-highlighter"]')).toBeTruthy()
    })

    const sh1 = container.querySelector('[data-testid="syntax-highlighter"]') as HTMLElement
    expect(sh1.getAttribute('data-style-key')).toContain('oneLight')

    // 第二次:dark(re-render 期间所有 useTheme 调用都返回 dark)
    mockUseTheme.mockReturnValue({ resolvedTheme: 'dark' } as ReturnType<typeof mockUseTheme>)
    rerender(<MarkdownStream content={content} />)

    await waitFor(() => {
      const sh2 = container.querySelector('[data-testid="syntax-highlighter"]') as HTMLElement
      expect(sh2.getAttribute('data-style-key')).toContain('oneDark')
    })
  })

  it('<pre> 容器背景在 light 模式下使用浅色,在 dark 模式下使用深色', async () => {
    const content = '```js\nconst x = 1\n```'
    const { container } = render(<MarkdownStream content={content} />)

    await waitFor(() => {
      expect(container.querySelector('pre')).toBeTruthy()
    })

    const pre = container.querySelector('pre') as HTMLElement
    // 容器使用 theme-aware 类:bg-zinc-100(light) + dark:bg-zinc-950
    expect(pre.className).toContain('bg-zinc-100')
    expect(pre.className).toContain('dark:bg-zinc-950')
  })
})
