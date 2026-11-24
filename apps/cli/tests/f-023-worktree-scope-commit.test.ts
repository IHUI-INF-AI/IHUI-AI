// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolResult } from '../src/tools/index.js'

/**
 * F-023 回归:链接 worktree 内按范围提交。
 *
 * 根因:worktree 的 `.git` 是**文件**(`gitdir: <main>/.git/worktrees/<name>`),
 * 旧实现 `join(cwd, '.git', 'index-scope-…')` 落盘 ENOTDIR / "No such file or directory"。
 * 修法:临时索引改落在 `git rev-parse --absolute-git-dir` 的返回值里
 * (主仓 = `<repo>/.git`;worktree = `<main>/.git/worktrees/<name>`,正是该 worktree 真实 index 所在)。
 *
 * 覆盖:
 *  1. worktree 内(含中文文件名)按范围提交成功,且提交只含指定文件、其它已暂存文件不被吞;
 *  2. 主仓内普通范围提交行为不变。
 */

function git(dir: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  // 病会话 EBUSY 修复:不喂 stdin 的派生一律 ignore(见 .workbuddy/skills/ihui-spawn-ebusy-fix)
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function expectOk(dir: string, args: string[]): string {
  const r = git(dir, args)
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout
}

const tmpRoots: string[] = []

/** 建一个有一条基线提交的主仓(worktree add 需要 HEAD 存在),返回 [临时根, 主仓] */
function makeRepoWithBaseline(): [string, string] {
  const root = mkdtempSync(join(tmpdir(), 'ihui-f023-'))
  tmpRoots.push(root)
  const dir = join(root, 'main')
  mkdirSync(dir)
  expectOk(dir, ['init', '-q'])
  // 身份/签名配置直接落 .git/config(省掉 3 次 git 派生,整测压在 15s 超时内)
  appendFileSync(
    join(dir, '.git', 'config'),
    '[user]\n\tname = test\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n',
  )
  writeFileSync(join(dir, 'baseline.txt'), 'baseline\n')
  expectOk(dir, ['add', 'baseline.txt'])
  expectOk(dir, ['commit', '-q', '-m', 'baseline'])
  return [root, dir]
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      /* 临时目录清理失败不干扰断言 */
    }
  }
})

async function callGitCommit(args: Record<string, unknown>, workspacePath: string): Promise<ToolResult> {
  const { GIT_TOOLS } = await import('../src/tools/git.js')
  const tool = GIT_TOOLS.find((t) => t.name === 'git_commit')
  if (!tool) throw new Error('git_commit 工具不存在')
  return tool.execute(args, { workspacePath }) as Promise<ToolResult>
}

describe('F-023:worktree 内按范围提交', () => {
  it('worktree(.git 是文件)内只提交指定中文文件,其它已暂存文件不被吞', async () => {
    const [root, mainRepo] = makeRepoWithBaseline()
    const wt = join(root, 'wt')
    expectOk(mainRepo, ['worktree', 'add', '-q', wt, '-b', 'f023-feature'])

    // 前置事实:worktree 的 .git 是文件(旧实现正是在这里 ENOTDIR)
    expect(statSync(join(wt, '.git')).isFile()).toBe(true)
    // 实读:worktree 的绝对 git 目录落在主仓 .git/worktrees/<name> 且是目录
    const wtGitDir = expectOk(wt, ['rev-parse', '--absolute-git-dir']).trim()
    expect(statSync(wtGitDir).isDirectory()).toBe(true)
    expect(wtGitDir.replace(/\\/g, '/')).toContain('/.git/worktrees/')

    const keep = '甲-未提交.txt'
    const target = '乙-本次提交.txt'
    writeFileSync(join(wt, keep), 'keep v1\n')
    writeFileSync(join(wt, target), 'target v1\n')
    expectOk(wt, ['add', keep, target])

    const result = await callGitCommit({ message: 'feat: worktree scope', paths: [target] }, wt)
    expect(result.success).toBe(true)

    // 新提交只含目标文件
    const tree = expectOk(wt, ['-c', 'core.quotepath=false', 'ls-tree', '-r', '--name-only', 'HEAD'])
    expect(tree).toContain(target)
    expect(tree).not.toContain(keep)
    expect(tree).toContain('baseline.txt')

    // 真实索引:keep 仍待提交,target 已对齐 HEAD
    const cached = expectOk(wt, ['-c', 'core.quotepath=false', 'diff', '--cached', '--name-only'])
    expect(cached).toContain(keep)
    expect(cached).not.toContain(target)

    // 临时索引已清理,不残留 index-scope-*
    const leftovers = readdirSync(wtGitDir).filter((name) => name.startsWith('index-scope-'))
    expect(leftovers).toEqual([])
  })

  it('主仓普通范围提交行为不变', async () => {
    const [, dir] = makeRepoWithBaseline()
    writeFileSync(join(dir, 'a.txt'), 'a v1\n')
    writeFileSync(join(dir, 'b.txt'), 'b v1\n')
    expectOk(dir, ['add', 'a.txt', 'b.txt'])

    const result = await callGitCommit({ message: 'feat: main scope', paths: ['a.txt'] }, dir)
    expect(result.success).toBe(true)

    const tree = expectOk(dir, ['ls-tree', '-r', '--name-only', 'HEAD'])
    expect(tree).toContain('a.txt')
    expect(tree).not.toContain('b.txt')
    const cached = expectOk(dir, ['diff', '--cached', '--name-only'])
    expect(cached).toContain('b.txt')
    expect(cached).not.toContain('a.txt')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
