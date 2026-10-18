// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #72 —— 宿主 git 通道消费面的渲染级用例。
//
// 唯一要紧的判据:**`undetermined` 与「没有改动」必须在 DOM 上不同形**。
// 宿主在 undetermined 时返回的是空 entries —— 所以只看列表长度无法分辨,必须看 state。
// 这组用例就是把"看不见的失明不许被画成结论"钉在 DOM 上。

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GitWorkspaceStatusReply } from '@/lib/tauri-bridge'
import type { UseHostGitWorkspaceResult } from '@/hooks/use-host-git-workspace'
// vitest 会把 vi.mock 提升到 import 之前求值,所以这里按正常位置 import 被测组件即可
import { HostGitSection } from '../host-git-section'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const workspaceState = { workspacePath: 'D:/repo' }
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: () => workspaceState,
}))

const hookState = vi.hoisted((): UseHostGitWorkspaceResult => ({
  inHost: true,
  status: null,
  info: null,
  error: null,
  busy: null,
  diff: null,
  index: null,
  authorize: vi.fn(),
  refresh: vi.fn(),
  getDiff: vi.fn(),
  scanIndex: vi.fn(),
  clearDiff: vi.fn(),
}))

vi.mock('@/hooks/use-host-git-workspace', () => ({
  useHostGitWorkspace: () => hookState,
}))

const reply = (patch: Partial<GitWorkspaceStatusReply>): GitWorkspaceStatusReply => ({
  state: 'facts',
  verdict: 'dirty',
  reason: '',
  root: 'D:/repo',
  git_binary: 'C:/Program Files/Git/cmd/git.exe',
  scope: null,
  total: 1,
  by_kind: [['modified', 1]],
  entries: [
    {
      kind: 'modified',
      index_status: 'M',
      worktree_status: ' ',
      path: 'src/a.ts',
      old_path: null,
    },
  ],
  ...patch,
})

const line = (container: HTMLElement) => container.querySelector('[data-testid="host-git-line"]')

beforeEach(() => {
  hookState.inHost = true
  hookState.status = null
  hookState.info = null
  hookState.error = null
  hookState.busy = null
  hookState.diff = null
  hookState.index = null
  vi.clearAllMocks()
})

describe('V3 #72 / HostGitSection 三态不得混形', () => {
  it('浏览器(非宿主)⇒ 整块不渲染,而不是渲染一个"没有改动"', () => {
    hookState.inHost = false
    const { container } = render(<HostGitSection />)
    expect(container.querySelector('[data-testid="host-git-section"]')).toBeNull()
  })

  it('undetermined 且 entries 为空 ⇒ 必须画成"取不到/判不了"并带宿主原因', () => {
    hookState.status = reply({
      state: 'undetermined',
      verdict: 'binary_not_found',
      reason: '找不到可用的 git 二进制',
      total: 0,
      entries: [],
      git_binary: '',
    })
    const { container } = render(<HostGitSection />)
    const el = line(container)
    expect(el?.getAttribute('data-state')).toBe('undetermined')
    expect(el?.textContent).toContain('找不到可用的 git 二进制')
    // 关键反向断言:与 facts/clean 那条**不是同一格**
    expect(el?.textContent).not.toContain('hostGit.clean')
    expect(container.querySelector('[data-testid="host-git-entry-list"]')).toBeNull()
  })

  it('facts + clean ⇒ 明确说"干净",且不与 undetermined 共用档位', () => {
    hookState.status = reply({ verdict: 'clean', total: 0, entries: [] })
    const { container } = render(<HostGitSection />)
    expect(line(container)?.getAttribute('data-state')).toBe('facts')
    expect(line(container)?.textContent).toContain('hostGit.clean')
  })

  it('facts + dirty ⇒ 列出变更清单,条目带 kind 与路径', () => {
    hookState.status = reply({})
    const { container } = render(<HostGitSection />)
    const entries = container.querySelectorAll('[data-testid="host-git-entry"]')
    expect(entries.length).toBe(1)
    expect(entries[0]?.getAttribute('data-kind')).toBe('modified')
    expect(entries[0]?.textContent).toContain('src/a.ts')
  })

  it('command_failed ⇒ 档位是 command_failed,原因与 verdict 都带出', () => {
    hookState.status = reply({
      state: 'command_failed',
      verdict: 'exit=128',
      reason: 'not a git repository',
      total: 0,
      entries: [],
    })
    const { container } = render(<HostGitSection />)
    const el = line(container)
    expect(el?.getAttribute('data-state')).toBe('command_failed')
    expect(el?.textContent).toContain('not a git repository')
    expect(el?.textContent).toContain('exit=128')
  })

  it('还没取得任何结论 ⇒ 画"尚未有结论",不画"干净"', () => {
    hookState.status = null
    const { container } = render(<HostGitSection />)
    expect(line(container)?.getAttribute('data-state')).toBe('pending')
    expect(line(container)?.textContent).toContain('hostGit.noVerdict')
  })

  it('宿主拒绝 ⇒ 独立一格并带拒绝原因(不得压成"无结论"或"干净")', () => {
    hookState.error = { kind: 'host-rejected', message: 'root 不在允许的 base 内' }
    const { container } = render(<HostGitSection />)
    const el = line(container)
    expect(el?.getAttribute('data-state')).toBe('rejected')
    expect(el?.textContent).toContain('root 不在允许的 base 内')
  })

  it('没有 workspacePath ⇒ 授权钮禁用并说明原因,而不是发了才报错', () => {
    workspaceState.workspacePath = ''
    const { container } = render(<HostGitSection />)
    const btn = container.querySelector<HTMLButtonElement>(
      '[data-testid="host-git-authorize-btn"]',
    )
    expect(btn?.disabled).toBe(true)
    expect(line(container)?.textContent).toContain('hostGit.noWorkspace')
  })
})

describe('V3 #72① / diff 与 index 两格同守三态纪律', () => {
  it('点条目 ⇒ 以该条路径发 getDiff(不整根刷)', async () => {
    hookState.status = reply({})
    const { container } = render(<HostGitSection />)
    const entry = container.querySelector('[data-testid="host-git-entry"]')
    expect(entry).not.toBeNull()
    entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(hookState.getDiff).toHaveBeenCalledWith('src/a.ts')
  })

  it('diff undetermined ⇒ 面板画"取不到"带原因,绝不出现 clean 档位', () => {
    hookState.diff = {
      state: 'undetermined',
      verdict: 'no_root',
      reason: '尚未授权工作区根',
      scope: 'src/a.ts',
      staged: false,
      text: '',
      total_bytes: 0,
    }
    const { container } = render(<HostGitSection />)
    const panel = container.querySelector('[data-testid="host-git-diff-panel"]')
    expect(panel?.getAttribute('data-state')).toBe('undetermined')
    expect(panel?.textContent).toContain('尚未授权工作区根')
    expect(panel?.textContent).not.toContain('hostGit.diffClean')
  })

  it('diff facts+dirty ⇒ 正文原样进 <pre>;关闭钮触发 clearDiff', async () => {
    hookState.diff = {
      state: 'facts',
      verdict: 'dirty',
      reason: '',
      scope: 'src/a.ts',
      staged: false,
      text: 'diff --git a/src/a.ts b/src/a.ts',
      total_bytes: 33,
    }
    const { container } = render(<HostGitSection />)
    const panel = container.querySelector('pre[data-testid="host-git-diff-panel"]')
    expect(panel?.textContent).toBe('diff --git a/src/a.ts b/src/a.ts')
    container
      .querySelector('[data-testid="host-git-diff-close"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(hookState.clearDiff).toHaveBeenCalled()
  })

  it('index undetermined ⇒ 独立一格带宿主原因,不与"空目录"同形', () => {
    hookState.index = {
      state: 'undetermined',
      reason: '根目录不可读',
      root: '',
      total: 0,
      entries: [],
      symlink_dirs_skipped: 0,
      non_utf8_skipped: 0,
      delta: null,
    }
    const { container } = render(<HostGitSection />)
    const el = container.querySelector('[data-testid="host-git-index-line"]')
    expect(el?.getAttribute('data-state')).toBe('undetermined')
    expect(el?.textContent).toContain('根目录不可读')
  })

  it('index facts + delta ⇒ 数字格;facts 无 delta ⇒ 明说"首次扫描,无对比基准"', () => {
    hookState.index = {
      state: 'facts',
      reason: '',
      root: 'D:/repo',
      total: 12,
      entries: [],
      symlink_dirs_skipped: 2,
      non_utf8_skipped: 1,
      delta: { basis: 'rel+size+mtime_ms', added: ['a'], removed: ['b'], changed: ['c'], unchanged: 9 },
    }
    const { container } = render(<HostGitSection />)
    let el = container.querySelector('[data-testid="host-git-index-line"]')
    expect(el?.getAttribute('data-state')).toBe('facts')
    expect(el?.textContent).toContain('12')
    expect(el?.textContent).toContain('hostGit.indexDelta')
    expect(el?.textContent).toContain('hostGit.indexSkipped')

    hookState.index = { ...hookState.index, total: 7, symlink_dirs_skipped: 0, non_utf8_skipped: 0, delta: null }
    const { container: c2, unmount } = render(<HostGitSection />)
    el = c2.querySelector('[data-testid="host-git-index-line"]')
    expect(el?.textContent).toContain('hostGit.indexFirst')
    expect(el?.textContent).not.toContain('hostGit.indexSkipped')
    unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
