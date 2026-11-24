// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-09 票「先验后落 + ⑤b 硬编码 ref / 无 CAS update-ref」的镜像夹具。
// §22c:直接 import 源模块,不复制实现;三个断言组各自有独立正控,不做"一条绿盖三件事"。
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import * as bg from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as LANDER } from '../object-space-land.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GIT = resolveGitBin() || 'git'
const runGit = (dir, args) =>
  execFileSync(
    GIT,
    ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
const head = (dir) => runGit(dir, ['rev-parse', 'HEAD']).trim()

function makeRepo(t, name = 'ref-cas-') {
  const dir = mkScratch(name)
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q', '-b', 'main'])
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'base'])
  return dir
}

// ── 组①:自检失败 ⇒ ref 不变(先验后落的正控) ───────────────────────────────────
test('L1 提交面自检判红 ⇒ 一个 ref 都不动(rev-parse 前后相同)', (t) => {
  const dir = makeRepo(t)
  const before = head(dir)
  const missing = LANDER.verifyMadeCommitFace({ root: dir, commit: before, paths: ['ghost.txt'] })
  assert.equal(missing.ok, false)
  assert.equal(missing.rc, 1, '缺路径必须 rc=1(不是"未判定"的 2)')
  assert.match(missing.fail.join('\n'), /缺路径/, '判红理由必须说得清是哪把尺子')

  // 反向尺子同向:声明摘除但仍在树 ⇒ 也是 rc=1
  const stillThere = LANDER.verifyMadeCommitFace({ root: dir, commit: before, paths: ['a.txt'], removePaths: ['a.txt'] })
  assert.equal(stillThere.ok, false)
  assert.equal(stillThere.rc, 1)

  assert.equal(head(dir), before, '自检判红后 HEAD 必须原样 —— 这正是旧次序做不到的那一条')
})

test('L2 自检通过与 CAS 的先后顺序锁:verify 必须在 casUpdateRef 之前', () => {
  const src = readFileSync(join(HERE, '..', 'object-space-land.mjs'), 'utf8')
  const verifyAt = src.indexOf('const pre = verifyMadeCommitFace(')
  const casAt = src.indexOf('casUpdateRef(commit, head')
  assert.ok(verifyAt !== -1, 'verifyMadeCommitFace 必须在主流程里被前置调用')
  assert.ok(casAt !== -1, 'CAS 调用必须在位')
  assert.ok(verifyAt < casAt, `先验后落:实测 verify@${verifyAt} / cas@${casAt}`)
})

// ── 组②:缺 CAS ⇒ 拒绝执行,而不是静默改写 ──────────────────────────────────────
test('L3 casUpdateRef:空串/短 sha/HEAD 一律拒,且 ref 不变', (t) => {
  const dir = makeRepo(t)
  const before = head(dir)
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: before, message: 'obj: child', treePath: 'b.txt', text: 'b\n' })
  for (const bad of ['', 'HEAD', before.slice(0, 10), 'refs/heads/main']) {
    assert.throws(
      () => bg.casUpdateRef(C, bad, { root: dir }),
      /oldSha/,
      `${JSON.stringify(bad)} 必须拒(判不出"抢没抢到" = 无 CAS)`,
    )
  }
  assert.throws(() => bg.casUpdateRef(C, undefined, { root: dir }), /缺 oldSha/)
  assert.equal(head(dir), before, '全部拒写后 ref 仍原样')
})

test('L4 源码形状锁:union-converge 里不存在"三参 update-ref"(无旧值就是无 CAS)', () => {
  const src = readFileSync(join(HERE, '..', 'union-converge.mjs'), 'utf8')
  // 逐处 update-ref:每个调用点的实参里必须出现第 4 个元素(旧值)。
  const blind = /'update-ref',\s*[^,\]]+,\s*[^,\]]+\]/g
  const hits = [...src.matchAll(blind)]
  // 唯一豁免:刻意复现"无 CAS 改写"用来断言拒绝的负例 —— 紧邻**上一行**必须带记号。
  const unmarked = hits.filter((m) => !src.slice(0, m.index).split('\n').slice(-2, -1).join('').includes('负例：故意无 CAS，断言拒绝'))
  assert.deepEqual(
    unmarked.map((m) => m[0]),
    [],
    '发现无旧值的 update-ref —— 必须补 CAS(负例须在紧邻上一行标"负例：故意无 CAS，断言拒绝")',
  )
})

// ── 组③:目标 ref 参数化 ⇒ 传非 main 时不碰 main ─────────────────────────────────
// (P0-2 增补 2026-11-09:④ 通道 git-sync-converge 的目标 ref、旁路留痕 operator、守护暂停标记)

test('L7 resolveConvergeTarget:显式/推导/不一致/detached 四臂', async () => {
  const { resolveConvergeTarget } = await import('../git-sync-converge.mjs')
  const e = resolveConvergeTarget({ explicitBranch: 'main', symbolicRef: 'refs/heads/main' })
  assert.equal(e.ok, true, '显式且与 HEAD 一致 ⇒ 放行')
  assert.equal(e.branch, 'main')
  assert.equal(e.source, 'explicit')
  const d = resolveConvergeTarget({ explicitBranch: null, symbolicRef: 'refs/heads/wip/main-wt-dirty-20261109' })
  assert.equal(d.ok, true, '无 --branch ⇒ 从 symbolic-ref HEAD 推导,不再默认 main')
  assert.equal(d.branch, 'wip/main-wt-dirty-20261109')
  assert.equal(d.source, 'derived')
  const m = resolveConvergeTarget({ explicitBranch: 'main', symbolicRef: 'refs/heads/wip' })
  assert.equal(m.ok, false, '显式 main 而 HEAD 在别支 ⇒ 拒(本器全程以 HEAD 为本地侧,代别支写 main 正是封口要拦的型)')
  assert.match(m.why, /不一致/)
  const t1 = resolveConvergeTarget({ explicitBranch: null, symbolicRef: null })
  assert.equal(t1.ok, false, 'detached 且无显式 ⇒ 拒,绝不默认落点')
  const t2 = resolveConvergeTarget({ explicitBranch: 'main', symbolicRef: null })
  assert.equal(t2.ok, false, 'detached 时显式也无法核验本地侧 ⇒ 一并拒')
})

test('L8 源码形状锁:git-sync-converge 不再默认 main,且目标 ref 经 resolveConvergeTarget', () => {
  const src = readFileSync(join(HERE, '..', 'git-sync-converge.mjs'), 'utf8')
  assert.equal(src.includes(`getOpt('--branch', 'main'`), false, '仍见 `getOpt(\'--branch\', \'main\')` ⇒ ④ 通道还在把 main 当默认落点')
  assert.ok(/resolveConvergeTarget\(/.test(src), '主流程必须经 resolveConvergeTarget 定目标分支')
})

test('L9 buildBypassRecord:operator 必填并净化(去空白/截断)', async () => {
  const { buildBypassRecord } = await import('../lib/commit-attestation.mjs')
  const base = { source: 's', landedSha: 'a'.repeat(40), declaredFiles: ['x'] }
  const r = buildBypassRecord({ ...base, operator: '  zhang \n san  ' })
  assert.equal(r.operator, 'zhangsan', 'operator 净化:剥全部空白(留痕行是 JSONL,内嵌换行会毁台账)')
  const d = buildBypassRecord(base)
  assert.equal(typeof d.operator, 'string')
  assert.notEqual(d.operator, '', '不传也要有值(现取 os.userInfo)—— 留痕不许把"谁落的"记成空')
})

test('L10 operator 写→读 round-trip:读侧白名单不许丢这一维', async (t) => {
  const { recordBypassLanding, readLedgerRecords } = await import('../lib/commit-attestation.mjs')
  const dir = mkScratch('op-roundtrip-')
  t.after(() => rmScratch(dir))
  const w = recordBypassLanding({ root: dir, source: 's', landedSha: 'a'.repeat(40), declaredFiles: ['x'], operator: 'zhang' })
  assert.equal(w.ok, true, w.why || '留痕未写入')
  const rd = readLedgerRecords(dir)
  assert.equal(rd.ok, true)
  assert.equal(rd.records.length, 1)
  assert.equal(rd.records[0].operator, 'zhang', '白名单漏 operator ⇒ 写侧记了、读侧读成空,统计会全归"(无 operator)"')
})

test('L11 attributeBypass:按 source×operator 聚合,缺 operator 归"(无 operator)"', async () => {
  const { attributeBypass } = await import('../plan-bypass-ledger-report.mjs')
  const recs = [
    { kind: 'bypass-landing', source: 'union-converge', operator: 'a' },
    { kind: 'bypass-landing', source: 'union-converge', operator: 'a' },
    { kind: 'bypass-landing', source: 'object-space-land', operator: '' },
    { kind: 'gates-then-commit', source: 'x', operator: 'a' },
  ]
  assert.deepEqual(attributeBypass(recs), [
    { source: 'union-converge', operator: 'a', count: 2 },
    { source: 'object-space-land', operator: '(无 operator)', count: 1 },
  ], '只聚合 bypass-landing(gatesRun:false 那一族);计数降序、同数按 source 升序')
})

test('L12 guardianPauseState:无标记不暂停,标记存在即暂停,坏标记 fail-closed', async (t) => {
  const { guardianPauseState } = await import('../git-guardian.mjs')
  const dir = mkScratch('pause-')
  t.after(() => rmScratch(dir))
  assert.equal(guardianPauseState(dir).paused, false)
  const marker = join(dir, '.ihui-agent', 'state', 'guardian-pause.json')
  mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(marker, JSON.stringify({ reason: 'P0-1 封口', setBy: 'agent', ts: new Date().toISOString() }))
  const p = guardianPauseState(dir)
  assert.equal(p.paused, true)
  assert.match(p.why, /P0-1 封口/)
  writeFileSync(marker, '{broken')
  const q = guardianPauseState(dir)
  assert.equal(q.paused, true, '标记存在但读不懂 ⇒ 照停(fail-closed,不把"读不到"当"没暂停")')
})

test('L13 源码形状锁:守护 tick 与 main 两个承载体都查暂停标记', () => {
  const src = readFileSync(join(HERE, '..', 'git-guardian.mjs'), 'utf8')
  assert.ok(src.includes("join('.ihui-agent', 'state', 'guardian-pause.json')") || src.includes('guardian-pause.json'), '暂停标记路径必须在位')
  const hits = [...src.matchAll(/guardianPauseState\(/g)]
  assert.ok(hits.length >= 3, `定义+tick+main 至少三处直呼,实得 ${hits.length}(§12g:两个承载体不得分叉,只接 main 不接 daemon 等于没接)`)
})

test('L5 目标 ref 参数化:写 alt 不碰 main', (t) => {
  const dir = makeRepo(t)
  const mainBefore = head(dir)
  runGit(dir, ['branch', 'alt', mainBefore])
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: mainBefore, message: 'obj: alt child', treePath: 'b.txt', text: 'b\n' })
  assert.equal(bg.casUpdateRef(C, mainBefore, { root: dir, ref: 'refs/heads/alt' }), true)
  assert.equal(bg.git(['rev-parse', 'refs/heads/alt'], { root: dir }), C, 'alt 必须前进')
  assert.equal(bg.git(['rev-parse', 'refs/heads/main'], { root: dir }), mainBefore, 'main 必须原样')
})

test('L6 源码形状锁:⑤b 四个产物不许再把 refs/heads/main 当落点写死', () => {
  for (const f of ['union-converge.mjs', 'plan-union-merge.mjs', 'object-space-merge-cap.mjs', 'git-private-index-commit.sh']) {
    const src = readFileSync(join(HERE, '..', f), 'utf8')
    assert.equal(
      /update-ref\s*['"]?refs\/heads\/main/.test(src) || /'update-ref',\s*'refs\/heads\/main'/.test(src),
      false,
      `${f} 仍在把 refs/heads/main 当 update-ref 落点(应改为从 HEAD 推导的目标 ref)`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
