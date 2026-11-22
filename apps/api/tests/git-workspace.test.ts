// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Git 工作区写通道的判据测试(2026-11-23)。
 *
 * 覆盖:
 *  ① 真实仓库的 stage → commit → log → branch create/switch;
 *  ② unstage 后暂存区为空;
 *  ③ 仓库自带 pre-commit 钩子**不执行**(core.hooksPath 被改到不存在的目录);
 *  ④ pathspec 拒绝绝对路径/盘符/`..`,分支名拒绝空白与 `..`;
 *  ⑤ 路由层每条写端点先过 workspace_permissions,再碰 gitWorkspace。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  GitWorkspaceError,
  assertSafeBranchName,
  gitWorkspace,
  normalizeRepoPaths,
} from '../src/services/git-workspace.js'
import { WORKSPACE_ROOTS_ENV } from '../src/utils/workspace-roots.js'

let root: string
let previousRoots: string | undefined

const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf-8' })

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-git-workspace-'))
  previousRoots = process.env[WORKSPACE_ROOTS_ENV]
  process.env[WORKSPACE_ROOTS_ENV] = root
  git(['init', '-b', 'main'])
  git(['config', 'user.name', 'IHUI Test'])
  git(['config', 'user.email', 'ihui-test@local'])
  writeFileSync(join(root, 'a.txt'), 'first\n', 'utf-8')
})

afterAll(() => {
  if (previousRoots === undefined) delete process.env[WORKSPACE_ROOTS_ENV]
  else process.env[WORKSPACE_ROOTS_ENV] = previousRoots
  rmSync(root, { recursive: true, force: true })
})

describe('GitWorkspace 写通道', () => {
  it('stage → commit → log → branches', async () => {
    await gitWorkspace.stage(root, ['a.txt'])
    await gitWorkspace.commit(root, 'feat: first commit', [])
    const commits = await gitWorkspace.log(root, 5)
    expect(commits).toHaveLength(1)
    expect(commits[0]?.subject).toBe('feat: first commit')
    expect(commits[0]?.hash).toMatch(/^[0-9a-f]{40}$/)

    const branches = await gitWorkspace.branches(root)
    expect(branches).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'main', current: true })]),
    )
  })

  it('create/switch 分支并拒绝非法分支名', async () => {
    await gitWorkspace.createBranch(root, 'feature/git-api', true)
    expect((await gitWorkspace.branches(root)).find((b) => b.current)?.name).toBe('feature/git-api')
    await gitWorkspace.switchBranch(root, 'main')
    expect((await gitWorkspace.branches(root)).find((b) => b.current)?.name).toBe('main')
    expect(() => assertSafeBranchName('bad name')).toThrow(GitWorkspaceError)
    expect(() => assertSafeBranchName('../escape')).toThrow(GitWorkspaceError)
  })

  it('unstage 清空暂存区但保留工作区文件', async () => {
    writeFileSync(join(root, 'b.txt'), 'second\n', 'utf-8')
    await gitWorkspace.stage(root, ['b.txt'])
    await gitWorkspace.unstage(root, ['b.txt'])
    expect(git(['diff', '--cached', '--name-only']).trim()).toBe('')
    expect(existsSync(join(root, 'b.txt'))).toBe(true)
  })

  it('仓库自带 pre-commit 钩子不执行', async () => {
    mkdirSync(join(root, '.git', 'hooks'), { recursive: true })
    writeFileSync(
      join(root, '.git', 'hooks', 'pre-commit'),
      '#!/bin/sh\necho hook-ran > .git/hook-ran\n',
      'utf-8',
    )
    writeFileSync(join(root, 'c.txt'), 'third\n', 'utf-8')
    await gitWorkspace.stage(root, ['c.txt'])
    await gitWorkspace.commit(root, 'test: hooks must not run', [])
    expect(existsSync(join(root, '.git', 'hook-ran'))).toBe(false)
  })

  it('diff 返回 unified patch,check-ignore 只回被忽略路径', async () => {
    writeFileSync(join(root, '.gitignore'), 'ignored.txt\n', 'utf-8')
    writeFileSync(join(root, 'ignored.txt'), 'should not be committed\n', 'utf-8')
    writeFileSync(join(root, 'd.txt'), 'first line\n', 'utf-8')
    await gitWorkspace.stage(root, ['d.txt'])
    writeFileSync(join(root, 'd.txt'), 'dirty line\n', 'utf-8')

    const unstaged = await gitWorkspace.diff(root)
    expect(unstaged.staged).toBe(false)
    expect(unstaged.diff).toContain('+dirty line')
    expect(unstaged.diff).not.toContain('ignored.txt')

    const staged = await gitWorkspace.diff(root, { staged: true, paths: ['d.txt'] })
    expect(staged.staged).toBe(true)
    expect(staged.diff).toContain('+first line')

    const ignored = await gitWorkspace.checkIgnore(root, ['ignored.txt', 'd.txt'])
    expect(ignored).toEqual(['ignored.txt'])
    expect(await gitWorkspace.checkIgnore(root, ['definitely-not-ignored.txt'])).toEqual([])
  })

  it('pathspec 拒绝绝对路径、盘符与 ..', () => {
    expect(() => normalizeRepoPaths(['../outside.txt'])).toThrow(GitWorkspaceError)
    expect(() => normalizeRepoPaths(['/etc/passwd'])).toThrow(GitWorkspaceError)
    expect(() => normalizeRepoPaths(['C:/Windows/win.ini'])).toThrow(GitWorkspaceError)
    expect(normalizeRepoPaths(['src\\a.ts'])).toEqual(['src/a.ts'])
  })
})

describe('路由接线顺序', () => {
  const route = readFileSync(
    fileURLToPath(new URL('../src/routes/workspace-ai.ts', import.meta.url)),
    'utf-8',
  )

  it('每条写端点先过 workspace_permissions 再调用 gitWorkspace', () => {
    for (const [tool, call] of [
      ['git_stage', 'gitWorkspace.stage'],
      ['git_unstage', 'gitWorkspace.unstage'],
      ['git_discard', 'gitWorkspace.discard'],
      ['git_diff', 'gitWorkspace.diff'],
      ['git_check_ignore', 'gitWorkspace.checkIgnore'],
      ['git_commit', 'gitWorkspace.commit'],
      ['git_branch_create', 'gitWorkspace.createBranch'],
      ['git_branch_switch', 'gitWorkspace.switchBranch'],
      ['git_push', 'gitWorkspace.push'],
      ['git_pull', 'gitWorkspace.pull'],
    ] as const) {
      const toolIdx = route.indexOf(`'${tool}'`)
      const callIdx = route.indexOf(call)
      expect(toolIdx).toBeGreaterThan(-1)
      expect(callIdx).toBeGreaterThan(-1)
      expect(toolIdx).toBeLessThan(callIdx)
    }
  })

  it('push/pull 在权限闸之前要求 admin', () => {
    for (const path of ["'/git/push'", "'/git/pull'"]) {
      const start = route.indexOf(path)
      const admin = route.indexOf('await requireAdmin(request, reply)', start)
      const permission = route.indexOf('isAllowedWorkspace', start)
      expect(admin).toBeGreaterThan(-1)
      expect(permission).toBeGreaterThan(admin)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
