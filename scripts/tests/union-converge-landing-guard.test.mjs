// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * union-converge-landing-guard.test.mjs —— 2026-11-05 结构缺陷票 ①② 的回归锁。
 *
 * 这里只测**落地器真正调用的那两个出口**(lib/landing-worktree-align、lib/bypass-deletion-gate),
 * 不复制它们的判据:
 *   ① CAS 之后索引/工作树必须被回写 ⇒ `git diff --cached --name-status` 为 0 行(0 条 `D `);
 *   ② `apps/**`、`packages/**` 的旁路删除必须"0 引用 + 有 reason ≥10 字台账",否则拒绝落地。
 *
 * U2 是 U1 的**阴性对照**:同一个现场**不调用**对齐出口时,`D ` 必须出现 —— 证明 U1 不是空断言。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { casUpdateRef, commitTreeWithIndex } from '../lib/bypass-git.mjs'
import { alignLandingPaths } from '../lib/landing-worktree-align.mjs'
import { judgeBypassDeletions } from '../lib/bypass-deletion-gate.mjs'

function mkRepo() {
  const dir = mkScratch('wt-landing-guard-')
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  g(['init', '-q', '--initial-branch=main'])
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'base.txt'), 'base\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'base'])
  return { dir, g }
}

/** 造"旁路落地已完成 CAS"的终态:HEAD 前进,索引仍停在父提交,磁盘也没有新文件。 */
function landBypassCommit(dir, entries, message = 'bypass land') {
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  const parent = g(['rev-parse', 'HEAD']).trim()
  const { commit } = commitTreeWithIndex({ root: dir, parent, message, entries })
  assert.ok(commit, 'commit-tree 未产出提交')
  assert.equal(casUpdateRef(commit, parent, { root: dir }), true, 'CAS 应成功')
  return { parent, commit }
}

function cachedNameStatus(dir) {
  return gitRaw(['diff', '--cached', '--name-status'], dir, { timeout: 60000 }).trim()
}

test('U1 落地即对齐:CAS 后调用 alignLandingPaths ⇒ 磁盘有文件且 git diff --cached 为 0 行(0 条 D)', () => {
  const { dir } = mkRepo()
  try {
    const path = 'apps/web/src/bypass-new.ts'
    const { parent } = landBypassCommit(dir, [{ path, text: 'export const x = 1\n' }])
    assert.equal(existsSync(join(dir, path)), false, '旁路 CAS 不得碰工作树(前提)')
    assert.match(cachedNameStatus(dir), /^D\t/m, '前提:未对齐时索引/磁盘缺席确实显 D ')

    const r = alignLandingPaths({ root: dir, paths: [path], parentRef: parent })
    assert.deepEqual(r.failed, [], `对齐不应失败:${JSON.stringify(r.failed)}`)
    assert.ok(r.checkedOut.includes(path), '索引对齐后磁盘仍缺 ⇒ 必须再从新 HEAD checkout')
    assert.equal(existsSync(join(dir, path)), true, '工作树必须真的落盘(否则构建读不到)')
    assert.equal(cachedNameStatus(dir), '', '落地后 git diff --cached 必须 0 条,尤其 0 条 D ')
  } finally {
    rmScratch(dir)
  }
})

test('U2 阴性对照:同现场不调用对齐 ⇒ 仍然出现 D (证明 U1 非空断言)', () => {
  const { dir } = mkRepo()
  try {
    const path = 'packages/i18n/src/bypass-new.ts'
    landBypassCommit(dir, [{ path, text: 'export const y = 2\n' }])
    assert.match(cachedNameStatus(dir), /^D\t/m, '不调用对齐时必须能看见 D ')
    assert.equal(existsSync(join(dir, path)), false)
  } finally {
    rmScratch(dir)
  }
})

test('U3 apps/** 旁路删除:被引用或零引用但无删除意图台账 ⇒ 一律拒绝并点名', () => {
  const { dir, g } = mkRepo()
  try {
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/src/hit.ts'), 'export const hit = 1\n')
    writeFileSync(join(dir, 'apps/web/src/importer.ts'), "import { hit } from './hit'\n")
    writeFileSync(join(dir, 'apps/web/src/unused.ts'), 'export const unused = 1\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'apps'])
    const r = judgeBypassDeletions({
      root: dir,
      rev: 'HEAD',
      deletedPaths: ['apps/web/src/hit.ts', 'apps/web/src/unused.ts'],
    })
    assert.equal(r.ok, false, '两条都不满足硬门条件,必须拒绝落地')
    assert.equal(r.blocked.length, 2, `两条都应被点名:${JSON.stringify(r.blocked)}`)
    const hit = r.blocked.find((b) => b.path === 'apps/web/src/hit.ts')
    assert.ok(hit.reasons.some((x) => x.includes('引用')), '被引用的删除必须点名引用位置')
    const unused = r.blocked.find((b) => b.path === 'apps/web/src/unused.ts')
    assert.ok(unused.reasons.some((x) => x.includes('删除意图台账')), '零引用但没有台账也必须拒绝')
  } finally {
    rmScratch(dir)
  }
})

test('U4 硬门双条件:零引用 + reason ≥10 字台账 ⇒ 放行;被引用即便有台账 ⇒ 仍拒绝', () => {
  const { dir, g } = mkRepo()
  try {
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    mkdirSync(join(dir, 'scripts/data'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/src/hit.ts'), 'export const hit = 1\n')
    writeFileSync(join(dir, 'apps/web/src/importer.ts'), "import { hit } from './hit'\n")
    writeFileSync(join(dir, 'apps/web/src/unused.ts'), 'export const unused = 1\n')
    const notices = [
      { path: 'apps/web/src/hit.ts', reason: '确认没有引用后删除的旧实现', until: '2099-12-31' },
      { path: 'apps/web/src/unused.ts', reason: '确认没有引用后删除的旧实现', until: '2099-12-31' },
    ]
    writeFileSync(
      join(dir, 'scripts/data/intentional-file-deletions.jsonl'),
      notices.map((x) => JSON.stringify(x)).join('\n') + '\n',
    )
    g(['add', '-A'])
    g(['commit', '-qm', 'apps + notices'])

    const r = judgeBypassDeletions({
      root: dir,
      rev: 'HEAD',
      deletedPaths: ['apps/web/src/hit.ts', 'apps/web/src/unused.ts'],
    })
    assert.equal(r.blocked.length, 1, `只有被引用的那条该拒:${JSON.stringify(r.blocked)}`)
    assert.equal(r.blocked[0].path, 'apps/web/src/hit.ts')
    assert.equal(r.ok, false, '被引用的删除不能因为台账而放行')

    const clean = judgeBypassDeletions({
      root: dir,
      rev: 'HEAD',
      deletedPaths: ['apps/web/src/unused.ts'],
    })
    assert.equal(clean.ok, true, '0 引用 + 有效台账 ⇒ 硬门放行')
    assert.deepEqual(clean.blocked, [])
  } finally {
    rmScratch(dir)
  }
})

test('U5 未受保护前缀不在此门射程:docs/** 无台账也放行', () => {
  const { dir, g } = mkRepo()
  try {
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'docs/old.md'), '# old\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'docs'])
    const r = judgeBypassDeletions({ root: dir, rev: 'HEAD', deletedPaths: ['docs/old.md'] })
    assert.equal(r.ok, true)
    assert.equal(r.guarded, 0, '非 apps/packages 不应进入硬门')
    assert.deepEqual(r.unguarded, ['docs/old.md'])
  } finally {
    rmScratch(dir)
  }
})

/**
 * U6 装车锁:`--apply` 必须**先过硬门再 commit-tree**,拒绝分支必须 exit 1;落地对齐必须
 * 排在 CAS 成功之后、写 attestation 之前。只测"判据函数"不测装车 = 修了把好刀但没接上。
 */
test('U6 装车:旁路删除硬门在 commit-tree 之前且拒绝分支 exit 1;落地对齐在 CAS 之后', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'union-converge.mjs'), 'utf8')
  const gateAt = src.indexOf('judgeBypassDeletions({')
  const commitAt = src.indexOf("git(['commit-tree'")
  assert.ok(gateAt > 0, '硬门未被 union-converge 调用')
  assert.ok(commitAt > gateAt, '硬门必须排在 commit-tree 之前,否则"拒绝落地"已经是马后炮')
  const block = src.slice(gateAt, commitAt)
  assert.match(block, /process\.exit\(1\)/, '拒绝分支必须 exit 非 0')
  assert.match(block, /旁路删除硬门拒绝落地/, '拒绝时必须点名,不得静默跳过')
  const casAt = src.indexOf("'update-ref', 'refs/heads/main'")
  const alignAt = src.indexOf('alignLandingPaths({')
  const attestAt = src.indexOf('recordBypassLanding({')
  assert.ok(casAt > 0 && alignAt > casAt, '落地对齐必须排在 CAS 成功之后(否则新 HEAD 还没落)')
  assert.ok(attestAt > alignAt, '落地对齐必须在写旁路留痕之前(留痕里的 declaredFiles 才是已回写的口径)')
})
