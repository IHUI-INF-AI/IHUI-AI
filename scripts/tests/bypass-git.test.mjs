// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/lib/bypass-git.mjs(§22c —— 直接 import 源模块,不复制实现)。
// 钉四件事:
//  1. 导出面在位(§22c phase B);
//  2. `git()` 默认剥 GIT_INDEX_FILE —— 否则 caller shell 里残留的临时索引会把"对齐共享主索引"写歪;
//  3. commitTreeWithIndex 全程零触碰主索引与工作树(对象空间的定义,由断言"索引没变/盘没变"证明);
//  4. alignSharedIndex 的归属纪律成对对照:索引==父提交 ⇒ 必须对齐;索引==别人真暂存 ⇒ 必须不动并点名。
//     删除档同判据(T11/T12):新 HEAD 无此路径且索引==父提交 ⇒ 必须清掉索引残留(否则一次普通提交就把
//     刚删的文件加回 HEAD,本仓一枚孤儿组件因此连着复活四次);别人真暂存过 ⇒ 仍不代删。
// 临时仓一律经 scripts/lib/scratch-dir.mjs(§26 唯一夹具落点),git 写操作只发生在临时仓内。

import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as bg from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], runOpts)

function makeRepo(t) {
  const dir = mkScratch('bypass-git-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'a.txt'), 'v1\n')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub', 'keep.txt'), 'keep\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

test('T1 导出面(§22c phase B):plumbing 原语必须全部可取', () => {
  for (const k of ['git', 'headBlobOf', 'indexBlobOf', 'writeBlob', 'writeBlobOfWorktree', 'commitTreeWithIndex', 'casUpdateRef', 'sameLines', 'alignSharedIndex', 'resolveHeadRef', 'sleepMs', 'isAncestor']) {
    assert.equal(typeof bg[k], 'function', `bypass-git.${k} 缺失`)
  }
})

test('T1b isAncestor 三态:是祖先 true / 不是 false / 对象取不到 null(未判定不得折叠成"不是")', (t) => {
  const dir = makeRepo(t)
  const c1 = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'second'])
  const c2 = runGit(dir, ['rev-parse', 'HEAD']).trim()
  assert.equal(bg.isAncestor(c1, c2, { root: dir }), true, '第一枚必须在第二枚的历史里(同枚也算)')
  assert.equal(bg.isAncestor(c2, c1, { root: dir }), false, '反向必须读 false —— 这正是推送验证要问的那一格')
  assert.equal(bg.isAncestor(c1, c1, { root: dir }), true, 'a===b 也算被包含')
  // 128 档:对象不存在 ⇒ git 说的是"我判不了",不是"不是祖先"
  assert.equal(bg.isAncestor('f'.repeat(40), c2, { root: dir }), null, '取不到对象必须落未判定')
  assert.equal(bg.isAncestor('', c2, { root: dir }), null, '空输入不猜')
})

test('T2 git() 默认剥 GIT_INDEX_FILE:caller 残留的幽灵索引不得改变取材面', (t) => {
  const dir = makeRepo(t)
  const saved = process.env.GIT_INDEX_FILE
  process.env.GIT_INDEX_FILE = join(dir, 'ghost-index') // 指向不存在 ⇒ 若不剥,ls-files 会读空索引 ⇒ 空输出
  try {
    const listed = bg.git(['ls-files'], { root: dir })
    assert.match(listed, /a\.txt/, '默认必须打在共享主索引上(而非 env 里残留的临时索引)')
  } finally {
    if (saved === undefined) delete process.env.GIT_INDEX_FILE
    else process.env.GIT_INDEX_FILE = saved
  }
})

test('T3 headBlobOf/indexBlobOf 三态:在位取 oid、缺席 ABSENT、不冒充', (t) => {
  const dir = makeRepo(t)
  const oid = bg.headBlobOf('HEAD', 'a.txt', { root: dir })
  assert.match(oid, /^[0-9a-f]{40}$/)
  assert.equal(bg.headBlobOf('HEAD', 'nope.txt', { root: dir }), bg.ABSENT)
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), oid, 'commit 后索引 blob == HEAD blob')
  assert.equal(bg.indexBlobOf('ghost.txt', { root: dir }), bg.ABSENT)
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '--', 'a.txt'])
  const stagedOid = bg.writeBlob('v2\n', { root: dir })
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), stagedOid, 'git add 后索引必须读出新 blob')
})

test('T4 writeBlob 幂等且内容与 cat-file 回读逐字相等', (t) => {
  const dir = makeRepo(t)
  const text = '第一行\n  indented line\n'
  const oid = bg.writeBlob(text, { root: dir })
  assert.equal(oid, bg.writeBlob(text, { root: dir }), '同一文本两次 hash 必须同 oid(幂等)')
  assert.equal(bg.git(['cat-file', 'blob', oid], { root: dir, raw: true }), text)
  writeFileSync(join(dir, 'a.txt'), 'wt-bytes\n')
  assert.equal(bg.writeBlobOfWorktree('a.txt', { root: dir }), bg.writeBlob('wt-bytes\n', { root: dir }))
})

test('T5 commitTreeWithIndex 零触碰主索引与工作树;read-tree 基底保留其余路径', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'DO-NOT-TOUCH\n') // 工作树脏 ⇒ 提交面不得使用它
  const idxBefore = bg.indexBlobOf('a.txt', { root: dir })
  const { commit, entries } = bg.commitTreeWithIndex({
    root: dir,
    parent: head,
    message: 'obj: two paths',
    entries: [
      { path: 'a.txt', text: 'zz\n' },
      { path: 'new.txt', text: 'nn\n' },
    ],
    baseRef: head,
  })
  assert.equal(entries.length, 2)
  assert.equal(bg.git(['rev-parse', `${commit}^`], { root: dir }), head, '父提交必须原样')
  assert.equal(bg.headBlobOf(commit, 'a.txt', { root: dir }), bg.writeBlob('zz\n', { root: dir }))
  assert.notEqual(bg.headBlobOf(commit, 'new.txt', { root: dir }), bg.ABSENT)
  assert.notEqual(bg.headBlobOf(commit, 'sub/keep.txt', { root: dir }), bg.ABSENT, 'read-tree 基底里其余路径不得被吞')
  assert.equal(bg.indexBlobOf('new.txt', { root: dir }), bg.ABSENT, '主索引必须未被动过')
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), idxBefore, '主索引 a.txt 必须未被动过')
  assert.match(readFileSync(join(dir, 'a.txt'), 'utf8'), /DO-NOT-TOUCH/, '工作树必须未被动过')
})

test('T6 casUpdateRef:old 正确 ⇒ true 且 ref 前进;old 过时 ⇒ false 且 ref 不动', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  const { commit } = bg.commitTreeWithIndex({ root: dir, parent: head, message: 'x', treePath: 'a.txt', text: 'q\n' })
  assert.equal(bg.casUpdateRef(commit, head, { root: dir }), true)
  assert.equal(bg.git(['rev-parse', 'HEAD'], { root: dir }), commit)
  const { commit: c2 } = bg.commitTreeWithIndex({ root: dir, parent: commit, message: 'y', treePath: 'a.txt', text: 'r\n' })
  assert.equal(bg.casUpdateRef(c2, head, { root: dir }), false, 'old 已被推进(还指着初代提交)⇒ 必须判抢输而非盲写')
  assert.equal(bg.git(['rev-parse', 'HEAD'], { root: dir }), commit)
})

test('T7 sameLines 结构等值的三种形态', () => {
  assert.equal(bg.sameLines(['a', 'b'], ['a', 'b']), true)
  assert.equal(bg.sameLines(['a', 'b'], ['a', 'b', '']), false, '长度差一行(尾部空行)必须判不等')
  assert.equal(bg.sameLines(['a'], ['b']), false)
})

test('T8 alignSharedIndex 归属纪律·正向:索引==父提交 ⇒ 必须对齐到新 blob(land-r24 与 reconcile-index 漂开的判据收拢为一份)', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir }) // v1 提交:索引==HEAD==父提交
  const { commit } = bg.commitTreeWithIndex({ root: dir, parent: head, message: 'obj: modify', treePath: 'a.txt', text: 'v9\n' })
  assert.equal(bg.casUpdateRef(commit, head, { root: dir }), true)
  const res = bg.alignSharedIndex({ root: dir, paths: ['a.txt'], parentRef: head })
  assert.equal(res.moved.length, 1, '索引停在父提交态 ⇒ 必须移动')
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), bg.headBlobOf('HEAD', 'a.txt', { root: dir }))
})

test('T9 alignSharedIndex 归属纪律·反向:索引==别人真暂存 ⇒ 不动并点名', (t) => {
  const dir = makeRepo(t)
  const c1 = bg.git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '--', 'a.txt'])
  runGit(dir, ['commit', '-q', '-m', 'theirs v2']) // HEAD=v2、索引=v2
  const c2 = bg.git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'v3\n')
  runGit(dir, ['add', '--', 'a.txt']) // 索引=v3(别人又暂存了新内容),HEAD 仍是 v2
  const res = bg.alignSharedIndex({ root: dir, paths: ['a.txt'], parentRef: c1 })
  assert.equal(res.moved.length, 0)
  assert.equal(res.skipped.length, 1)
  assert.match(res.skipped[0].reason, /归属他人/)
  const wantOid = bg.writeBlob('v3\n', { root: dir })
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), wantOid, '别人暂存的 v3 必须原样保留')
  assert.equal(bg.headBlobOf(c2, 'a.txt', { root: dir }), bg.writeBlob('v2\n', { root: dir }))
})

test('T10 alignSharedIndex:索引里没有该路径(旁路提交的新文件) ⇒ 补齐,不留幽灵 D', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  const { commit } = bg.commitTreeWithIndex({ root: dir, parent: head, message: 'obj: add', treePath: 'brand-new.txt', text: 'nb\n' })
  assert.equal(bg.casUpdateRef(commit, head, { root: dir }), true)
  const res = bg.alignSharedIndex({ root: dir, paths: ['brand-new.txt'], parentRef: head })
  assert.equal(res.moved.length, 1)
  assert.notEqual(bg.indexBlobOf('brand-new.txt', { root: dir }), bg.ABSENT)
})

// 删除档:与 T8/T9 同一条判据的第三种形态。旧实现在这里落 `undetermined`(HEAD 里没有 ⇒ "无法对齐"),
// 于是索引里留着旧 blob、status 显 ` D `,此后任何一次不带 pathspec 的普通提交都会把刚删的死文件加回 HEAD。
// 本仓一枚孤儿组件(QuitUpdateOverlay.tsx)因此连着复活四次,每次复活都让引用它的语言包判据红在干净 HEAD 上
// —— 恒红门的唯一结局是各会话跳钩子、连带全部守门作废(AGENTS §12e)。
test('T11 alignSharedIndex 删除档·正向:新 HEAD 无此路径且索引==父提交 ⇒ 清掉索引残留,且普通提交不得把它加回来', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  const idx = join(dir, '.git', 'tmp-align-idx')
  const runIdx = (args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-C', dir, ...args], {
      ...runOpts,
      env: { ...process.env, GIT_INDEX_FILE: idx },
    }).trim()
  // 只在这把私有索引上动 —— 主索引此刻必须仍是"留着 a.txt"的幽灵态
  runIdx(['read-tree', 'HEAD'])
  runIdx(['update-index', '--force-remove', '--', 'a.txt'])
  const tree = runIdx(['write-tree'])
  const commit = runIdx(['commit-tree', tree, '-p', head, '-m', 'obj: delete a.txt'])
  assert.equal(bg.casUpdateRef(commit, head, { root: dir }), true)
  assert.equal(bg.headBlobOf('HEAD', 'a.txt', { root: dir }), bg.ABSENT, '提交面必须真删掉了')
  assert.notEqual(bg.indexBlobOf('a.txt', { root: dir }), bg.ABSENT, '对齐前主索引仍留着幽灵')

  const res = bg.alignSharedIndex({ root: dir, paths: ['a.txt'], parentRef: head })
  assert.deepEqual(res.moved, ['a.txt'], '索引==父提交态 ⇒ 必须清掉')
  assert.equal(res.undetermined.length, 0, '删除不是"判不出":旧版在这里落 undetermined,正是复活根因')
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), bg.ABSENT)

  // 有牙证明:此后一次普通的 `git commit -a`(别人改了自己的文件)不得把 a.txt 带回 HEAD
  const st = runGit(dir, ['status', '--porcelain', '--', 'a.txt'])
  assert.match(st, /^\?\?/, '盘上那份只能是不在跟踪中的 ??,不能是 D(在跟踪 = 一次普通提交就复活)')
  writeFileSync(join(dir, 'sub', 'keep.txt'), 'keep changed\n')
  runGit(dir, ['commit', '-q', '-a', '-m', 'plain commit by someone else'])
  assert.equal(bg.headBlobOf('HEAD', 'a.txt', { root: dir }), bg.ABSENT, '普通提交不得复活已删路径')
})

test('T12 alignSharedIndex 删除档·反向:索引里是别人真暂存的内容(≠父提交) ⇒ 不代删,并保留他的暂存', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  const idx = join(dir, '.git', 'tmp-align-idx2')
  const runIdx = (args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-C', dir, ...args], {
      ...runOpts,
      env: { ...process.env, GIT_INDEX_FILE: idx },
    }).trim()
  runIdx(['read-tree', 'HEAD'])
  runIdx(['update-index', '--force-remove', '--', 'a.txt'])
  const commit = runIdx(['commit-tree', runIdx(['write-tree']), '-p', head, '-m', 'obj: delete a.txt'])
  assert.equal(bg.casUpdateRef(commit, head, { root: dir }), true)
  // 别人在这条路径上暂存了新内容(索引=v2 ≠ 父提交 v1)
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '--', 'a.txt'])

  const res = bg.alignSharedIndex({ root: dir, paths: ['a.txt'], parentRef: head })
  assert.equal(res.moved.length, 0, '别人真暂存过 ⇒ 一律不动')
  assert.equal(res.skipped.length, 1)
  assert.match(res.skipped[0].reason, /归属他人/)
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), bg.writeBlob('v2\n', { root: dir }), '他的 v2 必须原样留着')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
