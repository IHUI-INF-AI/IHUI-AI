// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/reap-worktrees.mjs 的构造面证明。三档判据各自独立成臂,不给"合并档顺手清掉未合并"留缝:
//   ① merged+clean ⇒ 回收 + 删分支;② merged+dirty ⇒ 先备份(tracked patch + untracked 原样)再回收;
//   ③ unmerged ⇒ 绝不删 + lost-commit 标签保活;另加一条主工作树永不回收的底线臂。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch } from '../lib/scratch-dir.mjs'

const SCRIPT = resolve(fileURLToPath(import.meta.url), '..', '..', 'reap-worktrees.mjs')
const fixtures = []

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  }).trim()
}

function makeRepo() {
  const dir = mkScratch('reap-wt-')
  fixtures.push(dir)
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 'reap-test@example.invalid'])
  git(dir, ['config', 'user.name', 'reap-test'])
  writeFileSync(join(dir, 'base.txt'), 'base\n', 'utf8')
  git(dir, ['add', 'base.txt'])
  git(dir, ['commit', '-q', '-m', 'init'])
  mkdirSync(join(dir, 'wts'), { recursive: true })
  return dir
}

function runReaper(repo, extra = []) {
  const raw = execFileSync(process.execPath, [SCRIPT, '--repo', repo, '--auto', '--json', ...extra], {
    cwd: repo,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(raw)
}

after(() => {
  for (const dir of fixtures) {
    try {
      execFileSync('git', ['-C', dir, 'worktree', 'prune'], { stdio: 'ignore', windowsHide: true })
    } catch {
      /* 夹具清理失败不掩盖用例结论 */
    }
  }
})

test('merged+clean:回收检出并删除已并入分支,主工作树永不动', () => {
  const repo = makeRepo()
  const wt = join(repo, 'wts', 'clean')
  git(repo, ['worktree', 'add', '-q', '-b', 'wt-clean', wt, 'main'])

  const r = runReaper(repo, ['--ttl-hours', '0', '--backup-dir', join(repo, 'bk')])

  assert.equal(r.reaped.length, 1, JSON.stringify(r))
  assert.equal(resolve(r.reaped[0].path), resolve(wt))
  assert.equal(existsSync(wt), false, '检出目录应已删除')
  assert.equal(git(repo, ['branch', '--list', 'wt-clean']), '', '已并入分支应已删除')
  assert.ok(existsSync(join(repo, 'base.txt')), '主工作树必须原样保留')
})

test('merged+dirty:先落备份(tracked patch + untracked)再回收', () => {
  const repo = makeRepo()
  const wt = join(repo, 'wts', 'dirty')
  const bk = join(repo, 'bk')
  git(repo, ['worktree', 'add', '-q', '-b', 'wt-dirty', wt, 'main'])
  writeFileSync(join(wt, 'base.txt'), 'base\nchanged\n', 'utf8')
  writeFileSync(join(wt, 'notes.txt'), 'untracked work\n', 'utf8')

  const r = runReaper(repo, ['--ttl-hours', '0', '--dirty-ttl-hours', '0', '--backup-dir', bk])

  assert.equal(r.backedUp.length, 1, JSON.stringify(r))
  assert.equal(existsSync(wt), false, '备份成功后检出应已删除')
  const backupDir = r.backedUp[0].backupDir
  assert.match(readFileSync(join(backupDir, 'tracked.patch'), 'utf8'), /changed/)
  assert.equal(readFileSync(join(backupDir, 'untracked', 'notes.txt'), 'utf8'), 'untracked work\n')
  assert.ok(existsSync(join(backupDir, 'status.txt')), '状态清单必须在')
})

test('unmerged:绝不自动删除,打 lost-commit 标签保活', () => {
  const repo = makeRepo()
  const wt = join(repo, 'wts', 'unmerged')
  git(repo, ['worktree', 'add', '-q', '-b', 'wt-unmerged', wt, 'main'])
  writeFileSync(join(wt, 'feature.txt'), 'unique commit\n', 'utf8')
  git(wt, ['add', 'feature.txt'])
  git(wt, ['commit', '-q', '-m', 'unique work'])

  const r = runReaper(repo, ['--ttl-hours', '0', '--dirty-ttl-hours', '0', '--backup-dir', join(repo, 'bk')])

  assert.equal(r.unmerged.length, 1, JSON.stringify(r))
  assert.ok(existsSync(wt), '未合并检出不得被自动删除')
  assert.match(git(repo, ['tag', '--list', 'lost-commit/worktree-*']), /lost-commit\/worktree-wt-unmerged-/)
})

test('预览模式(不带 --auto)只报计划,不删任何东西', () => {
  const repo = makeRepo()
  const wt = join(repo, 'wts', 'preview')
  git(repo, ['worktree', 'add', '-q', '-b', 'wt-preview', wt, 'main'])

  const raw = execFileSync(
    process.execPath,
    [SCRIPT, '--repo', repo, '--json', '--ttl-hours', '0', '--backup-dir', join(repo, 'bk')],
    { cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const r = JSON.parse(raw)

  assert.equal(r.reaped.length, 1)
  assert.equal(r.reaped[0].planned, true)
  assert.ok(existsSync(wt), '预览模式不得删除检出')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
