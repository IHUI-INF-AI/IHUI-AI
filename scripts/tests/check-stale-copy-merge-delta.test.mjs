// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 30c 的合并面归因:上游既有的 M/D 不得记成本次动作。
// 判据 = 与**每一枚**父提交比(见 lib/merge-delta.mjs):改写须与两父都不同、删除须两父都有。
// 两格必测:① 合并带入的既有陈旧副本 ⇒ 不判红;② 本次真删除红旗文件 ⇒ 判红。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { __test__ as src } from '../check-stale-copy.mjs'

const { attributableToMergeParents, stagingParentSet } = src
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(DIR, 'scripts')

const git = (dir, ...args) =>
  execFileSyncGit(dir, ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args])

function execFileSyncGit(dir, args) {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout
}

const write = (dir, rel, text) => {
  mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
  writeFileSync(join(dir, rel), text, 'utf8')
}

const addCommit = (dir, msg) => {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', msg)
}

const nullify = (v) => (v === undefined ? null : v)

test('纯判据:与任一父相同即归因该父;两父都没有才是本次新增;两父都有才是本次删除', () => {
  // ① 合并带入的既有条目:结果值等于 MERGE_HEAD ⇒ 不归本次
  assert.equal(
    attributableToMergeParents({ kind: 'modified', curOid: 'X', parentOids: ['Y', 'X'] }),
    false,
  )
  // ② 本次真改写:与每一枚父都不同 ⇒ 归本次(是否陈旧再由原判据判)
  assert.equal(
    attributableToMergeParents({ kind: 'modified', curOid: 'Z', parentOids: ['Y', 'X'] }),
    true,
  )
  // 删除:两父都有、结果没有 ⇒ 本次删除
  assert.equal(attributableToMergeParents({ kind: 'removed', curOid: null, parentOids: ['A', 'B'] }), true)
  // 删除:上游从来没有(任一父缺失)⇒ 归因上游,不记本次
  assert.equal(
    attributableToMergeParents({ kind: 'removed', curOid: null, parentOids: [nullify(undefined), 'B'] }),
    false,
  )
  // 两父都没有该文件、结果有 ⇒ 本次新增
  assert.equal(
    attributableToMergeParents({ kind: 'modified', curOid: 'N', parentOids: [null, null] }),
    true,
  )
  // 结果面没有该件时不得被读成"改写"
  assert.equal(attributableToMergeParents({ kind: 'modified', curOid: null, parentOids: ['A'] }), false)
  // 非合并父集(只有 HEAD):与 HEAD 相同 ⇒ 不是本次改写
  assert.equal(attributableToMergeParents({ kind: 'modified', curOid: 'H', parentOids: ['H'] }), false)
})

test('stagingParentSet:非合并 ⇒ null(旧判据逐字生效);合并未收口 ⇒ HEAD∪MERGE_HEAD', () => {
  const plain = mkScratch('stale-parents-')
  try {
    git(plain, 'init', '-q')
    git(plain, 'checkout', '-q', '-b', 'main')
    write(plain, 'a.txt', 'a\n')
    addCommit(plain, 'a')
    assert.equal(stagingParentSet(plain), null)
  } finally {
    rmScratch(plain)
  }
  const dir = scene()
  try {
    const parents = stagingParentSet(dir)
    assert.deepEqual(parents.map((p) => p.label), ['HEAD', 'MERGE_HEAD'])
  } finally {
    rmScratch(dir)
  }
})

/**
 * 合并夹具:
 *   A0: m.sql = ancient(X)           ← X 是"祖先里的旧版本"
 *   A1: m.sql = current(Y)
 *   theirs(A1 起): m.sql = ancient(X)   ← 上游把文件写回旧版本
 *   main(B, A1 起): 新增 ours.tsx(与 m.sql 无交集)⇒ 非快进合并
 *   merge --no-commit theirs ⇒ 索引 m.sql = X(blob 与 MERGE_HEAD 相同 ⇒ 归因上游)
 *   再 git rm scripts/check-old.mjs(两父都有的红旗文件 ⇒ 本次真删除)
 */
function scene() {
  const dir = mkScratch('stale-copy-merge-')
  write(dir, 'packages/database/drizzle/0001_a.sql', 'CREATE TABLE ancient;\n')
  write(dir, 'scripts/check-old.mjs', 'v1\n')
  git(dir, 'init', '-q')
  git(dir, 'checkout', '-q', '-b', 'main')
  addCommit(dir, 'A0 ancient')

  write(dir, 'packages/database/drizzle/0001_a.sql', 'CREATE TABLE current;\n')
  addCommit(dir, 'A1 current')

  git(dir, 'checkout', '-q', '-b', 'theirs')
  write(dir, 'packages/database/drizzle/0001_a.sql', 'CREATE TABLE ancient;\n')
  addCommit(dir, 'theirs revert')

  git(dir, 'checkout', '-q', 'main')
  write(dir, 'apps/web/app/ours.tsx', 'export const o = 1\n')
  addCommit(dir, 'ours')

  git(dir, 'merge', '--no-commit', 'theirs')
  git(dir, 'rm', '-q', 'scripts/check-old.mjs')

  copyScriptWithClosure(SCRIPTS, 'check-stale-copy.mjs', join(dir, 'scripts'), ['lib/face-reader.mjs'])
  return dir
}

function mergeHeadPath(dir) {
  const p = git(dir, 'rev-parse', '--git-path', 'MERGE_HEAD').trim()
  return p.startsWith('/') || p.includes(':') ? p : join(dir, p)
}

function runGate(dir) {
  const env = { ...process.env }
  delete env.HUSKY_SKIP_STALE_COPY
  const r = spawnSync(process.execPath, [join(dir, 'scripts', 'check-stale-copy.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, stderr: r.stderr ?? '' }
}

/** naive = 单父(HEAD)基准:临时摘掉 MERGE_HEAD,让改前的判据说话。 */
function runNaive(dir) {
  const p = mergeHeadPath(dir)
  const saved = readFileSync(p, 'utf8')
  rmSync(p, { force: true })
  try {
    return runGate(dir)
  } finally {
    writeFileSync(p, saved, 'utf8')
  }
}

const blockedCount = (text) => (text.match(/\[陈旧副本\]/g) || []).length

test('门30c/合并:上游带入的陈旧副本不判红,本次真删除红旗文件判红', () => {
  const dir = scene()
  try {
    const naive = runNaive(dir)
    const fixed = runGate(dir)
    console.log(`[门30c] naive=${blockedCount(naive.stderr)} fixed=${blockedCount(fixed.stderr)}`)
    assert.equal(naive.status, 1)
    assert.equal(blockedCount(naive.stderr), 2, 'naive 单父基准把上游写回旧态也记成本次')
    assert.match(naive.stderr, /0001_a\.sql/)
    assert.equal(fixed.status, 1, '本次真删除红旗文件仍须判红')
    assert.equal(blockedCount(fixed.stderr), 1, '双父基准下只剩本次真动作一条')
    assert.match(fixed.stderr, /scripts\/check-old\.mjs/)
    assert.doesNotMatch(fixed.stderr, /0001_a\.sql/, '合并带入的既有陈旧副本不得判红')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
