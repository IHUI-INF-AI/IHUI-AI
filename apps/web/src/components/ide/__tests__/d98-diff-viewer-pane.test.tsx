// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

/** 供测试手动广播"外部 surface 改了档位"(vi.hoisted 保证它在 mock 工厂之前求值) */
const ideHooks = vi.hoisted(() => ({
  listeners: new Set<(s: unknown, p: unknown) => void>(),
}))

vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: Object.assign(
    (sel?: (s: MockIDEState) => unknown) =>
      typeof sel === 'function' ? sel(mockStore.state) : mockStore.state,
    {
      // V3 #66:面板把这份遗留档位接成唯一真相源的镜像,桥要用 getState/subscribe
      getState: () => mockStore.state,
      subscribe: (listener: (s: unknown, p: unknown) => void) => {
        ideHooks.listeners.add(listener)
        return () => ideHooks.listeners.delete(listener)
      },
    },
  ),
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
// stub 把关键 props 透成 data-*,好让"面板到底喂了真内容还是假 diff 文本"可被断言
vi.mock('@/components/ai/inline-diff-viewer', () => ({
  InlineDiffViewer: (props: Record<string, unknown>) => (
    <div
      data-testid="stub-inline-diff"
      data-old={typeof props.oldContent === 'string' ? props.oldContent : ''}
      data-new={typeof props.newContent === 'string' ? props.newContent : ''}
      data-content={typeof props.content === 'string' ? props.content : ''}
    />
  ),
  ThreeWayMergeView: (props: Record<string, unknown>) => (
    <div
      data-testid="stub-3way"
      data-base={typeof props.base === 'string' ? props.base : ''}
      data-ours={typeof props.ours === 'string' ? props.ours : ''}
      data-theirs={typeof props.theirs === 'string' ? props.theirs : ''}
    />
  ),
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { DiffViewerPane, MAX_LOAD_RETRIES } from '../diff-viewer-pane'
import { useDiffViewModeStore } from '@/lib/diff-view-mode'

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

describe('V3 #66 判据 1/3:档位单一真相源 + 三方数据源接线', () => {
  beforeEach(() => {
    setup([makeFile({ id: 'd1', filename: 'src/a.ts', oldContent: 'x\n', newContent: 'y\n' })])
    localStorage.clear()
    vi.clearAllMocks()
    useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
    mockStore.state.diffViewMode = 'split'
    ideHooks.listeners.clear()
    apiMock.runCommand.mockResolvedValue({ success: true, data: { stdout: 'old\n' } })
    apiMock.readFile.mockResolvedValue({ success: true, data: { content: 'new\n' } })
  })
  afterEach(() => cleanup())

  it('挂载即把唯一真相源推给 IDE store(持久化值盖掉 store 的硬编码默认值)', () => {
    useDiffViewModeStore.setState({ mode: 'unified' })
    mockStore.state.diffViewMode = 'split'
    render(<DiffViewerPane />)
    expect(mockStore.fns.setDiffViewMode).toHaveBeenCalledWith('unified')
  })

  it('外部 surface(切换按钮)改档位 ⇒ 面板换渲染,而不是各画各的', async () => {
    render(<DiffViewerPane />)
    await waitFor(() => expect(screen.getByTestId('stub-diff-preview')).toBeTruthy())
    // 模拟 diff-stats-bar 直接写 IDE store(本票不可改那个文件,故走镜像)。
    // 必须按 zustand 语义喂「新值 + 变更前快照」两个不同对象 —— 面板里那层包装是
    // 「state.diffViewMode !== prev.diffViewMode 才广播」,喂同一个对象等于没广播。
    const before = { ...mockStore.state }
    mockStore.state.diffViewMode = 'unified'
    for (const listener of [...ideHooks.listeners]) listener(mockStore.state, before)
    await waitFor(() => expect(screen.getByTestId('stub-inline-diff')).toBeTruthy())
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
    expect(useDiffViewModeStore.getState().mode).toBe('unified')
  })

  it('三方开关打开 ⇒ 先取索引 stage 1/2/3(真冲突态优先),不伪造第三侧', async () => {
    render(<DiffViewerPane />)
    fireEvent.click(screen.getByTestId('diff-3way-toggle'))
    await waitFor(() => {
      const cmds = apiMock.runCommand.mock.calls.map((c) => String((c[0] as { command: string }).command))
      return expect(cmds.some((c) => c.includes('git show :1:"src/a.ts"'))).toBe(true)
    })
    const cmds = apiMock.runCommand.mock.calls.map((c) => String((c[0] as { command: string }).command))
    expect(cmds.some((c) => c.includes('git show :2:"src/a.ts"'))).toBe(true)
    expect(cmds.some((c) => c.includes('git show :3:"src/a.ts"'))).toBe(true)
    await waitFor(() => expect(screen.getByTestId('stub-3way')).toBeTruthy())
    // 三方视图与两栏档位正交:开着三方时不再渲染 split 预览
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
  })

  it('切换三方开关不落档位档(点开关不会把 split 变成 unified)', async () => {
    render(<DiffViewerPane />)
    fireEvent.click(screen.getByTestId('diff-3way-toggle'))
    await waitFor(() => expect(screen.getByTestId('stub-3way')).toBeTruthy())
    expect(useDiffViewModeStore.getState().mode).toBe('split')
    expect(useDiffViewModeStore.getState().threeWayOpen).toBe(true)
  })

  it('unified 档传真实双侧内容,不再传"按行下标配对"的假 diff 文本', async () => {
    useDiffViewModeStore.setState({ mode: 'unified' })
    render(<DiffViewerPane />)
    await waitFor(() => expect(screen.getByTestId('stub-inline-diff')).toBeTruthy())
    const el = screen.getByTestId('stub-inline-diff')
    expect(el.getAttribute('data-old')).toBe('old\n')
    expect(el.getAttribute('data-new')).toBe('new\n')
    // 兼容入口 content(假 diff 文本)必须不再被喂值 —— 否则 unified 面还在走那条按下标配对的老路
    expect(el.getAttribute('data-content')).toBe('')
  })

  it('三方档把三份内容原样喂给视图(base≠ours 时不拿 ours 顶 base)', async () => {
    apiMock.runCommand.mockImplementation(async ({ command }: { command: string }) => {
      if (command.includes(':1:')) return { success: true, data: { stdout: 'BASE\n' } }
      if (command.includes(':2:')) return { success: true, data: { stdout: 'OURS\n' } }
      if (command.includes(':3:')) return { success: true, data: { stdout: 'THEIRS\n' } }
      return { success: false, error: 'no such stage' }
    })
    render(<DiffViewerPane />)
    fireEvent.click(screen.getByTestId('diff-3way-toggle'))
    await waitFor(() => expect(screen.getByTestId('stub-3way')).toBeTruthy())
    const el = screen.getByTestId('stub-3way')
    expect(el.getAttribute('data-base')).toBe('BASE\n')
    expect(el.getAttribute('data-ours')).toBe('OURS\n')
    expect(el.getAttribute('data-theirs')).toBe('THEIRS\n')
  })

  it('非冲突态退到「祖先=HEAD、当前=工作区、传入=祖先」,不伪造一份传入改动', async () => {
    apiMock.runCommand.mockImplementation(async ({ command }: { command: string }) => {
      if (command.includes('HEAD:')) return { success: true, data: { stdout: 'HEAD\n' } }
      return { success: false, error: 'no such stage' }
    })
    render(<DiffViewerPane />)
    fireEvent.click(screen.getByTestId('diff-3way-toggle'))
    await waitFor(() => expect(screen.getByTestId('stub-3way')).toBeTruthy())
    const el = screen.getByTestId('stub-3way')
    expect(el.getAttribute('data-base')).toBe('HEAD\n')
    expect(el.getAttribute('data-ours')).toBe('new\n') // readFile 的工作区内容
    expect(el.getAttribute('data-theirs')).toBe('HEAD\n') // 传入侧 = 祖先 ⇒ 全部块自动可解
    expect(screen.getByTestId('diff-3way-source').textContent).toContain('diffViewer.threeWayNoConflictSource')
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

/**
 * G-814423:diff 内容"读不到"与"空文件"必须全或无降级,禁止单侧补空串。
 * 上游判据(packages/services gitCliRepo.ts:88-99):任一侧补成空字符串,UI 就把
 * "不可读"读成"文件为空",进而把整文件渲染成新增/删除。
 */
describe('G-814423 一侧读失败 ⇒ 另一侧也不显示为空', () => {
  beforeEach(() => {
    setup([
      makeFile({ id: 'd1', filename: 'src/a.ts' }),
      makeFile({ id: 'd2', filename: 'src/b.ts' }),
    ])
    localStorage.clear()
    vi.clearAllMocks()
    useDiffViewModeStore.setState({ mode: 'split', threeWayOpen: false })
    apiMock.runCommand.mockResolvedValue({ success: true, data: { stdout: 'old\n' } })
    apiMock.readFile.mockResolvedValue({ success: true, data: { content: 'new\n' } })
  })
  afterEach(() => cleanup())

  it('old 侧读失败(HEAD show 失败)、new 侧可读 ⇒ 横幅在场且伪 diff 不渲染', async () => {
    apiMock.runCommand.mockResolvedValue({ success: false, error: 'boom' })
    apiMock.readFile.mockResolvedValue({ success: true, data: { content: 'new\n' } })
    render(<DiffViewerPane />)
    await screen.findByTestId('diff-content-error')
    // 验收判据:一侧读不到 ⇒ 另一侧不许拿 '' 渲染成整文件新增
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
  })

  it('new 侧读失败(工作区读失败)、old 侧可读 ⇒ 同样全或无', async () => {
    apiMock.runCommand.mockResolvedValue({ success: true, data: { stdout: 'old\n' } })
    apiMock.readFile.mockResolvedValue({ success: false, error: 'boom' })
    render(<DiffViewerPane />)
    await screen.findByTestId('diff-content-error')
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
  })

  it('读失败切走再切回 ⇒ 缺省态不丢(横幅仍在,伪 diff 不复活)', async () => {
    apiMock.runCommand.mockImplementation(async ({ command }: { command: string }) => {
      if (command.includes('src/a.ts')) return { success: false, error: 'boom' }
      return { success: true, data: { stdout: 'old-b\n' } }
    })
    apiMock.readFile.mockImplementation(async ({ path }: { path: string }) => {
      if (path.includes('src/a.ts')) return { success: false, error: 'boom' }
      return { success: true, data: { content: 'new-b\n' } }
    })
    render(<DiffViewerPane />)
    await screen.findByTestId('diff-content-error')
    // 切到 d2(可读,diff 正常渲染)。mock store 无订阅 ⇒ 改 state 后借档位 store
    // 的真实订阅触发重渲染(useDiffViewModeStore 是唯一真相源,组件订阅了它)。
    fireEvent.click(screen.getByText('b.ts'))
    mockStore.state.activeDiffFileId = 'd2'
    act(() => {
      useDiffViewModeStore.setState({ mode: 'unified' })
    })
    act(() => {
      useDiffViewModeStore.setState({ mode: 'split' })
    })
    // mock store 无订阅,重渲染靠档位 store 触发;慢机下 1s 会偶发超时 ⇒ 放宽到 3s
    await screen.findByTestId('stub-diff-preview', {}, { timeout: 3000 })
    expect(screen.queryByTestId('diff-content-error')).toBeNull()
    // 切回 d1(不可读):缓存条目仍在且 oldOk=false ⇒ 缺省态不丢
    fireEvent.click(screen.getByText('a.ts'))
    mockStore.state.activeDiffFileId = 'd1'
    act(() => {
      useDiffViewModeStore.setState({ mode: 'unified' })
    })
    act(() => {
      useDiffViewModeStore.setState({ mode: 'split' })
    })
    await screen.findByTestId('diff-content-error', {}, { timeout: 3000 })
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
  })

  it('重试成功 ⇒ 横幅退场,diff 恢复渲染(可读后正常态回归)', async () => {
    let failOld = true
    apiMock.runCommand.mockImplementation(async () => {
      if (failOld) return { success: false, error: 'boom' }
      return { success: true, data: { stdout: 'old\n' } }
    })
    render(<DiffViewerPane />)
    await screen.findByTestId('diff-content-error')
    failOld = false
    fireEvent.click(screen.getByTestId('diff-content-retry'))
    await waitFor(() => expect(screen.getByTestId('stub-diff-preview')).toBeTruthy())
    expect(screen.queryByTestId('diff-content-error')).toBeNull()
  })

  it('导出 git apply:一侧读不到的文件跳过 patch(不出整文件增删头),并显式交代跳过数', async () => {
    // d1:old 侧读失败;但缓存里还没条目 ⇒ 走现场重读,仍失败 ⇒ 跳过
    apiMock.runCommand.mockImplementation(async ({ command }: { command: string }) => {
      if (command.includes('src/a.ts')) return { success: false, error: 'boom' }
      return { success: true, data: { stdout: 'old-b\n' } }
    })
    apiMock.readFile.mockResolvedValue({ success: true, data: { content: 'new\n' } })
    render(<DiffViewerPane />)
    await screen.findByTestId('diff-content-error')
    fireEvent.click(screen.getByTestId('diff-copy-git-apply'))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    // t() mock 把 {count} 折叠进键串(无第二实参),c 是实参数组,断言其首参字符串
    const errKeys = toastMock.error.mock.calls.map((c) => String((c as unknown as [string])[0]))
    expect(errKeys.some((k) => k.startsWith('diffReview.copyGitApplyUnreadable'))).toBe(true)
    // d1 被跳过,d2 正常导出:命令里只有 src/b.ts,没有 src/a.ts
    const copyCall = clipboardMock.copy.mock.calls[0]
    expect(copyCall).toBeDefined()
    const cmd = (copyCall as unknown as [string])[0]
    expect(cmd).toContain('src/b.ts')
    expect(cmd).not.toContain('src/a.ts')
    // 交代条数 = 1(只有 d1 被跳过):键串携带 count=1
    const skippedCall = toastMock.error.mock.calls.find((c) =>
      String((c as unknown as [string])[0]).startsWith('diffReview.copyGitApplyUnreadable'),
    )
    expect(String((skippedCall as unknown as [string])[0])).toContain('count=1')
  })

  it('三方合并非冲突态回退读 HEAD/工作区失败 ⇒ 显式缺省态,不拿空串伪渲染', async () => {
    apiMock.runCommand.mockImplementation(async () => {
      // stage 1/2/3 全无 ⇒ 非冲突态;HEAD: 也读不到 ⇒ fallback 失败
      return { success: false, error: 'no such stage' }
    })
    apiMock.readFile.mockResolvedValue({ success: false, error: 'boom' })
    render(<DiffViewerPane />)
    await screen.findByTestId('diff-content-error') // 两栏内容本就失败
    fireEvent.click(screen.getByTestId('diff-3way-toggle'))
    await waitFor(() => expect(screen.getByTestId('diff-3way-error')).toBeTruthy())
    expect(screen.queryByTestId('stub-3way')).toBeNull()
  })
})
