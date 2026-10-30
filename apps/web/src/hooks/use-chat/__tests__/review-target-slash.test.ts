// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D06 审查对象选择器(/review uncommitted | branch <ref> | commit <sha>)行为测试:
// 正例断言"认出目标 + 只读收集 + diff 进正文",反例断言"认不出就一律不接管",
// 以及收集失败/空 diff 必须明说(不静默发一轮空审查)。
import { describe, expect, it, vi, beforeEach } from 'vitest'

const holder = vi.hoisted(() => ({ workspacePath: 'G:/repo' as string | null }))
const { mockRunCommand, mockSetMode, mockToastSuccess } = vi.hoisted(() => ({
  mockRunCommand: vi.fn(),
  mockSetMode: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

vi.mock('@/components/common', () => ({
  toast: { success: mockToastSuccess, info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: { getState: () => ({ workspacePath: holder.workspacePath }) },
}))
vi.mock('@/stores/mode', () => ({
  useModeStore: { getState: () => ({ currentMode: 'build', setMode: mockSetMode }) },
}))
vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => ({ messages: [], usageByMessageId: {}, conversationId: null }),
  },
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: {
    getState: () => ({ activeWorkspace: null, pendingPermissionMode: null, setPendingFullAccess: vi.fn() }),
  },
}))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>
  return {
    ...mod,
    runCommand: mockRunCommand,
    postSessionGoal: vi.fn(async () => ({ accepted: true })),
  }
})

import {
  REVIEW_DIFF_LIMIT,
  buildReviewTargetCommand,
  buildReviewTargetPrompt,
  parseReviewTargetArgs,
  tryHandleReviewTargetSlash,
} from '../slash-commands'

const t = (key: string, vars?: Record<string, string>) =>
  `${key}${vars ? JSON.stringify(vars) : ''}`

const fakeModeStore = (currentMode: string) => ({
  getState: () => ({ currentMode, setMode: mockSetMode }),
})

const okDiff = (stdout: string, stderr = '') => ({
  success: true,
  data: { stdout, stderr, exitCode: 0, mode: 'read-only' },
})

describe('D06 /review 审查对象选择器', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    holder.workspacePath = 'G:/repo'
  })

  it('认出三类目标(含别名),并把命令收敛到只读 git', () => {
    expect(parseReviewTargetArgs('uncommitted')).toEqual({ kind: 'uncommitted', ref: null })
    expect(parseReviewTargetArgs('worktree')).toEqual({ kind: 'uncommitted', ref: null })
    expect(parseReviewTargetArgs('branch main')).toEqual({ kind: 'branch', ref: 'main' })
    expect(parseReviewTargetArgs('commit 2fc9ab9b55')).toEqual({
      kind: 'commit',
      ref: '2fc9ab9b55',
    })
    expect(buildReviewTargetCommand({ kind: 'uncommitted', ref: null })).toBe('git diff HEAD')
    expect(buildReviewTargetCommand({ kind: 'branch', ref: 'main' })).toBe('git diff main...HEAD')
    expect(buildReviewTargetCommand({ kind: 'commit', ref: '2fc9ab9b55' })).toBe(
      'git show --no-color --stat --patch 2fc9ab9b55',
    )
  })

  it('反例:认不出的参数一律返回 null(不接管,交给原链路)', () => {
    expect(parseReviewTargetArgs('')).toBeNull()
    expect(parseReviewTargetArgs('看看这段')).toBeNull()
    expect(parseReviewTargetArgs('branch')).toBeNull()
    expect(parseReviewTargetArgs('commit xyz')).toBeNull()
    // 以 `-` 开头会被 git 当选项,必须挡在解析层
    expect(parseReviewTargetArgs('branch --help')).toBeNull()
    expect(parseReviewTargetArgs('commit --amend')).toBeNull()
  })

  it('/review <target> 命中后:切 review 模式 + 只读取 diff + diff 进正文', async () => {
    mockRunCommand.mockResolvedValueOnce(okDiff('diff --git a/a.ts b/a.ts\n+bug\n'))
    const prompt = await tryHandleReviewTargetSlash(
      '/review uncommitted',
      t,
      fakeModeStore('build') as never,
    )
    expect(mockSetMode).toHaveBeenCalledWith('review')
    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockRunCommand).toHaveBeenCalledWith({
      command: 'git diff HEAD',
      workspacePath: 'G:/repo',
      mode: 'read-only',
    })
    expect(prompt).toContain('```diff')
    expect(prompt).toContain('+bug')
  })

  it('反例:/review 无目标、自由文本、非命令 → null(零 git 调用)', async () => {
    await expect(
      tryHandleReviewTargetSlash('/review', t, fakeModeStore('review') as never),
    ).resolves.toBeNull()
    await expect(
      tryHandleReviewTargetSlash('/review 看看这段', t, fakeModeStore('review') as never),
    ).resolves.toBeNull()
    await expect(
      tryHandleReviewTargetSlash('请 /review uncommitted', t, fakeModeStore('review') as never),
    ).resolves.toBeNull()
    expect(mockRunCommand).not.toHaveBeenCalled()
    expect(mockSetMode).not.toHaveBeenCalled()
  })

  it('收集失败 / 空 diff / 无工作区都明说,不静默发空审查', async () => {
    mockRunCommand.mockResolvedValueOnce({ success: false, error: 'boom' })
    const failed = await tryHandleReviewTargetSlash(
      '/review branch main',
      t,
      fakeModeStore('review') as never,
    )
    expect(failed).toContain('could not be collected: boom')

    mockRunCommand.mockResolvedValueOnce(okDiff('   '))
    const empty = await tryHandleReviewTargetSlash(
      '/review uncommitted',
      t,
      fakeModeStore('review') as never,
    )
    expect(empty).toContain('diff is empty')

    holder.workspacePath = null
    const noWorkspace = await tryHandleReviewTargetSlash(
      '/review commit 2fc9ab9b55',
      t,
      fakeModeStore('review') as never,
    )
    expect(noWorkspace).toContain('no workspace is open')
  })

  it('超长 diff 截断且点名截掉多少;未超长不出现截断说明', () => {
    const long = 'x'.repeat(REVIEW_DIFF_LIMIT + 500)
    const clipped = buildReviewTargetPrompt({ kind: 'uncommitted', ref: null }, long)
    expect(clipped).toContain('characters omitted')
    const body = clipped.split('```diff')[1] ?? ''
    expect(body).not.toContain('x'.repeat(REVIEW_DIFF_LIMIT + 1))

    const short = buildReviewTargetPrompt(
      { kind: 'commit', ref: '2fc9ab9b55' },
      'diff --git a/a b/a\n+ok\n',
    )
    expect(short).not.toContain('characters omitted')
    expect(short).toContain('commit 2fc9ab9b55')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
