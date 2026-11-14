// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 2026-11-14(对标 DSH deliverable-file-references):
// · 相对工作区路径的 Markdown 链接必须可点并落到 IDE(此前相对路径被 isSafeUrl 判成
//   非安全 URL,直接渲染成不可点 span —— 刚注入的产出规约因此无法生效);
// · 行内 code 只在本轮产出/交付路径里解析,未知/歧义保持普通 code;
// · 解析上下文走 ref,不进 components 身份(流式 toolCalls 增长不得让稳定前缀重 parse)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-syntax-highlighter', () => ({
  Prism: () => React.createElement('pre', { 'data-testid': 'syntax-highlighter' }),
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { __styleKey: 'oneDark' },
  oneLight: { __styleKey: 'oneLight' },
}))

vi.mock('@/components/media/MermaidDiagram', () => ({
  default: () => React.createElement('div', { 'data-testid': 'mermaid' }),
}))

import { MarkdownStream } from '../markdown-stream'
import { useIDEWorkspace } from '@/stores/ide-workspace'

function setWorkspace(overrides: Record<string, unknown> = {}) {
  const openFile = vi.fn()
  const setActiveTopTab = vi.fn()
  useIDEWorkspace.setState({
    workspacePath: '/ws',
    openFile,
    setActiveTopTab,
    revealAt: null,
    ...overrides,
  })
  return { openFile, setActiveTopTab }
}

afterEach(() => {
  cleanup()
  useIDEWorkspace.setState({ workspacePath: '', revealAt: null })
})

describe('Markdown 工作区文件链接', () => {
  it('相对路径按 workspace 解析并可点,点击落到 IDE', () => {
    const { openFile, setActiveTopTab } = setWorkspace()
    const view = render(<MarkdownStream content={'见 [报告](out/report.pdf) 一文'} />)
    const link = view.getByTestId('markdown-workspace-file-link')
    expect(link.getAttribute('title')).toBe('/ws/out/report.pdf')
    fireEvent.click(link)
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(openFile.mock.calls[0]?.[0]).toMatchObject({ path: '/ws/out/report.pdf' })
    expect(setActiveTopTab).toHaveBeenCalledWith('editor')
  })

  it('相对路径 + 行号:走 revealAt 落点', () => {
    const revealAt = vi.fn()
    setWorkspace({ revealAt })
    const view = render(<MarkdownStream content={'见 [入口](src/a.ts:30)'} />)
    const link = view.getByTestId('markdown-workspace-file-link')
    expect(link.getAttribute('title')).toBe('/ws/src/a.ts')
    fireEvent.click(link)
    expect(revealAt).toHaveBeenCalledWith('/ws/src/a.ts', 30, 1)
  })

  it('无扩展名的站内路径不被接管(仍按普通链接语义)', () => {
    setWorkspace()
    const view = render(<MarkdownStream content={'[控制台](/dashboard)'} />)
    expect(view.queryByTestId('markdown-workspace-file-link')).toBeNull()
    expect(view.container.querySelector('a')?.getAttribute('href')).toBe('/dashboard')
  })
})

describe('行内 code 文件引用', () => {
  it('命中本轮路径 ⇒ 可点并回调 open', () => {
    setWorkspace()
    const open = vi.fn()
    const view = render(
      <MarkdownStream
        content={'改动在 `src/a.ts`'}
        fileMention={{
          resolve: (value) => (value === 'src/a.ts' ? { path: 'src/a.ts', label: 'a.ts' } : undefined),
          open,
        }}
      />,
    )
    const mention = view.getByTestId('inline-file-mention')
    expect(mention.getAttribute('title')).toBe('src/a.ts')
    fireEvent.click(mention)
    expect(open).toHaveBeenCalledWith('src/a.ts')
  })

  it('未命中/歧义 ⇒ 保持普通 code,不产生死按钮', () => {
    setWorkspace()
    const view = render(
      <MarkdownStream
        content={'另有 `unknown.ts` 与 `src/a.ts`'}
        fileMention={{ resolve: () => undefined, open: vi.fn() }}
      />,
    )
    expect(view.queryByTestId('inline-file-mention')).toBeNull()
    expect(view.container.querySelectorAll('code')).toHaveLength(2)
  })
})
