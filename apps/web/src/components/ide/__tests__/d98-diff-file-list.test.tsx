// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import type { DiffFile } from '@ihui/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}|${Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('|')}`
  },
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

interface MockIDEState {
  diffFiles: DiffFile[]
  activeDiffFileId: string | null
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

import { DiffFileList } from '../diff-file-list'
import { useDiffViewModeStore } from '@/lib/diff-view-mode'

/**
 * D98①②:文件列表 —— 审阅计数/切换/批量 + 筛选 + 右键菜单 + 渲染失败。
 */
function makeFile(id: string, filename: string, status: DiffFile['status'] = 'modified'): DiffFile {
  return { id, filename, status, oldContent: '', newContent: '', additions: 2, deletions: 1 }
}

const FILES = [makeFile('f-a', 'src/a.ts'), makeFile('f-b', 'src/b.ts', 'added')]

function setup(files: DiffFile[] = FILES) {
  mockStore.state = {
    diffFiles: files,
    activeDiffFileId: null,
    setActiveDiffFile: mockStore.fns.setActiveDiffFile,
    setDiffViewMode: mockStore.fns.setDiffViewMode,
    setActiveTopTab: mockStore.fns.setActiveTopTab,
    openFile: mockStore.fns.openFile,
    fetchDiffFiles: mockStore.fns.fetchDiffFiles,
  }
}

describe('D98 DiffFileList review', () => {
  beforeEach(() => {
    setup()
    localStorage.clear()
    useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('审阅汇总:计数聚合 N/M + 全部标记批量', () => {
    const onToggle = vi.fn()
    const onMarkAll = vi.fn()
    const onClear = vi.fn()
    render(
      <DiffFileList
        reviewedIds={new Set(['f-a'])}
        onToggleReviewed={onToggle}
        onMarkAllReviewed={onMarkAll}
        onClearReviewed={onClear}
      />,
    )
    const count = screen.getByTestId('diff-review-count')
    expect(count.textContent).toContain('viewed=1')
    expect(count.textContent).toContain('total=2')
    fireEvent.click(screen.getByTestId('diff-review-mark-all'))
    expect(onMarkAll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('diff-review-clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('全部已审时"全部标记"禁用', () => {
    render(
      <DiffFileList
        reviewedIds={new Set(['f-a', 'f-b'])}
        onToggleReviewed={vi.fn()}
        onMarkAllReviewed={vi.fn()}
      />,
    )
    expect((screen.getByTestId('diff-review-mark-all') as HTMLButtonElement).disabled).toBe(true)
  })

  it('行级 Eye 切换回调文件 id + 已审态 aria-pressed', () => {
    const onToggle = vi.fn()
    render(<DiffFileList reviewedIds={new Set(['f-a'])} onToggleReviewed={onToggle} />)
    const tA = screen.getByTestId('diff-reviewed-toggle-f-a')
    const tB = screen.getByTestId('diff-reviewed-toggle-f-b')
    expect(tA.getAttribute('aria-pressed')).toBe('true')
    expect(tB.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(tB)
    expect(onToggle).toHaveBeenCalledWith('f-b')
  })

  it('未传审阅 props 时不渲染审阅 UI(既有调用方零改动)', () => {
    render(<DiffFileList />)
    expect(screen.queryByTestId('diff-review-summary')).toBeNull()
    expect(screen.queryByTestId('diff-reviewed-toggle-f-a')).toBeNull()
  })
})

describe('D98 DiffFileList filter + menu + renderError', () => {
  beforeEach(() => {
    setup([...FILES, makeFile('f-g', 'dist/bundle.js')])
    localStorage.clear()
    useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('隐藏生成文件', () => {
    render(<DiffFileList hideGenerated />)
    expect(screen.queryByText('bundle.js')).toBeNull()
    expect(screen.getByText('a.ts')).not.toBeNull()
  })

  it('搜索无匹配 → jumpToFile 空态文案(不得空白)', () => {
    render(<DiffFileList searchQuery="zzz-no-such-file" />)
    const empty = screen.getByTestId('diff-jump-empty')
    expect(empty.textContent).toContain('diffReview.jumpToFileEmpty')
  })

  it('无搜索无结果 → 既有 noMatch 空态', () => {
    setup([])
    render(<DiffFileList />)
    expect(screen.getByTestId('diff-file-list-empty').textContent).toContain('diffFileList.noMatch')
  })

  it('右键菜单:复制路径走剪贴板 + 成功 toast', async () => {
    render(<DiffFileList />)
    const row = screen.getByText('a.ts').closest('[role="button"]') as HTMLElement
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 })
    const copyBtn = screen.getByTestId('diff-row-copy-path-f-a')
    expect(copyBtn.textContent).toContain('diffReview.copyPath')
    fireEvent.click(copyBtn)
    await vi.waitFor(() => expect(clipboardMock.copy).toHaveBeenCalledWith('src/a.ts'))
    expect(toastMock.success).toHaveBeenCalled()
  })

  it('右键菜单「打开方式」写唯一真相源并选中文件(V3 #66:不再只改 IDE 那份)', () => {
    render(<DiffFileList />)
    const row = screen.getByText('b.ts').closest('[role="button"]') as HTMLElement
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByTestId('diff-row-open-unified-f-b'))
    expect(mockStore.fns.setActiveDiffFile).toHaveBeenCalledWith('f-b')
    expect(useDiffViewModeStore.getState().mode).toBe('unified')
    // 再点 split:同一个真相源被改写,而不是攒出第二份状态
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByTestId('diff-row-open-split-f-b'))
    expect(useDiffViewModeStore.getState().mode).toBe('split')
  })

  it('渲染失败行:可读错误 + 重试回调', () => {
    const onRetry = vi.fn()
    setup([makeFile('f-bad', '')])
    render(<DiffFileList onRetryRender={onRetry} />)
    expect(screen.getByTestId('diff-render-error-f-bad').textContent).toContain(
      'diffReview.renderError',
    )
    fireEvent.click(screen.getByTestId('diff-render-retry-f-bad'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
