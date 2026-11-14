// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-022 回归:worktree 族的 git 派生必须走统一封顶出口。
 *
 * 修前:`worktree-core.ts#runGit` 直接 `spawnSync('git', args, { cwd })`,没有 timeout/maxBuffer,
 * 也绕过 `resolveGitBinary` —— PATH 无 git 时全族 ENOENT 不可诊断,git 卡锁时永久阻塞主进程。
 *
 * 三条验收:
 *  1. 正常 worktree 命令仍成功,返回值三态(ok/status/stdout/stderr)不变;
 *  2. 超时档:极小 timeout ⇒ 立即返回且 stderr 带 `[git-capped] timeout` 诊断(不挂死、不返回半截);
 *  3. 派生失败档:IHUI_GIT_BIN 指向不存在路径 ⇒ stderr 带 `[git-spawn-error]`/ENOENT,而非"无输出"。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { spawnSync, type StdioOptions } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'
import { runGit } from '../src/tools/worktree-core.js'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
const GIT_STDIO: StdioOptions = ['ignore', 'pipe', 'pipe']
const GIT_BIN_ENV = 'IHUI_GIT_BIN'

const created: string[] = []

afterEach(() => {
  for (const dir of created.splice(0)) {
    try {
      rmScratch(dir)
    } catch {
      /* 临时目录清理失败不干扰断言 */
    }
  }
})

function git(cwd: string, args: string[]): void {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', stdio: GIT_STDIO })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr ?? ''}`)
}

/** 在 scratch 落点造一个带首个提交的临时仓 */
function mkRepo(prefix: string): string {
  const dir = mkScratch(prefix)
  created.push(dir)
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'seed.txt'), 'seed\n')
  git(dir, ['add', 'seed.txt'])
  git(dir, ['commit', '-q', '-m', 'seed'])
  return dir
}

describe('F-022 worktree git 派生走统一封顶出口', () => {
  it('正常 worktree 命令成功:add / list 仍按退出码三态返回', () => {
    const repo = mkRepo('f022-wt-')
    const head = runGit(['rev-parse', 'HEAD'], repo)
    expect(head.ok).toBe(true)
    expect(head.status).toBe(0)
    expect(head.stdout).not.toBe('')

    const wtPath = join(repo, '.worktrees', 'agent-f022')
    mkdirSync(join(repo, '.worktrees'), { recursive: true })
    const add = runGit(['worktree', 'add', '-b', 'agent-wt-f022', wtPath, 'HEAD'], repo)
    expect(add.ok).toBe(true)
    expect(add.status).toBe(0)

    const list = runGit(['worktree', 'list', '--porcelain'], repo)
    expect(list.ok).toBe(true)
    // porcelain 输出把路径写成正斜杠,断言前归一
    expect(list.stdout.replace(/\\/g, '/')).toContain(wtPath.replace(/\\/g, '/'))
  })

  it('超时档:极小 timeout 立即返回,stderr 带 [git-capped] timeout 诊断(不挂死)', () => {
    const repo = mkRepo('f022-timeout-')
    const startedAt = Date.now()
    const r = runGit(['status', '--porcelain'], repo, { timeoutMs: 1 })
    const elapsed = Date.now() - startedAt

    expect(r.ok).toBe(false)
    // 被杀 ⇒ 与旧行为一致记 -1;stdout 作废不返回半截
    expect(r.status).toBe(-1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('[git-capped]')
    expect(r.stderr).toContain('timeout')
    // 1ms 封顶必须真的封住:远低于 git-runner 的 90s 默认档
    expect(elapsed).toBeLessThan(30_000)
  })

  it('派生失败档:IHUI_GIT_BIN 指向不存在路径 ⇒ 报错可诊断,不是空输出', () => {
    const repo = mkRepo('f022-nogit-')
    const original = process.env[GIT_BIN_ENV]
    process.env[GIT_BIN_ENV] = join(repo, 'no-such-git-binary')
    try {
      const startedAt = Date.now()
      const r = runGit(['status', '--porcelain'], repo)
      const elapsed = Date.now() - startedAt

      expect(r.ok).toBe(false)
      expect(r.status).toBe(-1)
      expect(r.stdout).toBe('')
      expect(r.stderr).toContain('[git-spawn-error]')
      expect(r.stderr).toContain('ENOENT')
      expect(elapsed).toBeLessThan(30_000)
    } finally {
      if (original === undefined) delete process.env[GIT_BIN_ENV]
      else process.env[GIT_BIN_ENV] = original
    }
  })
})
