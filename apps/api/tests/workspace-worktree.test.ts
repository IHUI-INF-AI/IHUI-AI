// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作树台账纯函数(F-Forge,2026-11-13 立)
 *
 * 安全判据优先:分支名任何越界一律抛错(不做"清洗后放行"),命令只允许 worktree。
 */

import { describe, expect, it } from 'vitest'

import {
  assertSafeWorktreeBranch,
  buildWorktreeCmd,
  parseWorktreePorcelain,
  worktreeSlug,
} from '../src/services/worktree-ledger.js'

describe('worktree-ledger / 分支名校验', () => {
  it('正常分支名通过(feat/x、fix_bug、release-1.2)', () => {
    for (const branch of ['feat/change-request-panel', 'fix_bug', 'release-1.2', 'main']) {
      expect(() => assertSafeWorktreeBranch(branch)).not.toThrow()
    }
  })

  it('路径穿越 / 双斜杠 / 结尾非法字符 → 拒绝', () => {
    for (const branch of ['../evil', 'feat/../x', 'feat//x', 'feat/', 'feat.', 'feat.lock']) {
      expect(() => assertSafeWorktreeBranch(branch)).toThrow()
    }
  })

  it('以连字符开头 / 空串 / 超长 / 含空格 → 拒绝', () => {
    for (const branch of ['-rf', '', 'a'.repeat(121), 'feat x']) {
      expect(() => assertSafeWorktreeBranch(branch)).toThrow()
    }
  })
})

describe('worktree-ledger / 路径派生', () => {
  it('斜杠转连字符,仅保留安全字符', () => {
    expect(worktreeSlug('feat/x')).toBe('feat-x')
    expect(worktreeSlug('feat/a b')).toBe('feat-a-b')
    expect(worktreeSlug('feat/@#$')).toBe('feat----')
  })
})

describe('worktree-ledger / 命令构造', () => {
  it('只放行 worktree 子命令', () => {
    expect(buildWorktreeCmd(['worktree', 'list', '--porcelain'])).toBe(
      'git worktree list --porcelain',
    )
    expect(() => buildWorktreeCmd(['rev-parse', 'HEAD'])).toThrow()
  })

  it('参数含 .. / ~ / 绝对路径 → 拒绝', () => {
    for (const arg of ['../x', '~/x', '/etc/passwd']) {
      expect(() => buildWorktreeCmd(['worktree', 'add', arg])).toThrow()
    }
  })
})

describe('worktree-ledger / porcelain 解析', () => {
  it('解析多工作树:第一段为主工作树,分支去掉 refs/heads/ 前缀', () => {
    const raw = [
      'worktree /repo',
      'HEAD aaaa',
      'branch refs/heads/main',
      '',
      'worktree /repo/.ihui-worktrees/feat-x',
      'HEAD bbbb',
      'branch refs/heads/feat/x',
      '',
    ].join('\n')
    const list = parseWorktreePorcelain(raw)
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({ path: '/repo', branch: 'main', head: 'aaaa', isMain: true })
    expect(list[1]).toEqual({
      path: '/repo/.ihui-worktrees/feat-x',
      branch: 'feat/x',
      head: 'bbbb',
      isMain: false,
    })
  })

  it('detached HEAD(无 branch 行)→ branch=null', () => {
    const list = parseWorktreePorcelain('worktree /repo\nHEAD cccc\ndetached\n')
    expect(list[0]?.branch).toBeNull()
    expect(list[0]?.isMain).toBe(true)
  })

  it('空输出 → 空数组', () => {
    expect(parseWorktreePorcelain('')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
