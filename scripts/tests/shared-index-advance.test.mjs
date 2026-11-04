// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 裸私有索引提交的**后置步骤**回归:提交后共享索引里本席路径必须等于新 blob。
 *
 * 病灶:裸 `GIT_INDEX_FILE=<私有索引> git commit` 只推进 HEAD,不推进共享索引 ⇒ 提交后
 * 该路径在共享索引里停在父树(`git status` 呈 `MM`),下一条裸 `git commit` 会把旧 blob
 * 夹带回滚。修法 = 所有私有索引通道统一调 `advanceSharedIndexPaths`(唯一实现)。
 *
 * 三条用例:
 *   ① 单笔:共享索引 `git ls-files -s -- <path>` 必须等于新 blob;他席 staged 条目一个未动;
 *   ② 并发:两个私有索引提交同时提交**互不相交**路径,各自路径都推进、他席条目与别席路径
 *      互不覆盖(红线 C);
 *   ③ 死锁方向:`index.lock` 被占 ⇒ `{ok:false, reason:'locked'}`,共享索引一个字节不动,
 *      且**不删别人的锁**。
 * 另有一条 CLI 用例,覆盖 sh 站点(结构性走不了 isolated-git)调用同一后置步骤的形态。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { advanceSharedIndexPaths } from '../lib/shared-index-advance.mjs'

const LIB_PATH = fileURLToPath(new URL('../lib/shared-index-advance.mjs', import.meta.url)).replace(/\\/g, '/')

/** 一次 git:显式接管 stdio(本机不给会 spawnSync EBUSY),`-C` 定根。 */
function git(dir, args, env) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...(env ? { env } : {}),
  }).trim()
}

/** 私有索引 env:只把 GIT_INDEX_FILE 指到本进程独占的那份。 */
function privateEnv(indexFile) {
  const env = { ...process.env, GIT_INDEX_FILE: indexFile }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return env
}

function createRepo() {
  const dir = mkScratch('ihui-shared-index-advance-')
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'test@test.com'])
  git(dir, ['config', 'user.name', 'test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'README.md'), '# init\n')
  writeFileSync(join(dir, 'a.txt'), 'a-v1\n')
  writeFileSync(join(dir, 'b.txt'), 'b-v1\n')
  git(dir, ['add', '--', 'README.md', 'a.txt', 'b.txt'])
  git(dir, ['commit', '-m', 'init'])
  return dir
}

/** 共享索引里某路径的完整签名行(`<mode> <blob> <stage>\t<path>`);不在索引里 ⇒ ''。 */
function sigOfShared(dir, path) {
  return git(dir, ['ls-files', '-s', '--', path])
}

function blobOfShared(dir, path) {
  const line = sigOfShared(dir, path)
  return line ? line.split(/\s+/)[1] : undefined
}

/** 在私有索引上真跑一次提交(read-tree HEAD → add 声明集 → commit,不带 pathspec)。 */
function privateCommit(dir, indexFile, paths, message) {
  const env = privateEnv(indexFile)
  git(dir, ['read-tree', 'HEAD'], env)
  git(dir, ['add', '--', ...paths], env)
  git(dir, ['commit', '-m', message], env)
  return git(dir, ['rev-parse', 'HEAD'])
}

// ─── ① 单笔:共享索引被推进到新 blob ───────────────────────────────────────────
test('私有索引提交后:共享索引 ls-files -s 等于新 blob(他席 staged 条目一个未动)', () => {
  const dir = createRepo()
  try {
    // 他席在共享索引里 staged 的条目 —— 红线 C 的观察对象,推进前后必须逐字相同
    writeFileSync(join(dir, 'foreign.txt'), 'foreign\n')
    git(dir, ['add', '--', 'foreign.txt'])
    const foreignSig = sigOfShared(dir, 'foreign.txt')
    assert.ok(foreignSig, '前置:foreign.txt 必须已在共享索引里 staged')

    // 本席:只改 a.txt
    writeFileSync(join(dir, 'a.txt'), 'a-v2\n')
    const oldBlob = blobOfShared(dir, 'a.txt')
    const beforeSig = new Map([['a.txt', sigOfShared(dir, 'a.txt')]])

    const sha = privateCommit(dir, join(dir, '.git', 'priv-a.idx'), ['a.txt'], 'priv: a')

    // 前置(病灶证据):提交已落地,但共享索引里 a.txt 仍是旧 blob —— 裸提交不刷新共享索引
    assert.equal(blobOfShared(dir, 'a.txt'), oldBlob, '前置:共享索引应仍停在父树,否则本用例测不到本病灶')
    assert.match(git(dir, ['status', '--porcelain', '--', 'a.txt']), /^MM/, '前置:应呈现 MM')

    const res = advanceSharedIndexPaths({
      gitCwd: dir,
      committedSha: sha,
      paths: ['a.txt'],
      expectBefore: beforeSig,
      log: { warn() {} },
    })
    assert.equal(res.ok, true, `推进应成功:${JSON.stringify(res)}`)
    assert.deepEqual(res.advanced, ['a.txt'])
    assert.deepEqual(res.skipped, [])

    // 判据 ①:共享索引里该路径 = 新提交树里的 blob
    assert.equal(blobOfShared(dir, 'a.txt'), git(dir, ['rev-parse', `${sha}:a.txt`]))
    assert.equal(git(dir, ['status', '--porcelain', '--', 'a.txt']), '', '推进后不应再有 MM/AM')
    // 他席条目:签名逐字相同,且仍是 staged
    assert.equal(sigOfShared(dir, 'foreign.txt'), foreignSig, '他席 staged 条目被改了(红线 C)')
  } finally {
    rmScratch(dir)
  }
})

// ─── ② 并发:互不相交路径各推进各的 ────────────────────────────────────────────
/** 子进程夹具:私有索引提交 + 后置推进(锁被占时短暂重试,模拟生产里的自愈窗口)。 */
const CHILD_SRC = `
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const [repo, indexFile, file, libPath] = process.argv.slice(2)
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const clean = { ...process.env }
delete clean.GIT_INDEX_FILE
delete clean.GIT_DIR
delete clean.GIT_WORK_TREE
const priv = { ...clean, GIT_INDEX_FILE: indexFile }

function sh(args, env) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', repo, ...args], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env,
  }).trim()
}
function shTry(args, env) {
  try {
    return { ok: sh(args, env) }
  } catch (e) {
    return { err: String(e && (e.stderr || e.message) || e) }
  }
}

// 提交前签名:共享索引里本席路径的当前条目(只用来自判"他席窗口内是否动过同一路径")
const before = new Map()
for (const rec of shTry(['ls-files', '-s', '-z', '--', file], clean).ok.split('\\u0000')) {
  if (!rec) continue
  const tab = rec.indexOf('\\t')
  if (tab < 0) continue
  const meta = rec.slice(0, tab).trim().split(/\\s+/)
  before.set(rec.slice(tab + 1), meta[0] + ' ' + meta[1] + ' ' + meta[2])
}

const { advanceSharedIndexPaths } = await import(pathToFileURL(libPath).href)
let result = { ok: false, reason: 'commit-cas-failed' }
let landed = null
for (let attempt = 0; attempt < 8; attempt++) {
  const rt = shTry(['read-tree', 'HEAD'], priv)
  const add = shTry(['add', '--', file], priv)
  if (rt.err || add.err) { console.error((rt.err || '') + (add.err || '')); process.exit(1) }
  const old = sh(['rev-parse', 'HEAD'], clean)
  const tree = shTry(['write-tree'], priv)
  if (tree.err) { sleep(150); continue }
  const neu = shTry(['commit-tree', tree.ok, '-p', old, '-m', 'priv: ' + file], priv)
  if (neu.err) { sleep(150); continue }
  const ref = sh(['rev-parse', '--abbrev-ref', 'HEAD'], clean)
  // CAS:HEAD 若在窗口内被别席推进 ⇒ 重来,绝不把旧树写回去(裸 git commit 无此保护)
  const ur = shTry(['update-ref', 'refs/heads/' + ref, neu.ok, old], clean)
  if (ur.err) { sleep(150); continue }
  landed = neu.ok
  break
}
if (landed) {
  const sha = landed
  for (let k = 0; k < 15; k++) {
    result = advanceSharedIndexPaths({
      gitCwd: repo,
      committedSha: sha,
      paths: [file],
      expectBefore: before,
      log: { warn() {} },
    })
    if (result.reason !== 'locked') break
    sleep(80)
  }
}
console.log(JSON.stringify(result))
process.exit(result.ok ? 0 : 1)
`

function runChild(dir, indexFile, file) {
  const script = join(dir, '.git', `child-${file.replace(/[^\w]/g, '_')}.mjs`)
  writeFileSync(script, CHILD_SRC)
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, dir, indexFile, file, LIB_PATH], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }))
  })
}

test('并发:两个私有索引提交同时提交互不相交路径 ⇒ 各自推进、他席条目一个未动', async () => {
  const dir = createRepo()
  try {
    // 他席的 staged 条目(既不属 left 也不属 right,任何一臂都不得碰它)
    writeFileSync(join(dir, 'foreign.txt'), 'foreign\n')
    git(dir, ['add', '--', 'foreign.txt'])
    const foreignSig = sigOfShared(dir, 'foreign.txt')

    writeFileSync(join(dir, 'left.txt'), 'left-v1\n')
    writeFileSync(join(dir, 'right.txt'), 'right-v1\n')
    git(dir, ['add', '--', 'left.txt', 'right.txt'])
    git(dir, ['commit', '-m', 'add left/right'])
    const leftOld = blobOfShared(dir, 'left.txt')
    const rightOld = blobOfShared(dir, 'right.txt')

    writeFileSync(join(dir, 'left.txt'), 'left-v2\n')
    writeFileSync(join(dir, 'right.txt'), 'right-v2\n')

    const [r1, r2] = await Promise.all([
      runChild(dir, join(dir, '.git', 'priv-left.idx'), 'left.txt'),
      runChild(dir, join(dir, '.git', 'priv-right.idx'), 'right.txt'),
    ])
    assert.equal(r1.code, 0, `left 臂失败:${r1.out} / ${r1.err}`)
    assert.equal(r2.code, 0, `right 臂失败:${r2.out} / ${r2.err}`)

    const res1 = JSON.parse(r1.out.split('\n').pop())
    const res2 = JSON.parse(r2.out.split('\n').pop())
    assert.equal(res1.ok, true, `left 后置未推进:${r1.out}`)
    assert.equal(res2.ok, true, `right 后置未推进:${r2.out}`)

    // 各自路径都推进(共享索引 = 新提交树)
    assert.equal(blobOfShared(dir, 'left.txt'), git(dir, ['rev-parse', 'HEAD:left.txt']))
    assert.equal(blobOfShared(dir, 'right.txt'), git(dir, ['rev-parse', 'HEAD:right.txt']))
    assert.notEqual(blobOfShared(dir, 'left.txt'), leftOld)
    assert.notEqual(blobOfShared(dir, 'right.txt'), rightOld)

    // 他席条目一个未动;两臂也没互相覆盖
    assert.equal(sigOfShared(dir, 'foreign.txt'), foreignSig, '他席 staged 条目被改了(红线 C)')
    assert.equal(git(dir, ['status', '--porcelain', '--', 'left.txt', 'right.txt']), '')
  } finally {
    rmScratch(dir)
  }
})

// ─── ③ 死锁方向:锁被占 ⇒ 原样不动,且不删别人的锁 ─────────────────────────────
test('共享索引锁被占:返回 locked,共享索引字节不变,绝不删别人的 index.lock', () => {
  const dir = createRepo()
  try {
    writeFileSync(join(dir, 'a.txt'), 'a-v2\n')
    const beforeSig = new Map([['a.txt', sigOfShared(dir, 'a.txt')]])
    const sha = privateCommit(dir, join(dir, '.git', 'priv-b.idx'), ['a.txt'], 'priv: a2')
    const beforeBytes = execFileSync('git', ['-C', dir, 'ls-files', '-s'], { encoding: 'utf8' })

    const foreignLock = join(dir, '.git', 'index.lock')
    writeFileSync(foreignLock, 'other-session\n')

    const res = advanceSharedIndexPaths({
      gitCwd: dir,
      committedSha: sha,
      paths: ['a.txt'],
      expectBefore: beforeSig,
      log: { warn() {} },
    })
    assert.equal(res.ok, false)
    assert.equal(res.reason, 'locked')
    assert.equal(execFileSync('git', ['-C', dir, 'ls-files', '-s'], { encoding: 'utf8' }), beforeBytes)
    assert.ok(existsSync(foreignLock), '别人的 index.lock 被删了(红线 C)')
  } finally {
    rmScratch(dir)
  }
})

// ─── ④ CLI(sh 站点形态):同一后置步骤,由 shell 末尾一行 node 调用 ──────────────
test('CLI:--sha/--paths/--cwd 走同一实现,输出 JSON 且 exit 0', () => {
  const dir = createRepo()
  try {
    writeFileSync(join(dir, 'b.txt'), 'b-v2\n')
    const beforeSig = new Map([['b.txt', sigOfShared(dir, 'b.txt')]])
    const sha = privateCommit(dir, join(dir, '.git', 'priv-cli.idx'), ['b.txt'], 'priv: b')
    assert.equal(blobOfShared(dir, 'b.txt'), beforeSig.get('b.txt').split(/\s+/)[1])

    const out = execFileSync(process.execPath, [LIB_PATH, '--sha', sha, '--paths', 'b.txt', '--cwd', dir], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: privateEnv(join(dir, '.git', 'unused-should-not-exist.idx')),
    })
    const res = JSON.parse(out.trim().split('\n').pop())
    assert.equal(res.ok, true, out)
    assert.deepEqual(res.advanced, ['b.txt'])
    assert.equal(blobOfShared(dir, 'b.txt'), git(dir, ['rev-parse', 'HEAD:b.txt']))
  } finally {
    rmScratch(dir)
  }
})
