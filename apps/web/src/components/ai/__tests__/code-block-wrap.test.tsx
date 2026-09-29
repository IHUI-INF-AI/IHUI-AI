// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D197 代码块「自动换行」开关:工具条按钮接线 + 偏好持久化(ihui-code-block-prefs)
// + 换行渲染(外层 pre 类切换 / SyntaxHighlighter wrapLongLines 传导)。
// mock 头与 code-block-run.test.tsx / markdown-stream.test.tsx 保持一致。

import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

// 执行 API 与依赖模块 mock(与 code-block-run.test.tsx 同款)
const { wsState, hlprProps } = vi.hoisted(() => ({
  wsState: { workspacePath: '/tmp/ws', activeWorkspace: null as { path: string } | null },
  hlprProps: {} as Record<string, unknown>,
}))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, executeSandbox: vi.fn() }
})
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: { getState: () => ({ activeWorkspace: wsState.activeWorkspace }) },
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: { getState: () => ({ workspacePath: wsState.workspacePath }) },
}))
vi.mock('@/lib/workspace-file-save', () => ({
  resolveWorkspaceDirectoryHandle: () => null,
  toRelativeWorkspacePath: (f: string) => f,
}))
vi.mock('@/lib/workspace-tool-executor', () => ({
  executeWorkspaceTool: vi.fn().mockResolvedValue({ result: '', error: null }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('react-syntax-highlighter', () => ({
  Prism: (props: Record<string, unknown>) => {
    Object.assign(hlprProps, props)
    return React.createElement(
      'pre',
      { 'data-testid': 'syntax-highlighter' },
      props.children as string,
    )
  },
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
import { useCodeBlockPrefsStore } from '@/stores/code-block-prefs'

const JS_BLOCK = ['```js', 'const a = 1', '```'].join('\n')

function outerPre(container: HTMLElement): HTMLElement {
  return container.querySelector('pre:not([data-testid])') as HTMLElement
}

describe('D197 — 代码块自动换行开关', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCodeBlockPrefsStore.setState({ wrap: false })
  })

  it('默认关闭:按钮 aria-pressed=false 且文案为 wrapOn,pre 走横滚不高亮器不换行', async () => {
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    const btn = container.querySelector('[data-testid="wrap-toggle-button"]') as HTMLElement
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    expect(btn.getAttribute('aria-label')).toBe('codeBlock.wrapOn')
    const pre = outerPre(container)
    expect(pre.className).toContain('overflow-x-auto')
    expect(pre.className).not.toContain('whitespace-pre-wrap')
    // SyntaxHighlighter 经 next/dynamic 懒加载,等它挂载后再断言传导值
    await waitFor(() => {
      expect(container.querySelector('[data-testid="syntax-highlighter"]')).not.toBeNull()
    })
    expect(hlprProps.wrapLongLines).toBe(false)
  })

  it('点击开启:aria-pressed=true 文案切 wrapOff,pre 切 pre-wrap,wrapLongLines 传导高亮器', async () => {
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    const btn = container.querySelector('[data-testid="wrap-toggle-button"]') as HTMLElement
    fireEvent.click(btn)
    await waitFor(() => {
      expect(btn.getAttribute('aria-pressed')).toBe('true')
    })
    expect(btn.getAttribute('aria-label')).toBe('codeBlock.wrapOff')
    const pre = outerPre(container)
    expect(pre.className).toContain('whitespace-pre-wrap')
    expect(pre.className).toContain('break-words')
    expect(pre.className).not.toContain('overflow-x-auto')
    expect(hlprProps.wrapLongLines).toBe(true)
  })

  it('偏好持久化:开关后写入 ihui-code-block-prefs,store 重读仍为开启态', async () => {
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    fireEvent.click(container.querySelector('[data-testid="wrap-toggle-button"]') as HTMLElement)
    await waitFor(() => {
      expect(useCodeBlockPrefsStore.getState().wrap).toBe(true)
    })
    const raw = window.localStorage.getItem('ihui-code-block-prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string)).toMatchObject({ state: { wrap: true } })

    // store 单例重读(等价新会话内重开页面时的内存态来源)
    expect(useCodeBlockPrefsStore.getState().wrap).toBe(true)
  })

  it('store 直操:setWrap/toggleWrap 语义正确', () => {
    const { toggleWrap, setWrap } = useCodeBlockPrefsStore.getState()
    toggleWrap()
    expect(useCodeBlockPrefsStore.getState().wrap).toBe(true)
    setWrap(false)
    expect(useCodeBlockPrefsStore.getState().wrap).toBe(false)
  })

  it('换行状态下代码内容仍完整渲染(不被折行吞行)', () => {
    const { container } = render(<MarkdownStream content={JS_BLOCK} />)
    fireEvent.click(container.querySelector('[data-testid="wrap-toggle-button"]') as HTMLElement)
    expect(container.querySelector('[data-testid="syntax-highlighter"]')?.textContent).toBe(
      'const a = 1',
    )
  })
})
