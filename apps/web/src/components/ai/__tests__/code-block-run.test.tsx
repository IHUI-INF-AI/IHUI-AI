// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​

// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, fireEvent, waitFor, act } from '@testing-library/react'

// 执行 API 与依赖模块 mock(复用的沙箱执行链路 executeSandbox)
const { mockApi } = vi.hoisted(() => ({
  mockApi: { executeSandbox: vi.fn() },
}))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ihui/api-client')>()
  return { ...actual, executeSandbox: mockApi.executeSandbox }
})

// workspacePath 取值路径 mock(与 applyCodeBlockToFile 同款 store 顺序)
const { wsState } = vi.hoisted(() => ({
  wsState: { workspacePath: '/tmp/ws', activeWorkspace: null as { path: string } | null },
}))
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

// 以下 mock 与 markdown-stream.test.tsx 保持一致(集成用例需渲染 MarkdownStream)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({
    language,
    children,
  }: {
    language?: string
    children?: string
  }) =>
    React.createElement(
      'pre',
      { 'data-testid': 'syntax-highlighter', className: `language-${language ?? ''}` },
      children,
    ),
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

import { isRunnableLanguage, buildExecPlan, useCodeBlockRun } from '../code-block-run'
import { MarkdownStream } from '../markdown-stream'

const mockExecuteSandbox = mockApi.executeSandbox as unknown as ReturnType<typeof vi.fn>

describe('code-block-run — 语言判定集合', () => {
  it('可运行语言(js/ts/python/bash)返回 true,其他语言返回 false', () => {
    expect(isRunnableLanguage('js')).toBe(true)
    expect(isRunnableLanguage('javascript')).toBe(true)
    expect(isRunnableLanguage('ts')).toBe(true)
    expect(isRunnableLanguage('typescript')).toBe(true)
    expect(isRunnableLanguage('tsx')).toBe(true)
    expect(isRunnableLanguage('python')).toBe(true)
    expect(isRunnableLanguage('py')).toBe(true)
    expect(isRunnableLanguage('bash')).toBe(true)
    expect(isRunnableLanguage('sh')).toBe(true)

    expect(isRunnableLanguage('html')).toBe(false)
    expect(isRunnableLanguage('css')).toBe(false)
    expect(isRunnableLanguage('go')).toBe(false)
    expect(isRunnableLanguage('ruby')).toBe(false)
    expect(isRunnableLanguage(undefined)).toBe(false)
  })
})

describe('code-block-run — 执行命令构造(buildExecPlan)', () => {
  it('JS → node,TS → npx tsx,Python → python3,Shell → bash,且命令指向 .ihui-run 临时文件', () => {
    const js = buildExecPlan('js', 'console.log(1)')
    expect(js.command).toMatch(/^node \.ihui-run\/ihui-snippet-[\w]+\.mjs$/)

    const ts = buildExecPlan('ts', 'const x=1')
    expect(ts.command).toMatch(/^npx tsx \.ihui-run\/ihui-snippet-[\w]+\.ts$/)

    const py = buildExecPlan('python', 'print(1)')
    expect(py.command).toMatch(/^python3 \.ihui-run\/ihui-snippet-[\w]+\.py$/)

    const sh = buildExecPlan('bash', 'echo hi')
    expect(sh.command).toMatch(/^bash \.ihui-run\/ihui-snippet-[\w]+\.sh$/)
  })

  it('相同代码生成稳定文件名(确定性哈希)', () => {
    const a = buildExecPlan('js', 'const x = 1')
    const b = buildExecPlan('js', 'const x = 1')
    expect(a.relPath).toBe(b.relPath)
  })
})

describe('useCodeBlockRun — 执行 API 调用与结果归一化', () => {
  beforeEach(() => {
    mockExecuteSandbox.mockReset()
    wsState.workspacePath = '/tmp/ws'
    wsState.activeWorkspace = null
  })

  it('成功:stdout/stderr 合并,status=success,exitCode=0', async () => {
    mockExecuteSandbox.mockResolvedValue({
      success: true,
      data: { stdout: 'hello\n', stderr: '', exitCode: 0, mode: 'workspace-write' },
    })
    const { result } = renderHook(() => useCodeBlockRun())
    await act(async () => {
      await result.current.run({ language: 'js', code: 'console.log("hello")' })
    })
    expect(result.current.result?.status).toBe('success')
    expect(result.current.result?.output).toBe('hello\n')
    expect(result.current.result?.exitCode).toBe(0)
    expect(mockExecuteSandbox).toHaveBeenCalledTimes(1)
  })

  it('失败:exitCode=1 且含 stderr → status=error,exitCode=1', async () => {
    mockExecuteSandbox.mockResolvedValue({
      success: true,
      data: { stdout: '', stderr: 'boom', exitCode: 1, mode: 'workspace-write' },
    })
    const { result } = renderHook(() => useCodeBlockRun())
    await act(async () => {
      await result.current.run({ language: 'ts', code: 'throw' })
    })
    expect(result.current.result?.status).toBe('error')
    expect(result.current.result?.exitCode).toBe(1)
    expect(result.current.result?.output).toBe('boom')
  })

  it('未绑定工作区 → status=error 且提示工作区', async () => {
    wsState.workspacePath = ''
    const { result } = renderHook(() => useCodeBlockRun())
    await act(async () => {
      await result.current.run({ language: 'python', code: 'print(1)' })
    })
    expect(result.current.result?.status).toBe('error')
    expect(result.current.result?.output).toContain('工作区')
    // 未绑定工作区时不应发起执行请求
    expect(mockExecuteSandbox).toHaveBeenCalledTimes(0)
    wsState.workspacePath = '/tmp/ws'
  })
})

describe('MarkdownStream 集成 — 运行按钮与内联输出面板', () => {
  beforeEach(() => {
    mockExecuteSandbox.mockReset()
    wsState.workspacePath = '/tmp/ws'
    wsState.activeWorkspace = null
  })

  it('TS 代码块展示运行按钮,点击后内联渲染 stdout 与 exit 0 成功徽章', async () => {
    mockExecuteSandbox.mockResolvedValue({
      success: true,
      data: { stdout: 'hi\n', stderr: '', exitCode: 0, mode: 'workspace-write' },
    })
    const { container } = render(<MarkdownStream content={'```ts\nconsole.log("hi")\n```'} />)

    const runBtn = container.querySelector('button[data-testid="run-code-button"]')
    expect(runBtn).toBeTruthy()

    fireEvent.click(runBtn as HTMLButtonElement)

    await waitFor(() => {
      const out = container.querySelector('[data-testid="code-run-output"]')
      expect(out).toBeTruthy()
      expect(out?.textContent).toContain('hi')
    })
    // 成功徽章 aria-label = "codeRun.exit 0"(next-intl mock 返回 key)
    expect(container.querySelector('[aria-label="codeRun.exit 0"]')).toBeTruthy()
  })

  it('执行失败 → 输出面板展示 stderr 与 exit 1 失败徽章', async () => {
    mockExecuteSandbox.mockResolvedValue({
      success: true,
      data: { stdout: '', stderr: 'err-msg', exitCode: 1, mode: 'workspace-write' },
    })
    const { container } = render(<MarkdownStream content={'```python\nraise\n```'} />)

    fireEvent.click(container.querySelector('button[data-testid="run-code-button"]') as HTMLButtonElement)

    await waitFor(() => {
      const out = container.querySelector('[data-testid="code-run-output"]')
      expect(out?.textContent).toContain('err-msg')
    })
    expect(container.querySelector('[aria-label="codeRun.exit 1"]')).toBeTruthy()
  })

  it('不可运行语言(html)不展示运行按钮', () => {
    const { container } = render(<MarkdownStream content={'```html\n<div></div>\n```'} />)
    expect(container.querySelector('button[data-testid="run-code-button"]')).toBeNull()
  })
})
// ​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​
