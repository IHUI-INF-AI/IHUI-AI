#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-gate-triggers.mjs(门注册表射程声明完备性)。
// 立因:同一份 `stagedTriggers` 缺省在两条通道上被读成反义 —— 提交通道"任何提交都跑",
// 落地通道"永不复跑" ⇒ "N 臂全绿"可以是盲绿(实证:门 193 缺射程放走过两处裸派生 git)。
// §22c:判据只 import 本文件 `__test__`,测试里不复制第二份判据;端到端一律走 scratch 临时仓。

import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

import { __test__ as T } from '../check-gate-triggers.mjs'
import { parseGateRegistry } from '../lib/land-gate-rerun.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-gate-triggers.mjs')
const ROOT = join(HERE, '..', '..')
const GIT = resolveGitBin() || 'git'

// ── T1 判据:五格 verdict(红/绿/存量/免判/锚点缺) + --strict ──
test('T1 判据:新增无射程 ⇒ 红、摘射程 ⇒ 红、两边都无 ⇒ 存量只报数、info 免判、锚点缺按新增', () => {
  const j = T.judgeTriggers
  const ok = [
    { id: '1', script: 'a.mjs', stagedTriggers: ['pkg/'] },
    { id: '2', script: 'b.mjs' }, // 新增(锚点无)→ 红
    { id: '3', script: 'c.mjs' }, // 存量(锚点也无)→ 只报数
    { id: '4', script: 'd.mjs' }, // 摘射程(锚点有)→ 红
    { id: '5', script: 'e.mjs', mode: 'info' }, // info → 免判
  ]
  const anchor = [
    { id: '1', script: 'a.mjs', stagedTriggers: ['pkg/'] },
    { id: '3', script: 'c.mjs' },
    { id: '4', script: 'd.mjs', stagedTriggers: ['pkg/'] },
    { id: '5', script: 'e.mjs' },
  ]
  const r = T.judgeTriggers({ current: ok, anchor })
  assert.deepEqual(
    r.rows.map((x) => `${x.id}:${x.verdict}`),
    ['1:ok', '2:new-no-trigger', '3:existing', '4:regressed', '5:exempt-info'],
  )
  assert.equal(r.counts.judges, 4, 'info 不计入判据门')
  assert.deepEqual(r.newViolations.map((x) => x.id), ['2', '4'])
  assert.deepEqual(r.red.map((x) => x.id), ['2', '4'], '棘轮档:存量不进红')
  // --strict:存量也进红(全量档,存量归零后才有意义);次序按实现(先新增/退化、后存量),故排序比
  assert.deepEqual(
    T.judgeTriggers({ current: ok, anchor, strict: true })
      .red.map((x) => x.id)
      .sort(),
    ['2', '3', '4'],
  )
  // 锚点整体缺失 ⇒ 缺射程的一律按新增(不许静默当存量)
  assert.equal(T.judgeTriggers({ current: ok, anchor: null }).counts.newNoTrigger, 3)
})

// ── T2 实仓:HEAD 面必须是绿的棘轮档(存量只报数) ──
test('T2 实仓 HEAD 面:棘轮档 exit 0;末行把"存量缺射程"如实报数,不判红', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `期望 exit 0,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  const out = JSON.parse(r.stdout)
  assert.ok(out.counts.entries > 200, `注册表条目数异常:${out.counts.entries}`)
  assert.equal(out.newNoTrigger.length, 0)
  assert.equal(out.regressed.length, 0)
  assert.ok(Array.isArray(out.existingList))
  assert.equal(out.face.face, 'head')
})

// ── T3 形状锁:本门自己也在注册表里,且**必须**声明射程(门对自己一样有牙) ──
// 若本门自己忘了写射程,它就会成为"新增门缺射程" —— 判据会当场咬自己,这里从注册表侧再钉一次。
test('T3 形状锁:本门在注册表里登记且声明了射程(否则它会先咬自己)', () => {
  const got = T.readRegistry(ROOT, 'head')
  assert.ok(got.text, `取不到注册表:${got.why}`)
  const parsed = parseGateRegistry(got.text)
  assert.ok(!parsed.error, `注册表解析失败:${parsed.error}`)
  const mine = parsed.entries.filter((e) => e.script === 'check-gate-triggers.mjs')
  assert.equal(mine.length, 1, `注册表里应恰好一道本门,实得 ${mine.length}`)
  assert.ok(T.hasTriggers(mine[0]), '本门没声明 stagedTriggers ⇒ 落地通道结构上不复跑它,自相矛盾')
  assert.equal(mine[0].mode, 'blocking')
  // 注册引用到的脚本文件必须真的在(门体缺失 = 一条永远 rc≠0 的假门)
  assert.ok(T.readRegistry(ROOT, 'head').text.includes("script: 'check-gate-triggers.mjs'"))
})

// ── T4 端到端:临时仓里判据真能翻红/翻绿(不靠实仓状态) ──
test('T4 端到端(scratch 仓):新增门缺射程 ⇒ 1;补上射程 ⇒ 0;摘掉存量射程 ⇒ 1', () => {
  const dir = mkScratch('gtrig-mirror-')
  const run = (args) =>
    spawnSync(GIT, args, { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })
  const writeReg = (rows) => {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), `const checks = [\n${rows}\n]\n`)
  }
  try {
    run(['init', '-q'])
    run(['config', 'user.email', 't@t'])
    run(['config', 'user.name', 't'])
    writeReg(`  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },`)
    run(['add', '-A'])
    run(['commit', '-q', '-m', 'base'])
    assert.equal(T.report(T.scan({ cwd: dir, face: 'staged' }), { json: true, quiet: true }), 0, '只有存量时应绿')

    writeReg(
      `  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },\n` +
        `  { id: '2', label: 'newbie', script: 'b.mjs', args: [], mode: 'blocking' },`,
    )
    assert.equal(T.report(T.scan({ cwd: dir, face: 'worktree' }), { json: true, quiet: true }), 1, '新增门缺射程必须红')

    writeReg(
      `  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking', stagedTriggers: ['scripts/'] },\n` +
        `  { id: '2', label: 'newbie', script: 'b.mjs', args: [], mode: 'blocking', stagedTriggers: ['pkg/'] },`,
    )
    assert.equal(T.report(T.scan({ cwd: dir, face: 'worktree' }), { json: true, quiet: true }), 0, '补上射程应绿')

    run(['add', '-A'])
    run(['commit', '-q', '-m', 'mid'])
    writeReg(
      `  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },\n` +
        `  { id: '2', label: 'newbie', script: 'b.mjs', args: [], mode: 'blocking', stagedTriggers: ['pkg/'] },`,
    )
    const res = T.scan({ cwd: dir, face: 'worktree' })
    assert.deepEqual(
      res.rows.filter((r) => r.verdict === 'regressed').map((r) => r.id),
      ['1'],
      '摘掉射程必须判 regressed',
    )
    assert.equal(T.report(res, { json: true, quiet: true }), 1)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
