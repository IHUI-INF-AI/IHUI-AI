#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:check-prod-checkout-foreign-work(生产签出外来工作只读尺子)。
 * §22c:判据全部 import 源脚本 __test__,不在本文件复制第二份。
 * 夹具四型(duplicate / foreign / staged-untracked / unjudged)用 mkScratch() 在工作区外建一次性
 * git 仓(**禁止在仓库树内 git init**,门 208);git 身份写**该仓 local config**(CI 无全局 user.*,
 * 2026-10-21 实测 21 枚用例因此第一步抛死);远端 = 本地另一枚 scratch 仓(git remote add + 本地
 * update-ref,绝不真打网络)。
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as P } from '../check-prod-checkout-foreign-work.mjs'

const results = []
const test = (name, fn) => results.push({ name, run: fn })

function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} exit ${r.status}: ${String(r.stderr).slice(0, 200)}`)
  return String(r.stdout).trim()
}

/** 一次性 git 夹具:local 身份 + main 分支 + 首提交(路径固定的三枚文件)。 */
function initRepo(prefix, files) {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'fixture@ihui.test']) // CI 无全局 user.*,身份必须写 local
  git(dir, ['config', 'user.name', 'fixture'])
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), c)
  }
  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', 'base'])
  return dir
}

let prodDir
let originDir

function setup() {
  originDir = initRepo('pfw-origin-', { 'a.txt': 'A v1\n', 'b.txt': 'B v1\n', 'c.txt': 'C v1\n' })
  prodDir = initRepo('pfw-prod-', { 'a.txt': 'A v1\n', 'b.txt': 'B v1\n', 'c.txt': 'C v1\n' })
  git(prodDir, ['remote', 'add', 'origin', originDir.replace(/\\/g, '/')])
  // 推进远端:a.txt → v2(此版本只存在于 origin 一侧)
  writeFileSync(join(originDir, 'a.txt'), 'A v2 origin only\n')
  git(originDir, ['add', 'a.txt'])
  git(originDir, ['commit', '-m', 'advance a'])
  // 本地路径 fetch(file transport,不走网络)把 origin 的对象与 refs/remotes/origin/main 带进 prod
  git(prodDir, ['fetch', 'origin', 'main'])

  // 四型夹具(在生产签出内铺,尺子只读探测):
  writeFileSync(join(prodDir, 'a.txt'), 'A v2 origin only\n') // duplicate:工作区 blob == origin tip blob
  writeFileSync(join(prodDir, 'b.txt'), 'B v3 nowhere\n') // foreign:两侧都取不到
  writeFileSync(join(prodDir, 'fresh.txt'), 'F untracked new\n') // untracked(全新未跟踪:只计数不判定,计数本身就是存续性信号)
  writeFileSync(join(prodDir, 'new.txt'), 'N staged new\n')
  git(prodDir, ['add', 'new.txt']) // staged-untracked:远端没有该路径 ∧ 已入索引
  rmSync(join(prodDir, 'c.txt')) // unjudged:删除型,工作区 blob 取不到,单列不并桶
}

function cleanup() {
  for (const d of [prodDir, originDir]) if (d) rmScratch(d, { bestEffort: true })
}

// —— 四型夹具端到端 ——
test('四型夹具:duplicate/foreign/staged/unjudged 各归其桶,脏态判 dirty exit 1', () => {
  const r = P.probeProdCheckout(prodDir)
  assert.equal(r.state, 'dirty')
  assert.deepEqual(r.counts, { foreign: 1, duplicate: 1, staged: 1, untracked: 1, unjudged: 1 })
  assert.equal(r.duplicates[0].path, 'a.txt')
  assert.ok(r.foreign.map((x) => x.path).includes('b.txt'))
  assert.ok(!r.foreign.map((x) => x.path).includes('fresh.txt'), 'untracked 只计数,绝不进逐项判定面')
  const b = r.foreign.find((x) => x.path === 'b.txt')
  assert.match(b.blob, /^[0-9a-f]{12}$/)
  assert.ok(b.lineDiff && b.lineDiff.added >= 1, 'foreign 条目带行数差')
  assert.equal(r.staged[0].path, 'new.txt')
  assert.equal(r.unjudged[0].path, 'c.txt')
  assert.match(r.line, /^PROBE-RESULT state=dirty foreign=1 duplicate=1 staged=1 untracked=1 unjudged=1$/)
  assert.equal(P.exitFor(r), 1)
})

test('干净签出:0 脏路径才算绿(exit 0)', () => {
  const clean = initRepo('pfw-clean-', { 'x.txt': 'x\n' })
  try {
    const r = P.probeProdCheckout(clean)
    assert.equal(r.state, 'clean')
    assert.equal(r.counts.foreign + r.counts.duplicate + r.counts.staged + r.counts.untracked + r.counts.unjudged, 0)
    assert.match(r.line, /^PROBE-RESULT state=clean foreign=0 duplicate=0 staged=0 untracked=0 unjudged=0$/)
    assert.equal(P.exitFor(r), 0)
  } finally {
    rmScratch(clean, { bestEffort: true })
  }
})

test('unjudged 整轮:非 git 目录 ⇒ state=unjudged exit 2,绝不冒绿', () => {
  const notRepo = mkScratch('pfw-notrepo-')
  try {
    const r = P.probeProdCheckout(notRepo)
    assert.equal(r.state, 'unjudged')
    assert.ok(r.why)
    assert.equal(P.exitFor(r), 2)
  } finally {
    rmScratch(notRepo, { bestEffort: true })
  }
})

test('洪水未跟踪:200 枚 `??` 只计数不判定,结论行必须带真实计数、绝不塌成 unjudged', () => {
  const dir = initRepo('pfw-flood-', { 'x.txt': 'x\n' })
  try {
    for (let i = 0; i < 200; i++) writeFileSync(join(dir, `f${i}.txt`), `flood ${i}\n`)
    const r = P.probeProdCheckout(dir)
    assert.equal(r.state, 'clean')
    assert.equal(r.counts.untracked, 200)
    assert.equal(r.counts.foreign, 0)
    assert.match(r.line, /^PROBE-RESULT state=clean foreign=0 duplicate=0 staged=0 untracked=200 unjudged=0$/)
    assert.equal(P.exitFor(r), 0)
    // 变异对照(形状锁):摘掉 `??` 过滤器,这 200 枚会进逐项判据——无 origin 的仓里 ls-tree 失败⇒整轮
    // unjudged,有 origin 时⇒200 枚 foreign 假阳性。过滤器是唯一防线,钉死在源码形状上。
    const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
    assert.ok(src.includes(`e.status !== '??'`), 'probe 必须把 `??` 条目挡在逐项判据之外(只计数)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// —— 变异对照(判据摘松/摘紧各一次,结论按预期翻转)——
test('变异·摘松(丢掉 HEAD 侧只比 origin):workBlob==headBlob 的条目必须仍判 duplicate', () => {
  // 若判据被摘松成"只比 origin",下面这条(workBlob == headBlob ∧ != originBlob)会被误判 foreign
  const v = P.classifyEntry({ path: 'a.txt', status: ' M', workBlob: 'h'.repeat(40), idxBlob: 'h'.repeat(40), idxExists: true, headBlob: 'h'.repeat(40), originBlob: 'o'.repeat(40), inHead: true, inOrigin: true })
  assert.equal(v.bucket, 'duplicate')
})

test('变异·摘紧(还要求索引里也有条目):untracked 新文件必须仍判 foreign', () => {
  // 若判据被摘紧成"idxBlob 也两侧取不到才算 foreign",下面这条(无索引项)会被漏报成 unjudged/duplicate
  const v = P.classifyEntry({ path: 'fresh.txt', status: '??', workBlob: 'w'.repeat(40), idxBlob: null, idxExists: false, headBlob: null, originBlob: null, inHead: false, inOrigin: false })
  assert.equal(v.bucket, 'foreign')
})

test('classifyEntry:删除型(workBlob 取不到)单列 unjudged;索引 blob 不在对象库 ⇒ unjudged', () => {
  assert.equal(P.classifyEntry({ path: 'c.txt', status: ' D', workBlob: null, idxBlob: 'i'.repeat(40), idxExists: true, headBlob: 'i'.repeat(40), originBlob: 'i'.repeat(40), inHead: true, inOrigin: true }).bucket, 'unjudged')
  assert.equal(P.classifyEntry({ path: 'z.txt', status: 'M ', workBlob: 'w'.repeat(40), idxBlob: 'q'.repeat(40), idxExists: false, headBlob: 'h'.repeat(40), originBlob: 'o'.repeat(40), inHead: true, inOrigin: true }).bucket, 'unjudged')
})

// —— 坑①②的形状锁 ——
test('坑①:源码不得拼 ref:path 冒号形态(MSYS 会把冒号重写成反斜杠 ⇒ 假报不存在)', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /ORIGIN_REF\s*\+\s*['"`]:/, '不得 ORIGIN_REF + ":" 拼冒号形态')
  assert.doesNotMatch(src, /(HEAD|ORIGIN_REF)['"`]\s*\+\s*['"`]:/, '不得 ref 字面量 + ":" 拼冒号形态')
  assert.doesNotMatch(src, /`[^`]*\$\{(?:ORIGIN_REF|HEAD)\}:/, '不得模板串 ref:${…}: 拼冒号形态')
  assert.ok(src.includes("'ls-tree'"), '树内 blob 一律走 ls-tree argv')
})

test('坑②:blob 存在性只认 cat-file -e 的退出码结论(实现里真实接线)', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes("'cat-file', '-e'"), 'cat-file -e 必须在判据实现里')
  assert.ok(src.includes('idxExists = ce.code === 0'), '存在性 = 退出码结论,不解析输出文本')
})

test('§12g/§22d 形状锁:spawnSync 全带 windowsHide + 显式 stdio;isDirectRun 守卫 + __test__ 出口', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes('pathToFileURL(process.argv[1]).href'), 'isDirectRun 用 pathToFileURL')
  assert.ok(src.includes('export const __test__'))
  const spawns = src.split('spawnSync(').length - 1
  assert.ok(spawns >= 1)
  assert.equal((src.match(/windowsHide: true/g) || []).length, spawns, '每处 spawnSync 都带 windowsHide')
  assert.equal((src.match(/stdio: \['ignore', 'pipe', 'pipe'\]/g) || []).length, spawns, '每处 spawnSync 都显式 stdio')
  assert.ok(!src.includes("input:"), '本器不带 input ⇒ stdin 恒 ignore(门 193 input↔stdin 维不适用)')
})

test('resolveProdCheckout:取不到 nssm 值 ⇒ unjudged,绝不回落默认目录', () => {
  const r = P.resolveProdCheckout({ exists: () => false, nssmGet: () => ({ spawnError: 'ENOENT', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }) })
  assert.equal(r.state, 'unjudged')
  assert.ok(r.why.includes('AppDirectory') && r.why.includes('AppParameters'))
  // AppDirectory 給出合法根 ⇒ 直接采纳,不再问 AppParameters
  const roots = new Set()
  const ok = P.resolveProdCheckout({
    exists: (p) => (roots.add(p), true),
    isDirectory: () => true,
    nssmGet: (param) =>
      param === 'AppDirectory'
        ? { code: 0, stdoutBuf: Buffer.from('D:/fake-prod-root', 'utf16le'), stderrBuf: Buffer.alloc(0) }
        : { code: 1, stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) },
  })
  assert.equal(ok.state, 'ok')
  assert.equal(ok.via, 'AppDirectory')
  // utf16 夹具必须真被 decodeNssm 按 NUL 密度解出来,而不是 utf8 坏串碰巧过 exists
  assert.ok(roots.has('D:/fake-prod-root'))
})

test('parsePorcelainZ:重命名条目吃掉双 NUL 段,目的路径为准', () => {
  const es = P.parsePorcelainZ('R  new.txt\0old.txt\0 M b.txt\0')
  assert.deepEqual(es, [{ status: 'R ', path: 'new.txt' }, { status: ' M', path: 'b.txt' }])
})

// —— runner ——
let failed = 0
setup()
try {
  for (const t of results) {
    try {
      t.run()
      console.log(`✅ ${t.name}`)
    } catch (e) {
      failed++
      console.error(`❌ ${t.name}\n   ${e?.message ?? e}`)
    }
  }
} finally {
  cleanup()
}
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
