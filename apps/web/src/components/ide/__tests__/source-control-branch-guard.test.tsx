// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D178:分支切换未提交改动保护的挂载级 DOM 对账。
 *
 * 为什么整组件挂载:这条保护的病根是「点了分支名 → 改动直接被 checkout 冲掉」,
 * 只有从真实点击流(打开浮层 → 点目标分支 → 弹层/直达)出发才能证明拦截真的长在
 * 用户路径上。断言一律用裸 DOM 匹配器(本仓 apps/web 未装 @testing-library/jest-dom)。
 *
 * mock 面全部是与本票无关的旁支:宿主 git 通道(浏览器恒 null)、浮层定位实现、
 * ide-workspace store、传输层 runCommand。没有 mock 掉的正是本票要证明的:
 * SourceControlPanel 本体 + ConfirmDialog/Modal 的真实弹层行为。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// 语言包真值:不在测试里另抄一份文案表(§22c)。__tests__ → ide → components → src
// → web → apps → 仓库根,共上溯 6 层(比 components/__tests__ 多一层)。
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

const DIRTY_TITLE = msg('ide.sourceControl.dirtySwitchTitle')
const PRESERVE_ACTION = msg('ide.sourceControl.preserveChangesAction')

const h = vi.hoisted(() => ({
  runSpy: vi.fn(),
  fetchGitLog: vi.fn(async () => {}),
  fetchGitBranches: vi.fn(async () => {}),
  fetchDiffFiles: vi.fn(async () => {}),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  /** 可变探测结果:'' = 干净工作区,非空 = 有未提交改动(喂给 git status --porcelain) */
  statusOut: '',
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key?: string, vars?: Record<string, number | string>) =>
    key ? msg(`${ns}.${key}`, vars) : ns,
}))

vi.mock('@ihui/api-client', () => ({
  runCommand: h.runSpy,
}))

vi.mock('@/components/common', () => ({
  toast: { success: h.toastSuccess, error: h.toastError },
}))

vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: () => ({
    activeView: 'source-control',
    diffFiles: [],
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

/** runSpy 全部调用里的命令串(挂载期还有 staged 探测,断言按命令前缀过滤) */
function ranCommands(): string[] {
  return h.runSpy.mock.calls.map((call) => (call[0] as { command: string }).command)
}

/** 挂载 → 打开分支浮层 → 点击目标分支;返回后浮层必已出现 */
async function openBranchMenuAndPick(target: string) {
  render(<SourceControlPanel />)
  // 挂载期 staged 探测(git diff --name-only --cached)先落地,避免 act 竞态
  await waitFor(() => expect(h.runSpy).toHaveBeenCalled())
  fireEvent.click(screen.getByText('main'))
  expect(await screen.findByTestId('branch-portal')).toBeTruthy()
  fireEvent.click(screen.getByText(target))
}

beforeEach(() => {
  h.statusOut = ''
  h.runSpy.mockReset()
  h.runSpy.mockImplementation(async (args: { command: string }) => {
    if (args.command.startsWith('git status --porcelain')) {
      return { success: true, data: { stdout: h.statusOut } }
    }
    return { success: true, data: { stdout: '' } }
  })
  h.toastSuccess.mockReset()
  h.toastError.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('SourceControlPanel 分支切换未提交改动保护 (D178)', () => {
  it('脏工作区检出 → 弹「保存改动并检出」确认,不直接 checkout', async () => {
    h.statusOut = ' M src/a.ts\n?? notes.md\n'
    await openBranchMenuAndPick('feature-x')

    expect(await screen.findByText(DIRTY_TITLE)).toBeTruthy()
    expect(screen.getByText(PRESERVE_ACTION)).toBeTruthy()
    expect(screen.getByText(msg('ide.sourceControl.dirtySwitchDescription'))).toBeTruthy()

    const commands = ranCommands()
    expect(commands.some((c) => c.startsWith('git checkout'))).toBe(false)
    expect(commands.some((c) => c.startsWith('git stash push'))).toBe(false)
  })

  it('确认保护 → 先 stash push 后 checkout feature-x,弹层关闭', async () => {
    h.statusOut = ' M src/a.ts\n'
    await openBranchMenuAndPick('feature-x')
    await screen.findByText(DIRTY_TITLE)

    fireEvent.click(screen.getByTestId('confirm-button'))

    await waitFor(() =>
      expect(
        ranCommands().some((c) =>
          c.startsWith('git stash push --include-untracked'),
        ),
      ).toBe(true),
    )
    await waitFor(() => expect(ranCommands()).toContain('git checkout feature-x'))

    // 顺序对账:stash 必须发生在 checkout 之前(先保改动再切分支)
    const commands = ranCommands()
    const stashIdx = commands.findIndex((c) => c.startsWith('git stash push'))
    const checkoutIdx = commands.indexOf('git checkout feature-x')
    expect(stashIdx).toBeGreaterThanOrEqual(0)
    expect(checkoutIdx).toBeGreaterThan(stashIdx)

    await waitFor(() => expect(screen.queryByText(DIRTY_TITLE)).toBeNull())
    expect(h.toastSuccess).toHaveBeenCalled()
  })

  it('干净工作区 → 直达 checkout,不弹确认、不 stash', async () => {
    h.statusOut = ''
    await openBranchMenuAndPick('feature-x')

    await waitFor(() => expect(ranCommands()).toContain('git checkout feature-x'))
    expect(ranCommands().some((c) => c.startsWith('git stash push'))).toBe(false)
    expect(screen.queryByText(DIRTY_TITLE)).toBeNull()
  })

  it('取消确认 → 不 stash 不 checkout,弹层关闭', async () => {
    h.statusOut = ' M src/a.ts\n'
    await openBranchMenuAndPick('feature-x')
    await screen.findByText(DIRTY_TITLE)

    fireEvent.click(screen.getByTestId('confirm-cancel-button'))

    await waitFor(() => expect(screen.queryByText(DIRTY_TITLE)).toBeNull())
    const commands = ranCommands()
    expect(commands.some((c) => c.startsWith('git stash push'))).toBe(false)
    expect(commands.some((c) => c.startsWith('git checkout'))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
