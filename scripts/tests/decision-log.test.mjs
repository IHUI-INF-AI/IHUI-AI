#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 决策台账(`scripts/lib/decision-log.mjs`)+ 四型审计(`scripts/audit-decision-log.mjs`)的镜像测试。
 *
 * §22c:判据一律 import 源脚本的 `__test__`,测试里**不复制**任何字段表/长度阈值/过滤实现 ——
 * 复制一份就会在源脚本改口径时静默通过(实测过)。
 *
 * 钉的是六件事:
 *  ① 坏条目一条不落(why 过短/缺必填/短 sha),且拒收时连目录都不建;
 *  ② append-only:两次追加后前一次字节不变,新行与第一行逐字相同(幂等可验证形态);
 *  ③ 取不到台账 ⇒ `ok:false` + `state:'missing'`(不得折成"0 条 = 没问题");
 *  ④ 四型审计各自点名(A 有 commit 无 decision / B 有 decision 无 commit / C why 过短 / D 同席倒序),
 *     且 A 型不受 `--seat` 影响(别人的决策不能被当成没有);
 *  ⑤ 坏行与"why 过短"分桶,坏行不吞好行;
 *  ⑥ CLI 未判定 rc=2,`--self-test` rc=0(装车证明:它真能跑)。
 *
 * 用法:`node --test scripts/tests/decision-log.test.mjs`
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as L } from '../lib/decision-log.mjs'
import { __test__ as A } from '../audit-decision-log.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP_ROOT = join(ROOT, '.ihui-agent', 'tmp', 'decision-log')
const AUDIT = join(ROOT, 'scripts', 'audit-decision-log.mjs')
const BASE = {
  at: '2026-10-20T01:00:00.000Z',
  seat: 'r5',
  action: 'land-plan-branch',
  why: '同题两号且正文已漂开,机器折半必有损,故选人工裁决档',
  evidence: ['node scripts/check-plan-task-duplicates.mjs 末行 0 冲突'],
}
const C1 = '1111111111111111111111111111111111111111'
const C2 = '2222222222222222222222222222222222222222'
const C3 = '3333333333333333333333333333333333333333'

let box = null

before(() => {
  mkdirSync(TMP_ROOT, { recursive: true })
  box = mkdtempSync(join(TMP_ROOT, 'case-'))
})

after(() => {
  if (box) rmSync(box, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

function ledgerFile(name) {
  return join(box, name)
}

function rec(line, raw) {
  return { line, raw, validation: L.validateDecision(raw) }
}

test('① validateDecision 收最小形状并把 commit 归一为小写', () => {
  const v = L.validateDecision({ ...BASE, commit: C1.toUpperCase() })
  assert.equal(v.ok, true, JSON.stringify(v.errors))
  assert.deepEqual(Object.keys(v.entry).slice(0, 5), ['at', 'seat', 'action', 'why', 'evidence'])
  assert.equal(v.entry.commit, C1)
})

test('② why 少于 10 字拒收并点名 why', () => {
  const v = L.validateDecision({ ...BASE, why: '改一下' })
  assert.equal(v.ok, false)
  assert.equal(v.errors.length, 1)
  assert.equal(v.errors[0].field, 'why')
  assert.match(v.errors[0].why, /少于 10 字/)
})

test('③ 缺必填逐字段点名(不笼统报"参数错误")', () => {
  const v = L.validateDecision({})
  assert.equal(v.ok, false)
  const fields = new Set(v.errors.map((e) => e.field))
  for (const f of L.REQUIRED_FIELDS) assert.ok(fields.has(f), `未点名必填字段 ${f}`)
})

test('④ 短 sha 与纯日期一律拒收(§1 证据指针禁短 sha)', () => {
  const shortSha = L.validateDecision({ ...BASE, commit: C1.slice(0, 12) })
  assert.equal(shortSha.ok, false)
  assert.equal(shortSha.errors[0].field, 'commit')
  const pureDate = L.validateDecision({ ...BASE, at: '2026-10-20' })
  assert.equal(pureDate.ok, false)
  assert.equal(pureDate.errors[0].field, 'at')
})

test('⑤ 未知字段不拒且原样保留(向前兼容)', () => {
  const v = L.validateDecision({ ...BASE, agentRun: { slot: 7 }, note: '未来加的键' })
  assert.equal(v.ok, true, JSON.stringify(v.errors))
  assert.deepEqual(v.entry.agentRun, { slot: 7 })
  assert.equal(v.entry.note, '未来加的键')
})

test('⑥ 坏条目一条不落:拒收时连文件都不建、既有字节不动', () => {
  const p = ledgerFile('reject.jsonl')
  const bad = L.appendDecision({ ...BASE, why: '短' }, { ledger: p })
  assert.equal(bad.ok, false)
  assert.equal(existsSync(p), false, '坏条目不得建出空台账')

  const good = L.appendDecision(BASE, { ledger: p })
  assert.equal(good.ok, true)
  const before = readFileSync(p, 'utf8')
  const bad2 = L.appendDecision({ ...BASE, action: '' }, { ledger: p })
  assert.equal(bad2.ok, false)
  assert.equal(readFileSync(p, 'utf8'), before, '坏条目改动了既有字节')
})

test('⑦ append-only 两次写幂等:前次字节不变,新行与第一行逐字相同', () => {
  const p = ledgerFile('idempotent.jsonl')
  assert.equal(L.appendDecision(BASE, { ledger: p }).ok, true)
  const once = readFileSync(p, 'utf8')
  assert.equal(L.appendDecision(BASE, { ledger: p }).ok, true)
  const twice = readFileSync(p, 'utf8')
  assert.equal(twice.slice(0, once.length), once)
  assert.equal(twice.slice(once.length), once)
  assert.equal(twice.split('\n').filter(Boolean).length, 2)
})

test('⑧ 台账取不到 ⇒ ok:false / missing(不记绿);过滤值坏 ⇒ bad-filter', () => {
  const rd = L.readDecisions({}, { ledger: ledgerFile('nope.jsonl') })
  assert.equal(rd.ok, false)
  assert.equal(rd.state, 'missing')
  assert.match(rd.why, /台账不存在/)

  const p = ledgerFile('filter.jsonl')
  writeFileSync(p, `${JSON.stringify(BASE)}\n`, 'utf8')
  const badFilter = L.readDecisions({ since: '不是时间' }, { ledger: p })
  assert.equal(badFilter.ok, false)
  assert.equal(badFilter.state, 'bad-filter')
})

test('⑨ 坏行逐条点名且不吞好行', () => {
  const p = ledgerFile('badline.jsonl')
  writeFileSync(p, `${JSON.stringify(BASE)}\n{bad json\n[1,2]\n`, 'utf8')
  const rd = L.readDecisions({}, { ledger: p })
  assert.equal(rd.ok, true)
  assert.equal(rd.total, 1)
  assert.equal(rd.records.length, 1)
  assert.equal(rd.badLines.length, 2)
  assert.deepEqual(rd.badLines.map((b) => b.line), [2, 3])
})

test('⑩ A 型:有 commit 无 decision 逐条点名', () => {
  const commits = [
    { sha: C1, at: '2026-10-20T00:00:00.000Z', subject: 'first' },
    { sha: C2, at: '2026-10-21T00:00:00.000Z', subject: 'second' },
  ]
  const records = [rec(1, { ...BASE, commit: C1 })]
  const out = A.findCommitWithoutDecision(commits, records)
  assert.equal(out.length, 1)
  assert.equal(out[0].sha, C2)
})

test('⑪ B 型:unbound 与 dangling 分开点名', () => {
  const unbound = { ...BASE }
  delete unbound.commit
  const records = [rec(1, unbound), rec(2, { ...BASE, commit: C2 })]
  const exists = new Map([[C2, false]])
  const out = A.findDecisionWithoutCommit(records, exists)
  assert.deepEqual(out.map((x) => x.kind).sort(), ['dangling', 'unbound'])
  assert.equal(out.find((x) => x.kind === 'dangling').sha, C2)
})

test('⑫ C 型:why 过短单列,且不算结构坏行', () => {
  const invalid = [rec(7, { ...BASE, why: '短' })]
  const short = A.findWhyTooShort(invalid)
  assert.equal(short.length, 1)
  assert.equal(short[0].line, 7)
  assert.equal(short[0].chars, 1)
  const bad = A.findStructurallyBad({ badLines: [], invalidRecords: invalid })
  assert.equal(bad.length, 0, 'why 过短被误并进结构坏行')
  const bad2 = A.findStructurallyBad({ badLines: [], invalidRecords: [rec(8, { ...BASE, action: '' })] })
  assert.equal(bad2.length, 1)
})

test('⑬ D 型:同席倒序点名;跨席交错不算', () => {
  const same = [rec(1, { ...BASE, at: '2026-10-20T00:00:00.000Z' }), rec(2, { ...BASE, at: '2026-10-19T00:00:00.000Z' })]
  const out = A.findTimeOutOfOrder(same)
  assert.equal(out.length, 1)
  assert.ok(out[0].backwardsMs > 0)

  const crossed = [
    rec(1, { ...BASE, seat: 'r5', at: '2026-10-20T00:00:00.000Z' }),
    rec(2, { ...BASE, seat: 'r6', at: '2026-10-19T00:00:00.000Z' }),
    rec(3, { ...BASE, seat: 'r5', at: '2026-10-21T00:00:00.000Z' }),
  ]
  assert.equal(A.findTimeOutOfOrder(crossed).length, 0)
})

test('⑭ --seat 只缩 B/C/D,不缩 A(别人的决策不能被当成没有)', () => {
  const p = ledgerFile('seat.jsonl')
  writeFileSync(
    p,
    [{ ...BASE, commit: C1 }, { ...BASE, at: '2026-10-21T01:00:00.000Z', commit: C2 }].map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf8',
  )
  const since = '2026-10-19T00:00:00.000Z'
  const until = '2026-10-23T00:00:00.000Z'
  const rdAll = L.readDecisions({ since, until }, { ledger: p })
  const rdSeat = L.readDecisions({ since, until, seat: 'r9' }, { ledger: p })
  assert.equal(rdAll.records.length, 2)
  assert.equal(rdSeat.records.length, 0)
  const commits = [{ sha: C1, at: '2026-10-20T00:00:00.000Z', subject: 'first' }]
  assert.equal(A.findCommitWithoutDecision(commits, rdAll.records).length, 0)
})

test('⑮ 命令行:台账取不到 rc=2;坏参数 rc=2;--self-test rc=0', () => {
  const missing = spawnSync(process.execPath, [AUDIT, '--root', ROOT, '--ledger', ledgerFile('missing.jsonl'), '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(missing.status, 2, `未判定应 rc=2,实得 ${missing.status}`)
  assert.match(missing.stdout, /"status": "undetermined"/)

  const badArg = spawnSync(process.execPath, [AUDIT, '--since'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  assert.equal(badArg.status, 2)
  assert.match(badArg.stderr, /DECISION-LOG-INPUT/)

  const self = spawnSync(process.execPath, [AUDIT, '--self-test'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 180000 })
  assert.equal(self.status, 0, `--self-test 应 rc=0,实得 ${self.status}:${self.stdout?.slice(-400)}`)
  assert.match(self.stdout, /# self-test (\d+)\/\1/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
