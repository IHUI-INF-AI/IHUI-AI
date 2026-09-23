// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import type { DiffFile } from '@ihui/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}|${Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('|')}`
  },
  useLocale: () => 'zh-CN',
}))

interface MockIDEState {
  diffFiles: DiffFile[]
  activeDiffFileId: string | null
  diffViewMode: 'split' | 'unified'
  workspacePath: string
  setActiveDiffFile: (id: string) => void
  setDiffViewMode: (mode: 'split' | 'unified') => void
  setActiveTopTab: (tab: string) => void
  openFile: (file: unknown) => void
  fetchDiffFiles: () => Promise<void>
}

const mockStore = vi.hoisted(() => ({
  state: null as unknown as MockIDEState,
  fns: {
    setActiveDiffFile: vi.fn(),
    setDiffViewMode: vi.fn(),
    setActiveTopTab: vi.fn(),
    openFile: vi.fn(),
    fetchDiffFiles: vi.fn(),
  },
}))

vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: (sel?: (s: MockIDEState) => unknown) =>
    typeof sel === 'function' ? sel(mockStore.state) : mockStore.state,
}))

const apiMock = vi.hoisted(() => ({
  runCommand: vi.fn(),
  readFile: vi.fn(),
}))
vi.mock('@ihui/api-client', () => ({
  runCommand: apiMock.runCommand,
  readFile: apiMock.readFile,
}))

const clipboardMock = vi.hoisted(() => ({ copy: vi.fn(async () => true as boolean) }))
vi.mock('@/hooks/use-clipboard', () => ({
  useClipboard: () => ({ copy: clipboardMock.copy, copied: false }),
}))

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: toastMock.success,
    error: toastMock.error,
    warning: vi.fn(),
    info: vi.fn(),
    toast: {},
  }),
}))

vi.mock('@/components/ai/diff-preview', () => ({
  DiffPreview: () => <div data-testid="stub-diff-preview" />,
}))
vi.mock('@/components/ai/inline-diff-viewer', () => ({
  InlineDiffViewer: () => <div data-testid="stub-inline-diff" />,
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { DiffViewerPane, MAX_LOAD_RETRIES } from '../diff-viewer-pane'

/**
 * D98:审阅态真链路(刷新后仍存)+ 跳转空态 + 失败可读 + 导出命令 + PR 接缝。
 */
function makeFile(partial: Partial<DiffFile> & { id: string; filename: string }): DiffFile {
  return {
    status: 'modified',
    oldContent: '',
    newContent: '',
    additions: 1,
    deletions: 1,
    ...partial,
  }
}

function setup(files: DiffFile[], activeId: string | null = files[0]?.id ?? null) {
  mockStore.state = {
    diffFiles: files,
    activeDiffFileId: activeId,
    diffViewMode: 'split',
    workspacePath: '/ws',
    setActiveDiffFile: mockStore.fns.setActiveDiffFile,
    setDiffViewMode: mockStore.fns.setDiffViewMode,
    setActiveTopTab: mockStore.fns.setActiveTopTab,
    openFile: mockStore.fns.openFile,
    fetchDiffFiles: mockStore.fns.fetchDiffFiles,
  }
}

describe('D98 DiffViewerPane review + jump + PR', () => {
  beforeEach(() => {
    setup([
      makeFile({ id: 'd1', filename: 'src/a.ts' }),
      makeFile({ id: 'd2', filename: 'src/b.ts' }),
    ])
    localStorage.clear()
    vi.clearAllMocks()
    apiMock.runCommand.mockResolvedValue({ success: true, data: { stdout: 'old\n' } })
    apiMock.readFile.mockResolvedValue({ success: true, data: { content: 'new\n' } })
  })
  afterEach(() => cleanup())

  it('审阅态刷新后仍存:切换 → 落盘 → unmount/remount 仍为已审(真链路)', () => {
    const { unmount } = render(<DiffViewerPane />)
    fireEvent.click(screen.getByTestId('diff-reviewed-toggle-d1'))
    expect(localStorage.getItem('ide:reviewedDiffFiles:/ws')).toContain('d1')
    unmount()
    render(<DiffViewerPane />)
    expect(screen.getByTestId('diff-reviewed-toggle-d1').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('diff-pane-review-count').textContent).toContain('viewed=1')
  })

  it('跳转无匹配给空态文案;回车跳首个匹配', () => {
    render(<DiffViewerPane />)
    const input = screen.getByTestId('diff-jump-input')
    fireEvent.change(input, { target: { value: 'zzz-nope' } })
    expect(screen.getByTestId('diff-jump-empty').textContent).toContain(
      'diffReview.jumpToFileEmpty',
    )
    fireEvent.change(input, { target: { value: 'b.ts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockStore.fns.setActiveDiffFile).toHaveBeenCalledWith('d2')
  })

  it('PR 入口:缺省不渲染,传 D15 同源 URL 才渲染', () => {
    const { unmount } = render(<DiffViewerPane />)
    expect(screen.queryByTestId('diff-pr-link')).toBeNull()
    unmount()
    render(<DiffViewerPane pullRequestUrl="https://github.com/o/r/pull/7" pullRequestNumber={7} />)
    const link = screen.getByTestId('diff-pr-link') as HTMLAnchorElement
    expect(link.href).toContain('/pull/7')
    expect(link.textContent).toContain('diffReview.viewPullRequest')
  })

  it('导出命令:复制可执行串 + 成功 toast(含独立成功态键)', async () => {
    setup([makeFile({ id: 'd1', filename: 'src/a.ts', oldContent: 'x\n', newContent: 'y\n' })])
    render(<DiffViewerPane />)
    fireEvent.click(screen.getByTestId('diff-copy-git-apply'))
    await waitFor(() => expect(clipboardMock.copy).toHaveBeenCalledTimes(1))
    const firstCall = clipboardMock.copy.mock.calls[0]
    expect(firstCall).toBeDefined()
    const cmd = (firstCall as unknown as [string])[0]
    expect(cmd).toContain('git apply')
    expect(cmd).toContain('src/a.ts')
    expect(toastMock.success).toHaveBeenCalledWith('diffReview.copyGitApplyToast')
  })
})

describe('D98 DiffViewerPane load failure', () => {
  beforeEach(() => {
    setup([makeFile({ id: 'd1', filename: 'src/a.ts' })])
    localStorage.clear()
    vi.clearAllMocks()
    apiMock.runCommand.mockResolvedValue({ success: false, error: 'boom' })
    apiMock.readFile.mockResolvedValue({ success: false, error: 'boom' })
  })
  afterEach(() => cleanup())

  it('双侧拉取失败 → 可读错误 + 重试;超限切终态(重试后仍失败)', async () => {
    expect(MAX_LOAD_RETRIES).toBe(2)
    render(<DiffViewerPane />)
    const banner = await screen.findByTestId('diff-content-error')
    expect(banner.textContent).toContain('diffReview.fullContentLoadFailed')
    const retry = screen.getByTestId('diff-content-retry')
    fireEvent.click(retry)
    await waitFor(() =>
      expect(screen.getByTestId('diff-content-error').textContent).toContain(
        'diffReview.fullContentLoadFailed',
      ),
    )
    fireEvent.click(screen.getByTestId('diff-content-retry'))
    await waitFor(() =>
      expect(screen.getByTestId('diff-content-error').textContent).toContain(
        'diffReview.loadFailedAfterRetrying',
      ),
    )
    // 重试确实触发了重拉(初次 1 + 重试 2 = 至少 3 次调用)
    expect(apiMock.runCommand.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
