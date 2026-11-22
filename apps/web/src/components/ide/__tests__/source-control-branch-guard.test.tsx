// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分支切换未提交改动保护的挂载级 DOM 对账(2026-11-23 改写)。
 *
 * 旧实现用 `git stash push`「保存改动并检出」,与仓规「stash 全面禁止」冲突 ——
 * 多会话共享同一工作树时,stash 会把别人的现场一起吞掉。新语义:
 *   ① 先用结构化 `getGitStatus` 探测(不再跑裸 `git status --porcelain`);
 *   ② 有未提交改动(含未跟踪/冲突)⇒ 直接阻止并提示先提交或丢弃;
 *   ③ 探测失败 ⇒ fail-closed,同样不切;
 *   ④ 干净工作区 ⇒ 直达 checkout。
 * 断言一律用裸 DOM 匹配器(本仓 apps/web 未装 @testing-library/jest-dom)。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// 语言包真值:不在测试里另抄一份文案表(§22c)。
const packPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../',
  'packages/i18n/messages/web/zh-CN.json',
)
const pack = JSON.parse(readFileSync(packPath, 'utf8')) as unknown as Record<string, unknown>

function msg(path: string, vars?: Record<string, number | string>): string {
  let cur: unknown = pack
  for (const s of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[s]
    else return path
  }
  if (typeof cur !== 'string') return path
  return vars ? cur.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : cur
}

const BLOCKED = msg('ide.sourceControl.dirtySwitchDescription')

const h = vi.hoisted(() => ({
  statusSpy: vi.fn(),
  switchSpy: vi.fn(),
  stageSpy: vi.fn(),
  unstageSpy: vi.fn(),
  diffFiles: [] as Array<Record<string, unknown>>,
  fetchGitLog: vi.fn(async () => {}),
  fetchGitBranches: vi.fn(async () => {}),
  fetchDiffFiles: vi.fn(async () => {}),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key?: string, vars?: Record<string, number | string>) =>
    key ? msg(`${ns}.${key}`, vars) : ns,
}))

vi.mock('@ihui/api-client', () => ({
  getGitStatus: h.statusSpy,
  switchWorkspaceGitBranch: h.switchSpy,
  createWorkspaceWatcher: vi.fn(async () => ({
    success: false,
    error: 'watcher disabled in test',
  })),
  getWorkspaceWatcherEvents: vi.fn(),
  removeWorkspaceWatcher: vi.fn(async () => ({ success: true, data: { removed: true } })),
  stageGitPaths: h.stageSpy,
  unstageGitPaths: h.unstageSpy,
  commitGit: vi.fn(async () => ({ success: true, data: { stdout: '', stderr: '', exitCode: 0 } })),
  pushWorkspaceGit: vi.fn(async () => ({
    success: true,
    data: { stdout: '', stderr: '', exitCode: 0 },
  })),
  pullWorkspaceGit: vi.fn(async () => ({
    success: true,
    data: { stdout: '', stderr: '', exitCode: 0 },
  })),
}))

vi.mock('@/components/common', () => ({
  toast: { success: h.toastSuccess, error: h.toastError },
}))

vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: () => ({
    activeView: 'source-control',
    diffFiles: h.diffFiles,
    gitCommits: [],
    gitBranches: ['main', 'feature-x'],
    gitCurrentBranch: 'main',
    workspacePath: 'G:/demo-repo',
    fetchGitLog: h.fetchGitLog,
    fetchGitBranches: h.fetchGitBranches,
    fetchDiffFiles: h.fetchDiffFiles,
  }),
}))

vi.mock('@/components/ide/host-git-section', () => ({
  HostGitSection: () => null,
}))

vi.mock('@/components/feedback/portal-panel', () => ({
  PortalPanel: (props: { open: boolean; children?: ReactNode }) =>
    props.open ? <div data-testid="branch-portal">{props.children}</div> : null,
}))

import { SourceControlPanel } from '../source-control-panel'

/** 挂载 → 打开分支浮层 → 点击目标分支 */
async function openBranchMenuAndPick(target: string) {
  render(<SourceControlPanel />)
  fireEvent.click(screen.getByText('main'))
  expect(await screen.findByTestId('branch-portal')).toBeTruthy()
  fireEvent.click(screen.getByText(target))
}

function cleanStatus() {
  return {
    isRepo: true,
    branch: 'main',
    hasRemote: true,
    ahead: 0,
    behind: 0,
    counts: {
      added: 0,
      modified: 0,
      deleted: 0,
      untracked: 0,
      conflicted: 0,
      renamed: 0,
    },
    lastCommit: { hash: '', message: '', author: '', date: '' },
    pullRequest: null,
  }
}

beforeEach(() => {
  h.statusSpy.mockReset()
  h.statusSpy.mockResolvedValue({ success: true, data: cleanStatus() })
  h.switchSpy.mockReset()
  h.switchSpy.mockResolvedValue({
    success: true,
    data: { stdout: '', stderr: '', exitCode: 0 },
  })
  h.toastSuccess.mockReset()
  h.toastError.mockReset()
  h.diffFiles.length = 0
  h.stageSpy.mockReset()
  h.stageSpy.mockResolvedValue({
    success: true,
    data: { stdout: '', stderr: '', exitCode: 0 },
  })
  h.unstageSpy.mockReset()
  h.unstageSpy.mockResolvedValue({
    success: true,
    data: { stdout: '', stderr: '', exitCode: 0 },
  })
})

afterEach(() => {
  cleanup()
})

describe('SourceControlPanel 分支切换未提交改动保护', () => {
  it('脏工作区 → 阻止切换并提示先提交/丢弃,不再出现 stash 动作', async () => {
    const dirty = cleanStatus()
    dirty.counts.modified = 1
    dirty.counts.untracked = 1
    h.statusSpy.mockResolvedValue({ success: true, data: dirty })

    await openBranchMenuAndPick('feature-x')

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(BLOCKED))
    expect(h.switchSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(msg('ide.sourceControl.dirtySwitchTitle'))).toBeNull()
  })

  it('探测失败 → fail-closed,不切分支', async () => {
    h.statusSpy.mockResolvedValue({ success: false, error: 'boom' })
    await openBranchMenuAndPick('feature-x')

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(BLOCKED))
    expect(h.switchSpy).not.toHaveBeenCalled()
  })

  it('探测抛异常 → fail-closed,不切分支', async () => {
    h.statusSpy.mockRejectedValue(new Error('network'))
    await openBranchMenuAndPick('feature-x')

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(BLOCKED))
    expect(h.switchSpy).not.toHaveBeenCalled()
  })

  it('干净工作区 → 直达 checkout', async () => {
    await openBranchMenuAndPick('feature-x')

    await waitFor(() =>
      expect(h.switchSpy).toHaveBeenCalledWith({
        workspacePath: 'G:/demo-repo',
        name: 'feature-x',
      }),
    )
    expect(h.statusSpy).toHaveBeenCalledWith({ workspacePath: 'G:/demo-repo' })
    expect(h.toastError).not.toHaveBeenCalled()
  })

  it('暂存后又改过 → 同现两组,按钮动作按所在分组', async () => {
    h.diffFiles.push({
      id: 'diff-both.ts',
      filename: 'both.ts',
      status: 'modified',
      oldContent: '',
      newContent: '',
      additions: 2,
      deletions: 1,
      language: 'typescript',
      staged: true,
      unstaged: true,
    })
    render(<SourceControlPanel />)

    await waitFor(() => expect(screen.getAllByText('both.ts')).toHaveLength(2))

    fireEvent.click(screen.getByLabelText(msg('ide.sourceControl.unstage')))
    await waitFor(() =>
      expect(h.unstageSpy).toHaveBeenCalledWith({
        workspacePath: 'G:/demo-repo',
        paths: ['both.ts'],
      }),
    )

    fireEvent.click(screen.getByLabelText(msg('ide.sourceControl.stage')))
    await waitFor(() =>
      expect(h.stageSpy).toHaveBeenCalledWith({
        workspacePath: 'G:/demo-repo',
        paths: ['both.ts'],
      }),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​​‌‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
