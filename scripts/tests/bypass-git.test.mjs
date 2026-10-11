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
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as bg from '../lib/bypass-git.mjs'
import { ledgerPath, readLedgerRecords } from '../lib/commit-attestation.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], { ...runOpts, stdio: ['ignore', 'pipe', 'pipe'] })

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
  for (const k of ['git', 'headBlobOf', 'indexBlobOf', 'writeBlob', 'writeBlobOfWorktree', 'commitTreeWithIndex', 'casUpdateRef', 'sameLines', 'alignSharedIndex', 'resolveHeadRef', 'sleepMs', 'isAncestor', 'attestBypassCommit']) {
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
      stdio: ['ignore', 'pipe', 'pipe'],
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
      stdio: ['ignore', 'pipe', 'pipe'],
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

// G-1080881(2026-10-07):本层此前**没有**删除档,所以任何"旁路落地要删一个文件"都得像 T11/T12 那样
// 手搓临时索引 —— 而手搓那份拿不到本函数自己的两条护栏(基底存在性、onTree 落地前校验),删错的形状没人拦。
// 这三条把删除档钉成契约:正向一次真删,反向两次拒(自相矛盾声明 / 基底里根本没有该路径)。
test('T12b commitTreeWithIndex 删除档·正向:deleted:true 让路径从树里消失,而其余路径与主索引、工作树一律不动', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  const idxBefore = bg.indexBlobOf('a.txt', { root: dir })
  const { commit, entries } = bg.commitTreeWithIndex({
    root: dir,
    parent: head,
    message: 'obj: delete a.txt + add new.txt',
    entries: [{ path: 'a.txt', deleted: true }, { path: 'new.txt', text: 'nn\n' }],
    baseRef: head,
  })
  assert.equal(bg.headBlobOf(commit, 'a.txt', { root: dir }), bg.ABSENT, '声明删除的路径必须真从提交树里消失')
  assert.notEqual(bg.headBlobOf(commit, 'new.txt', { root: dir }), bg.ABSENT, '同一轮的新增不得被删除档连带吞掉')
  assert.notEqual(bg.headBlobOf(commit, 'sub/keep.txt', { root: dir }), bg.ABSENT, 'read-tree 基底里其余路径不得被吞')
  const del = entries.find((e) => e.path === 'a.txt')
  assert.equal(del.deleted, true, '返回面必须如实标出这是一条删除')
  assert.equal(del.blob, null, '删除项的 blob 必须是 null,不得留着上一次的 oid 让调用方误当"已写入"')
  assert.equal(bg.indexBlobOf('a.txt', { root: dir }), idxBefore, '主索引必须未被动过(对象空间的定义)')
  assert.match(readFileSync(join(dir, 'a.txt'), 'utf8'), /v1/, '工作树必须未被动过 —— 删除只发生在对象空间')
})

test('T12c commitTreeWithIndex 删除档·反向:两种会静默失效的声明必须拒,而不是落一枚"什么都没删"的提交', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  assert.throws(
    () =>
      bg.commitTreeWithIndex({
        root: dir,
        parent: head,
        message: 'bad',
        entries: [{ path: 'a.txt', deleted: true, text: 'x\n' }],
        baseRef: head,
      }),
    /自相矛盾/,
    'deleted 与 text/blob 同时出现 ⇒ 意图不明,必须拒(不能猜"到底删不删")',
  )
  assert.throws(
    () =>
      bg.commitTreeWithIndex({
        root: dir,
        parent: head,
        message: 'bad2',
        entries: [{ path: 'no-such-path.txt', deleted: true }],
        baseRef: head,
      }),
    /不在位/,
    '基底树里没有这条路径 ⇒ 这声明永远不会产生删除;静默落地就等于给调用方一枚假的"已删"',
  )
})

// G-628:共用层出口的"返回形状"必须被测试钉住。casUpdateRef 是纯布尔出口(true/false,其余失败照抛),
// 历史上调用方按 `r.ok` 判成功 ⇒ 对布尔取 .ok 得 undefined ⇒ "落地成功"被读成"CAS 未抢到",再按判据
// 发现目标路径已变 ⇒ 报"被并发改动"exit 1 —— 同一会话两次同型自伤(O81(a) 与 D158 各一次)。
// 2026-09-29 取证:入库面 6 个调用方(archive-completed-tasks:1131 / gate-registry-insert:258 /
// ledger-strip-open-rows:288 / live-doc-edit:802 / object-space-land:1370 / plan-tasks-merge:1083,1420,1793,2294)
// 全部按真值判(`if (r)` / `if (!r)`),.ok 误用只活在 .ihui-agent/tmp/ 一次性脚本里 ⇒ 本票落的是形状契约钉子,
// 让"出口形状"与"调用方判据"被同一把尺子钉死,任何一侧漂移都当场红。
test('T13 出口返回形状钉子:布尔出口绝不冒对象、对象出口绝不冒布尔(G-628)', (t) => {
  const dir = makeRepo(t)
  const head = bg.git(['rev-parse', 'HEAD'], { root: dir })
  const { commit } = bg.commitTreeWithIndex({ root: dir, parent: head, message: 'x', treePath: 'a.txt', text: 'q\n' })

  // ① 布尔出口 casUpdateRef:成功与竞争失败两档都必须是 typeof boolean(不得改形成 {ok,...})
  const ok = bg.casUpdateRef(commit, head, { root: dir })
  assert.equal(typeof ok, 'boolean', 'casUpdateRef 成功档必须是布尔(不得是 {ok,...} 之类对象)')
  assert.equal(ok, true)
  const { commit: c2 } = bg.commitTreeWithIndex({ root: dir, parent: commit, message: 'y', treePath: 'a.txt', text: 'r\n' })
  const lost = bg.casUpdateRef(c2, head, { root: dir })
  assert.equal(typeof lost, 'boolean', 'casUpdateRef 竞争失败档必须仍是布尔')
  assert.equal(lost, false)

  // ② 调用方判据视角(入库面全部调用方的写法):CAS 成功(true)必须被 `if (r)` 判为成功;
  //    CAS 竞争失败(false)必须被 `if (!r)` 判为未命中。出口形状与调用方判据被同一例钉住。
  let landedByCaller = false
  if (ok) landedByCaller = true
  assert.equal(landedByCaller, true, 'CAS 成功(true)必须被调用方判据 if (r) 判为成功')
  let retriedByCaller = false
  if (!lost) retriedByCaller = true
  assert.equal(retriedByCaller, true, 'CAS 竞争失败(false)必须被调用方判据 if (!r) 判为未命中')

  // 票面缺陷判据回放:若有人把判据写回 `if (!r || !r.ok)`,成功档(!r=false、r.ok=undefined)也会被判成
  // "未抢到" —— 自伤型重现。本断言证明该型对布尔出口恒错,契约两侧(布尔形状 + 真值判据)缺一不可。
  let misreadAsMiss = false
  if (!ok || !ok.ok) misreadAsMiss = true
  assert.equal(misreadAsMiss, true, '对布尔出口写 if (!r || !r.ok) 会把成功读成未抢到 —— 正是 G-628 禁止的判据型')

  // ③ 三态出口 isAncestor 只许 true/false/null(不得冒对象/undefined);对象出口(正常档/拒绝档)不得塌成布尔
  for (const [a, b] of [[head, commit], [commit, head], ['f'.repeat(40), commit], ['', commit]]) {
    const r = bg.isAncestor(a, b, { root: dir })
    assert.ok(r === true || r === false || r === null, `isAncestor 只许三态,实得 ${String(r)}`)
  }
  // ④ 票面②要求"每个出口"都有形状断言 —— 其余布尔/对象出口逐个补钉(sameLines 是布尔出口;
  //    resolveHeadRef 是 string|null 三态)。T1–T12 已分别钉过它们的行为,这里只钉形状。
  assert.equal(typeof bg.sameLines('a', 'b'), 'boolean', 'sameLines 是布尔出口,不得冒对象')
  const refShape = bg.resolveHeadRef({ root: dir })
  assert.ok(refShape === null || typeof refShape === 'string', 'resolveHeadRef 只许 string|null 三态,不得冒对象/布尔')
  const shaped = bg.commitTreeWithIndex({ root: dir, parent: commit, message: 'z', treePath: 'a.txt', text: 's\n' })
  assert.equal(typeof shaped, 'object')
  assert.notEqual(shaped, null)
  assert.ok(!Array.isArray(shaped), 'commitTreeWithIndex 必须返回对象形状,不得是布尔')
  assert.equal(typeof shaped.commit, 'string')
  const rejected = bg.commitTreeWithIndex({ root: dir, parent: commit, message: 'rj', treePath: 'a.txt', text: 't\n', onTree: () => '拒绝' })
  assert.equal(typeof rejected, 'object')
  assert.notEqual(rejected, null)
  assert.equal(rejected.commit, '', '拒绝档不得产生 commit')
  assert.equal(rejected.rejected, '拒绝', '拒绝档也必须返回对象形状(rejected 字段),不得塌成字符串/布尔')
  const aligned = bg.alignSharedIndex({ root: dir, paths: ['a.txt'], parentRef: head })
  assert.equal(typeof aligned, 'object')
  assert.notEqual(aligned, null)
  assert.ok(!Array.isArray(aligned), 'alignSharedIndex 必须返回对象形状,不得是布尔')
  assert.ok(Array.isArray(aligned.moved) && Array.isArray(aligned.skipped) && Array.isArray(aligned.undetermined), 'alignSharedIndex 的 moved/skipped/undetermined 必须保持数组形状')
})

// 判据纯函数(便于用构造面成对验牙):布尔出口返回值被取属性的两型。
//  A 同行链式:`出口(...).attr` / `出口(...)?.attr`;
//  B 跨行变量:`const v = 出口(...)` 之后,同一文件里出现 `v.attr` / `v?.attr` / `const {..} = v`
//    —— 票面 G-628 的原病灶恰是这一型(先赋值再 `!v || !v.ok`),T14 旧版只钉 A 型,对 B 型结构失明
//    (变异实测:注入 B 型夹具 ⇒ rc=0 假绿)。正当写法一律不判:把返回值当真值用(if (v) / if (!v) /
//    v === true)。出口名由调用方传入分段拼接串,防本文件被自己的扫描命中(守门 131 自咬同型)。
export function findBoolExitMisreads(lines, exitNames) {
  const names = exitNames.join('|')
  const chainRe = new RegExp(`(?:${names})\\s*\\([^)\\n]*\\)\\s*\\??\\.\\w+`)
  const assignRe = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s+)?(?:${names})\\s*\\(`)
  const hits = []
  const vars = new Map()
  lines.forEach((line, i) => {
    if (chainRe.test(line)) hits.push({ line: i + 1, kind: 'chain', text: line.trim().slice(0, 140) })
    const a = assignRe.exec(line)
    if (a) vars.set(a[1], i + 1)
    if (!vars.size) return
    for (const [v, declLine] of vars) {
      if (i + 1 <= declLine) continue
      const dot = new RegExp(`\\b${v}\\s*\\.\\w`)
      const opt = new RegExp(`\\b${v}\\s*\\?\\.`)
      const destruct = new RegExp(`\\{[^{}]*\\}\\s*=\\s*${v}\\b`)
      if (dot.test(line) || opt.test(line) || destruct.test(line)) {
        hits.push({ line: i + 1, kind: 'var', var: v, declLine, text: line.trim().slice(0, 140) })
      }
    }
  })
  return hits
}

test('T14 静态镜像:调用方不得对布尔出口取属性(`出口(...).ok` 这一型,G-628)', () => {
  // 共用层布尔出口(casUpdateRef / isAncestor,含各工具自带的同形 isAncestor)的契约是真值判/三态判;
  // 对出口返回值取属性(链式 `.ok` 或先赋值再 `!r || !r.ok`)恒得 undefined,是票面"成功读成未抢到"的根因型。
  // 逐行扫 scripts/ 全部 .mjs(含在飞工具面)。**B 维(跨行变量型)刻意排除 *.test.mjs 并声明代价**:本镜像
  // 自身的 T13 需要写出病灶回放(`!ok.ok`)证明该型恒错,判据不得咬自己的反例 —— 代价是"只写在测试里的
  // 真违例本维看不见"(守门 131 同一条已声明代价);生产工具面(scripts/*.mjs、scripts/lib/*.mjs)全覆盖。
  const walk = (d) => {
    const out = []
    for (const name of readdirSync(d, { withFileTypes: true })) {
      if (name.name === 'node_modules' || name.name === '.git' || name.name === 'scratch') continue
      const p = join(d, name.name)
      if (name.isDirectory()) out.push(...walk(p))
      else if (name.name.endsWith('.mjs')) out.push(p)
    }
    return out
  }
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const exitNames = ['cas' + 'UpdateRef', 'is' + 'Ancestor']
  const violations = []
  for (const f of walk(rootDir)) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    for (const h of findBoolExitMisreads(lines, exitNames)) {
      if (h.kind === 'var' && f.endsWith('.test.mjs')) continue
      violations.push(`${f}:${h.line}${h.kind === 'var' ? ` (var ${h.var}, 声明于 ${h.declLine})` : ''}: ${h.text}`)
    }
  }
  assert.deepEqual(violations, [], '布尔出口的返回值不得取属性(取 .ok 恒 undefined ⇒ 成功被读成未抢到):')
})

test('T14b 判据有牙(构造面成对,G-628):B 维跨行型必须命中,正当真值判不得误伤', () => {
  // 夹具里的出口名全部由分段拼接构造 —— 源码文本中不出现连续的 `出口(` 形态,
  // 本测试文件才不会被 T14 自己扫红(源码锁会咬自己注释里逐字引用的坏写法,同型教训)。
  const E = 'cas' + 'UpdateRef'
  const hit = (s) => findBoolExitMisreads(s.split('\n'), [E])
  const mustHit = (name, s, kind) => {
    const h = hit(s)
    assert.equal(h.length, 1, `${name} 必须命中,实得 ${h.length}`)
    assert.equal(h[0].kind, kind, `${name} 的形态应为 ${kind}`)
  }
  // 四违例形态(票面病灶是第二种)
  mustHit('A 同行链式', `import x from 'y'\nif (!${E}(a, b, { root }).ok) retry()\n`, 'chain')
  mustHit('B 跨行取属性', `const r = ${E}(a, b, { root })\nif (!r || !r.ok) retry()\n`, 'var')
  mustHit('B 可选链', `const r = ${E}(a, b, { root })\nconst ok = r?.landed\n`, 'var')
  mustHit('B 解构', `const r = ${E}(a, b, { root })\nconst { landed } = r\n`, 'var')
  // 三正当形态不得命中
  assert.deepEqual(hit(`const r = ${E}(a, b, { root })\nif (!r) retry()\n`), [], '真值判(!r)是正当写法,不得判红')
  assert.deepEqual(hit(`const r = ${E}(a, b, { root })\nif (r === true) retry()\n`), [], '等值判(r === true)是正当写法,不得判红')
  assert.deepEqual(hit(`const other = { landed: 1 }\nif (!other.landed) retry()\n`), [], '不同名变量的属性访问与本判据无关,不得误伤')
})

// ===== G-1118437 续:旁路落地留痕的常驻锁(attestBypassCommit) =====
// 立因(现读事实,不是预防):§12f 那句"旁路落地不跑钩子 ⇒ HEAD 是否绿是调用方自己的责任",
// 落地器里只有 object-space-land / live-doc-edit / plan-tasks-merge / union-converge 四家真写了留痕;
// 另有五枚同样走 commit-tree + CAS 的落地器(台账排空器 / 归档器 / 台账自愈 / 注册表插入 / 副本清行)
// 一声不响。后果不是"少一行日志",而是统计器把那五枚读成 unknown,而 unknown 读起来像"没人绕门"
// —— 把没判写成判过了,本仓最高频的失效型。
const CAS = 'cas' + 'UpdateRef'
const ATTEST_NAMES = ['attestBypassCommit', 'recordBypassLanding', 'attestLanding']

function ledgerRecordsOf(dir) {
  const r = readLedgerRecords(dir)
  return r.ok ? r.records : []
}

test('T15 attestBypassCommit 端到端:声明面自取、绑到 landedSha、gatesRun 恒 false', (t) => {
  const dir = makeRepo(t)
  const parent = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  writeFileSync(join(dir, 'sub', 'added.txt'), 'new\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'change'])
  const sha = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const r = bg.attestBypassCommit(sha, { root: dir, headBefore: parent, source: 'e2e:test' })
  assert.equal(r.ok, true, `留痕应写入,实得:${r.why}`)
  const recs = ledgerRecordsOf(dir)
  assert.equal(recs.length, 1, '应当恰好一行')
  const raw = readFileSync(ledgerPath(dir), 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const o = JSON.parse(raw[0])
  assert.equal(o.landedSha, sha, '留痕必须绑到具体提交,否则统计器无法归因')
  assert.equal(o.headBefore, parent)
  assert.equal(o.kind, 'bypass-landing')
  assert.equal(o.gatesRun, false, '旁路一律 gatesRun:false —— 这一维不许被调用方覆盖成 true')
  assert.equal(o.source, 'e2e:test')
  assert.deepEqual([...o.declaredFiles].sort(), ['a.txt', 'sub/added.txt'], '声明面必须自取(不靠调用方手填)')
})

test('T16 去重:同一 landedSha 第二次不得再写一行(重试/CAS 循环会把台账灌成重复)', (t) => {
  const dir = makeRepo(t)
  const parent = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'change'])
  const sha = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const first = bg.attestBypassCommit(sha, { root: dir, headBefore: parent, source: 'e2e:test' })
  assert.equal(first.ok, true, `首次应写入:${first.why}`)
  const second = bg.attestBypassCommit(sha, { root: dir, headBefore: parent, source: 'e2e:test' })
  assert.equal(second.ok, true, '去重不是失败,不得让调用方误报"留痕未写入"')
  assert.equal(second.skipped, 'already-recorded', '必须明写跳过原因,否则"没写"与"已写过"同形')
  assert.equal(ledgerRecordsOf(dir).length, 1, '第二次不得追加第二行')
})

test('T17 空声明面拒写:提交里一个路径都没有 ⇒ 不留痕(留了等于伪造声明)', (t) => {
  const dir = makeRepo(t)
  const emptyTree = execFileSync(
    GIT,
    ['-c', 'safe.directory=*', '-C', dir, 'mktree'],
    { ...runOpts, input: '', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
  const sha = runGit(dir, ['commit-tree', emptyTree, '-m', 'empty']).trim()
  const r = bg.attestBypassCommit(sha, { root: dir, source: 'e2e:empty' })
  assert.equal(r.ok, false, '零路径提交不得留痕')
  assert.match(String(r.why), /空声明面|伪造声明/, `原因要点名这一型,实得:${r.why}`)
  assert.equal(ledgerRecordsOf(dir).length, 0, '台账里不得出现这一行')
})

test('T18 永不抛:sha 问不到时只回 {ok:false,why},不得把落地结论改成失败', (t) => {
  const dir = makeRepo(t)
  let threw = null
  let r = null
  try {
    r = bg.attestBypassCommit('0'.repeat(40), { root: dir, source: 'e2e:missing' })
  } catch (e) {
    threw = e
  }
  assert.equal(threw, null, `留痕出口绝不允许抛:${threw && threw.message}`)
  assert.equal(r.ok, false, '取不到 ⇒ 只能报"未写入",不得冒 ok')
  assert.equal(typeof r.why, 'string')
  assert.ok(r.why.length > 0, 'why 必须是要打给人看的那一行原因,不能是空串')
  assert.equal(ledgerRecordsOf(dir).length, 0)
})

// 生产面不变量的判据:凡调用 CAS 的文件必须同时出现某个留痕出口名。
// 测试面(*.test.mjs)刻意排除并如实声明代价:夹具在临时仓里调 CAS 是正当写法,
// 把它们判红就等于禁止给这套 plumbing 写测试(守门 131 同一条已声明代价)。
function sitesWithoutAttestation(scriptsDir) {
  const out = []
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      if (name.name === 'node_modules' || name.name === '.git' || name.name === 'scratch') continue
      const p = join(d, name.name)
      if (name.isDirectory()) walk(p)
      else if (name.name.endsWith('.mjs')) {
        const rel = p.slice(scriptsDir.length + 1).replace(/\\/g, '/')
        if (rel.endsWith('.test.mjs')) continue
        if (rel === 'lib/bypass-git.mjs') continue
        const text = readFileSync(p, 'utf8')
        const callsCas = text.includes(`${CAS}(`)
        if (!callsCas) continue
        if (ATTEST_NAMES.some((n) => text.includes(`${n}(`))) continue
        out.push(rel)
      }
    }
  }
  walk(scriptsDir)
  return out.sort()
}

test('T19 生产面不变量:凡走 CAS 推进 ref 的落地器必须留痕(真仓 0 处 + 构造面有牙)', (t) => {
  const scriptsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  assert.deepEqual(
    sitesWithoutAttestation(scriptsDir),
    [],
    '这些文件调用 CAS 却不写留痕 ⇒ 统计器会把它们落地的提交读成 unknown(把没判写成判过了)',
  )
  // 有牙证明:造一个临时 scripts 面,三臂 —— 无留痕必点名 / 有留痕必不点名 / 测试面必不点名
  const dir = mkScratch('bypass-attest-')
  t.after(() => rmScratch(dir))
  mkdirSync(join(dir, 'lib'), { recursive: true })
  writeFileSync(join(dir, 'bare-lander.mjs'), `import { ${CAS} } from './lib/bypass-git.mjs'\nconst r = ${CAS}(a, b, { root })\nif (!r) bail()\n`)
  writeFileSync(join(dir, 'honest-lander.mjs'), `import { ${CAS}, attestBypassCommit } from './lib/bypass-git.mjs'\nconst r = ${CAS}(a, b, { root })\nattestBypassCommit(r2, { root })\n`)
  writeFileSync(join(dir, 'fixture.test.mjs'), `import { ${CAS} } from './lib/bypass-git.mjs'\n${CAS}(a, b, { root })\n`)
  writeFileSync(join(dir, 'lib', 'bypass-git.mjs'), `export function ${CAS}() {}\nexport function attestBypassCommit() {}\n`)
  assert.deepEqual(sitesWithoutAttestation(dir), ['bare-lander.mjs'], '无留痕的那枚必须被点名,而有留痕与测试面不得被点名')
})

test('T20 留痕出口不得开第二本台账:写盘只许委托 commit-attestation 那一份实现', () => {
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'bypass-git.mjs'), 'utf8')
  const body = src.slice(src.indexOf(`export function attestBypassCommit`))
  assert.ok(!/appendFileSync\s*\(/.test(body), 'attestBypassCommit 体内不得自己 append —— 第二本台账就是第二份真相')
  assert.ok(
    /import\s*\{[^}]*recordBypassLanding[^}]*\}\s*from\s*'\.\/commit-attestation\.mjs'/.test(src),
    '留痕必须经 recordBypassLanding 那唯一出口',
  )
  assert.ok(
    /import\s*\{[^}]*readLedgerRecords[^}]*\}\s*from\s*'\.\/commit-attestation\.mjs'/.test(src),
    '去重要问同一本台账(readLedgerRecords 未 import 就会永远判"没写过")',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
