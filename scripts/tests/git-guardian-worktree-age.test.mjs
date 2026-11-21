// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Y-71 长期派生检出寿命闸 —— 纯函数镜像测试(§0.6/§22c:只 import 生产本体,不复制判据)。
// 生产单源:scripts/git-guardian.mjs::assessWorktreeAge / parseWorktreeListPorcelain
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { assessWorktreeAge, parseWorktreeListPorcelain } from '../git-guardian.mjs'

/** 阈值来自生产模块(env 可覆盖 ⇒ 测试也读同一处,不能在测试里另写一份)。 */
const SILENT_MS = Number(process.env.IHUI_WORKTREE_REAP_STALE_SILENT_MS || 24 * 60 * 60 * 1000)
const AGE_MS = Number(process.env.IHUI_WORKTREE_REAP_STALE_AGE_MS || 48 * 60 * 60 * 1000)

/** 静默阈值正好 24h ⇒ 命中(含边界)。 */
test('assessWorktreeAge: silent >= 24h ⇒ staleBySilent=true', () => {
  const now = 1_700_000_000_000
  const entry = { exists: true, mtimeMs: now - SILENT_MS, birthtimeMs: NaN, gitAgeMs: NaN }
  const v = assessWorktreeAge(entry, now)
  assert.equal(v.staleBySilent, true)
  assert.equal(v.staleByAge, false)
  assert.ok(Math.abs(v.silentMs - SILENT_MS) < 1)
})

/** 静默 < 24h ⇒ 不命中。 */
test('assessWorktreeAge: silent < 24h ⇒ staleBySilent=false', () => {
  const now = 1_700_000_000_000
  const entry = { exists: true, mtimeMs: now - (SILENT_MS - 1), birthtimeMs: NaN, gitAgeMs: NaN }
  const v = assessWorktreeAge(entry, now)
  assert.equal(v.staleBySilent, false)
  assert.equal(v.staleByAge, false)
})

/** 账龄 48h 但静默 1h ⇒ 只有 staleByAge 命中。 */
test('assessWorktreeAge: age >= 48h but silent < 24h ⇒ staleByAge=true only', () => {
  const now = 1_700_000_000_000
  const entry = {
    exists: true,
    mtimeMs: now - 60 * 60 * 1000, // 静默 1h
    birthtimeMs: now - AGE_MS, // 账龄 48h
    gitAgeMs: NaN,
  }
  const v = assessWorktreeAge(entry, now)
  assert.equal(v.staleBySilent, false)
  assert.equal(v.staleByAge, true)
})

/** 静默 30h + 账龄 60h ⇒ 两条都命中。 */
test('assessWorktreeAge: both thresholds hit ⇒ both true', () => {
  const now = 1_700_000_000_000
  const entry = {
    exists: true,
    mtimeMs: now - 30 * 60 * 60 * 1000,
    birthtimeMs: now - 60 * 60 * 60 * 1000,
    gitAgeMs: NaN,
  }
  const v = assessWorktreeAge(entry, now)
  assert.equal(v.staleBySilent, true)
  assert.equal(v.staleByAge, true)
})

/** 缺 mtime 且缺 age ⇒ 双 false(未判定,不冒红)。 */
test('assessWorktreeAge: missing mtime/age ⇒ both false', () => {
  const now = 1_700_000_000_000
  const entry = { exists: true, mtimeMs: NaN, birthtimeMs: NaN, gitAgeMs: NaN }
  const v = assessWorktreeAge(entry, now)
  assert.equal(v.staleBySilent, false)
  assert.equal(v.staleByAge, false)
  assert.ok(Number.isNaN(v.silentMs))
  assert.ok(Number.isNaN(v.ageMs))
})

/** git 元数据年龄取较新者:birthtime 老、gitAge 新 ⇒ 以 gitAge 为账龄(不冤枉在飞检出)。 */
test('assessWorktreeAge: age = max(birthtime, gitAge) ⇒ 不冤枉在飞检出', () => {
  const now = 1_700_000_000_000
  const entry = {
    exists: true,
    mtimeMs: now - 1 * 60 * 60 * 1000, // 静默 1h
    birthtimeMs: now - 60 * 60 * 60 * 1000, // birthtime 60h(老)
    gitAgeMs: now - 2 * 60 * 60 * 1000, // git 2h(新)
  }
  const v = assessWorktreeAge(entry, now)
  // 账龄取较新 = 2h ⇒ 未破 48h ⇒ 不命中
  assert.equal(v.staleByAge, false)
  assert.ok(Math.abs(v.ageMs - 2 * 60 * 60 * 1000) < 1)
})

/** orphan(exists=false)不走判据 ⇒ 双 false。 */
test('assessWorktreeAge: orphan (exists=false) ⇒ both false', () => {
  const now = 1_700_000_000_000
  const entry = { exists: false, mtimeMs: now - SILENT_MS, birthtimeMs: now - AGE_MS }
  const v = assessWorktreeAge(entry, now)
  assert.equal(v.staleBySilent, false)
  assert.equal(v.staleByAge, false)
})

test('parseWorktreeListPorcelain: normal block + detached + bare + orphan', () => {
  const now = 1_700_000_000_000
  const porcelainText = [
    'worktree /repo/.scratch/merge-wt',
    'HEAD abc1234',
    'branch refs/heads/feat/merge',
    '',
    'worktree /repo/.scratch/d1b-wt',
    'HEAD def5678',
    'detached',
    '',
    'worktree /repo',
    'HEAD 0000000',
    'bare',
    '',
    'worktree /repo/.scratch/ghost-wt',
    'HEAD 1111111',
    'branch refs/heads/feat/ghost',
    '',
  ].join('\n')

  const fsProbe = (p) => {
    // ghost-wt 目录已消失 ⇒ 孤儿壳
    if (p === '/repo/.scratch/ghost-wt') return { exists: false }
    return { exists: true, mtimeMs: now, birthtimeMs: now }
  }

  const entries = parseWorktreeListPorcelain(porcelainText, fsProbe)
  assert.equal(entries.length, 4)

  const mergeWt = entries.find((e) => e.path === '/repo/.scratch/merge-wt')
  assert.equal(mergeWt.branch, 'refs/heads/feat/merge')
  assert.equal(mergeWt.head, 'abc1234')
  assert.equal(mergeWt.detached, false)
  assert.equal(mergeWt.bare, false)
  assert.equal(mergeWt.exists, true)

  const d1bWt = entries.find((e) => e.path === '/repo/.scratch/d1b-wt')
  assert.equal(d1bWt.detached, true)
  assert.equal(d1bWt.branch, '')

  const repoRoot = entries.find((e) => e.path === '/repo')
  assert.equal(repoRoot.bare, true)

  const ghost = entries.find((e) => e.path === '/repo/.scratch/ghost-wt')
  assert.equal(ghost.exists, false)
})

test('parseWorktreeListPorcelain: empty/blank input ⇒ 空数组', () => {
  assert.deepEqual(parseWorktreeListPorcelain(''), [])
  assert.deepEqual(parseWorktreeListPorcelain('   \n\n  '), [])
})

test('parseWorktreeListPorcelain: 无 fsProbe ⇒ 默认 exists=true', () => {
  const text = 'worktree /some/path\nbranch refs/heads/main\n'
  const entries = parseWorktreeListPorcelain(text)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].exists, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
