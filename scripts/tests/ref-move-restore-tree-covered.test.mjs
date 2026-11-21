// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第 94 项(2026-11-21):守夜人回补器必须拒绝"树已在主线祖先里"的对象。
 *
 * 实测形态(main 2026-11-21):第 92 项被刻意弃用的错误签名提交对象 df7faf9a 被以**空改动合并**
 * 回补进 main —— 当时的判据只看 `diff <被丢> <当前头部>`,而当前头部是后一枚 README 提交,
 * 两者确有文件差 ⇒ 判成"确有内容差、照旧回补";但被丢对象的树与当前头部的**父提交**逐字节相同,
 * 回补不增加任何内容,唯一后果是把缺 trailer 的对象拖成可达提交,让 push 门逐枚判时判红。
 *
 * 本文件用真 git 仓库复现两档:
 *   ① 同树对象 ⇒ 跳过,main 一动不动(CAS 都不做);
 *   ② 真有内容的对象 ⇒ 照旧合并回补(反向对照:不许把修复写成"永不回补")。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { isTreeCovered, tryRestore } from '../check-ref-move-loss.mjs'

const git = (root, args, input) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(input ? { input } : {}),
  }).trim()

function mkRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'refmove94-'))
  git(root, ['init', '-q', '-b', 'main'])
  git(root, ['config', 'user.email', 'test@example.com'])
  git(root, ['config', 'user.name', 'test'])
  git(root, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(path.join(root, 'a.txt'), 'one\n', 'utf8')
  git(root, ['add', 'a.txt'])
  git(root, ['commit', '-q', '-m', 'A'])
  return root
}

test('① 树已在主线祖先里 ⇒ 跳过回补,main 一枚不动', () => {
  const root = mkRepo()
  try {
    const a = git(root, ['rev-parse', 'HEAD'])
    // 同树不同消息的对象(等价于"被弃用的重复件":内容早已在线里,只是对象另立一枚)
    const sameTree = git(root, ['commit-tree', `${a}^{tree}`, '-p', a, '-m', 'A duplicate object'])
    assert.equal(git(root, ['rev-parse', `${sameTree}^{tree}`]), git(root, ['rev-parse', `${a}^{tree}`]))
    const r = tryRestore({ curHead: a, droppedShas: [sameTree], root, attest: false })
    assert.equal(r.ok, true)
    assert.deepEqual(r.applied, [], '同树对象不得被合并回补')
    assert.equal(r.newHead, a, 'main 不得被推进(连空合并都不许造)')
    assert.ok(r.skipped.length === 1)
    assert.match(r.skipped[0].why, /主线祖先/)
    assert.equal(git(root, ['rev-parse', 'HEAD']), a, 'refs/heads/main 必须原地不动')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('② 反向对照:真有内容的对象照旧合并回补(修复不得退化成"永不回补")', () => {
  const root = mkRepo()
  try {
    const a = git(root, ['rev-parse', 'HEAD'])
    writeFileSync(path.join(root, 'b.txt'), 'two\n', 'utf8')
    git(root, ['add', 'b.txt'])
    git(root, ['commit', '-q', '-m', 'B'])
    const b = git(root, ['rev-parse', 'HEAD'])
    git(root, ['update-ref', 'refs/heads/main', a, b]) // 模拟"位移丢提交"
    assert.equal(git(root, ['rev-parse', 'HEAD']), a)
    const r = tryRestore({ curHead: a, droppedShas: [b], root, attest: false })
    assert.equal(r.ok, true)
    assert.deepEqual(r.applied, [b])
    assert.notEqual(r.newHead, a)
    assert.equal(git(root, ['rev-parse', 'HEAD']), r.newHead)
    // 合并结果里 b.txt 必须真在树上(证明"回补的是内容",不是空壳)
    assert.equal(git(root, ['show', `${r.newHead}:b.txt`]), 'two')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('③ 纯判据方向:取不到输入一律不判覆盖(交给 diff 判据,绝不放行也不误杀)', () => {
  assert.equal(isTreeCovered('t1', new Set(['t1'])), true)
  assert.equal(isTreeCovered('t1', new Set(['t2'])), false)
  assert.equal(isTreeCovered('t1', null), false)
  assert.equal(isTreeCovered(null, new Set(['t1'])), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
