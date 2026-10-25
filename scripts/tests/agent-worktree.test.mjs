// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `agent-worktree.mjs` 镜像测试。钉:① 名字规范化(落点/分支/标签同源);② 落点必须是根直属
 * `.worktrees/wt-<名>`(AGENTS §12h,不许自造第二套);③ porcelain 解析;④ 保活标签截 7 位。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { __test__ as aw } from '../agent-worktree.mjs'

test('① 名字规范化:非法字符转连字符、去首尾、空名抛', () => {
  assert.equal(aw.normalizeName('Land 20261025'), 'land-20261025')
  assert.equal(aw.normalizeName('  Wt-01 '), 'wt-01')
  assert.equal(aw.normalizeName('a/b\\c'), 'a-b-c')
  assert.throws(() => aw.normalizeName('!!!'), /不能为空/)
  assert.throws(() => aw.normalizeName('x'.repeat(41)), /过长/)
})

test('② 落点与分支同源于 §12h 约定', () => {
  assert.equal(aw.worktreePathOf('abc', '/repo').replace(/\\/g, '/'), '/repo/.worktrees/wt-abc')
  assert.equal(aw.branchOf('abc'), 'wt/abc')
  assert.equal(aw.worktreePathOf('Land X', '/repo'), join('/repo', '.worktrees', 'wt-land-x'))
})

test('③ porcelain 解析:路径/HEAD/分支三列', () => {
  const out = [
    'worktree D:/IHUI-AI-git-repo',
    'HEAD c05ca0d5000e',
    'branch refs/heads/main',
    '',
    'worktree D:/IHUI-AI/.worktrees/wt-x',
    'HEAD abc123',
    'branch refs/heads/wt/x',
    '',
  ].join('\n')
  const rows = aw.parseWorktreeList(out)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].branch, 'main')
  assert.equal(rows[1].branch, 'wt/x')
  assert.equal(rows[1].sha, 'abc123')
})

test('④ 未合并回收的保活标签名', () => {
  assert.equal(aw.lostTagOf('abc', '0123456789abcdef'), 'lost-commit/worktree-abc-0123456')
})
